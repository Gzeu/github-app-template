const crypto = require('crypto');
const { authenticateInstallation, withRateLimit } = require('./auth');

/**
 * Verify webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - GitHub signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean} Whether signature is valid
 */
function verifySignature(payload, signature, secret = process.env.WEBHOOK_SECRET) {
  if (!secret) {
    console.warn('⚠️  Webhook secret not configured - skipping signature verification');
    return true; // Allow in development without secret
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload, 'utf8').digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature || '', 'utf8'),
    Buffer.from(digest, 'utf8')
  );
}

/**
 * Handle issues webhook events
 * @param {Object} payload - Webhook payload
 * @param {Object} octokit - Authenticated Octokit instance
 */
async function handleIssues(payload, octokit) {
  const { action, issue, repository } = payload;
  
  console.log(`📦 Issues event: ${action} - ${issue.title}`);
  
  switch (action) {
    case 'opened':
      await handleIssueOpened(payload, octokit);
      break;
    case 'closed':
      await handleIssueClosed(payload, octokit);
      break;
    case 'labeled':
    case 'unlabeled':
      await handleIssueLabeled(payload, octokit);
      break;
    default:
      console.log(`Issue action '${action}' not handled`);
  }
}

/**
 * Handle new issue creation
 */
async function handleIssueOpened(payload, octokit) {
  const { issue, repository } = payload;
  
  try {
    // Add a welcome comment to new issues
    await withRateLimit(() => 
      octokit.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: issue.number,
        body: `🚀 Thanks for opening this issue! We'll take a look as soon as possible.\n\n` +
              `Issue #${issue.number} has been automatically labeled and is now being tracked.`
      })
    );
    
    console.log(`✅ Added welcome comment to issue #${issue.number}`);
  } catch (error) {
    console.error(`❌ Error handling new issue: ${error.message}`);
  }
}

/**
 * Handle issue closure
 */
async function handleIssueClosed(payload, octokit) {
  const { issue } = payload;
  console.log(`✅ Issue #${issue.number} was closed`);
  
  // Add any cleanup logic here
}

/**
 * Handle issue labeling
 */
async function handleIssueLabeled(payload, octokit) {
  const { action, issue, label } = payload;
  console.log(`🏷️ Issue #${issue.number} ${action}: ${label?.name}`);
}

/**
 * Handle pull request webhook events
 * @param {Object} payload - Webhook payload
 * @param {Object} octokit - Authenticated Octokit instance
 */
async function handlePullRequest(payload, octokit) {
  const { action, pull_request, repository } = payload;
  
  console.log(`🔀 Pull Request event: ${action} - ${pull_request.title}`);
  
  switch (action) {
    case 'opened':
      await handlePROpened(payload, octokit);
      break;
    case 'closed':
      if (pull_request.merged) {
        await handlePRMerged(payload, octokit);
      }
      break;
    case 'review_requested':
      await handlePRReviewRequested(payload, octokit);
      break;
    default:
      console.log(`Pull request action '${action}' not handled`);
  }
}

/**
 * Handle new pull request
 */
async function handlePROpened(payload, octokit) {
  const { pull_request, repository } = payload;
  
  try {
    // Add automatic labels based on PR size
    const labels = [];
    
    if (pull_request.additions > 500 || pull_request.deletions > 500) {
      labels.push('large-pr');
    } else if (pull_request.additions > 100 || pull_request.deletions > 100) {
      labels.push('medium-pr');
    } else {
      labels.push('small-pr');
    }
    
    if (labels.length > 0) {
      await withRateLimit(() =>
        octokit.issues.addLabels({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: pull_request.number,
          labels
        })
      );
      
      console.log(`✅ Added labels to PR #${pull_request.number}: ${labels.join(', ')}`);
    }
  } catch (error) {
    console.error(`❌ Error handling new PR: ${error.message}`);
  }
}

/**
 * Handle merged pull request
 */
async function handlePRMerged(payload, octokit) {
  const { pull_request } = payload;
  console.log(`✅ Pull Request #${pull_request.number} was merged`);
  
  // Add any post-merge automation here
}

/**
 * Handle PR review requests
 */
async function handlePRReviewRequested(payload, octokit) {
  const { pull_request, requested_reviewer } = payload;
  console.log(`👀 Review requested from ${requested_reviewer?.login} for PR #${pull_request.number}`);
}

/**
 * Handle push webhook events
 * @param {Object} payload - Webhook payload
 * @param {Object} octokit - Authenticated Octokit instance
 */
async function handlePush(payload, octokit) {
  const { ref, commits, repository } = payload;
  
  console.log(`🚀 Push event: ${commits.length} commit(s) to ${ref}`);
  
  // Only handle pushes to main/master branch
  if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
    console.log(`🎆 Push to main branch detected`);
    
    // Add any main branch automation here
    // e.g., trigger deployments, run additional checks, etc.
  }
}

/**
 * Handle installation webhook events
 * @param {Object} payload - Webhook payload
 */
async function handleInstallation(payload) {
  const { action, installation, repositories } = payload;
  
  console.log(`📦 Installation event: ${action}`);
  
  switch (action) {
    case 'created':
      console.log(`✅ App installed for ${installation.account.login}`);
      if (repositories) {
        console.log(`   Repositories: ${repositories.map(r => r.name).join(', ')}`);
      }
      break;
    case 'deleted':
      console.log(`❌ App uninstalled for ${installation.account.login}`);
      break;
    default:
      console.log(`Installation action '${action}' not handled`);
  }
}

/**
 * Main webhook handler
 */
const webhookHandler = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const payload = req.body;
    
    // Verify signature
    if (!verifySignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }
    
    // Parse payload
    const data = JSON.parse(payload.toString());
    
    console.log(`\n📨 Webhook received: ${event}`);
    
    // Get installation ID for authentication
    const installationId = data.installation?.id;
    let octokit = null;
    
    if (installationId) {
      try {
        octokit = await authenticateInstallation(installationId);
      } catch (error) {
        console.error(`❌ Failed to authenticate installation: ${error.message}`);
        return res.status(500).send('Authentication failed');
      }
    }
    
    // Handle different webhook events
    switch (event) {
      case 'issues':
        await handleIssues(data, octokit);
        break;
      case 'pull_request':
        await handlePullRequest(data, octokit);
        break;
      case 'push':
        await handlePush(data, octokit);
        break;
      case 'installation':
      case 'installation_repositories':
        await handleInstallation(data);
        break;
      default:
        console.log(`⚠️  Webhook event '${event}' not handled`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error(`❌ Webhook error: ${error.message}`);
    res.status(500).send('Internal server error');
  }
};

module.exports = webhookHandler;