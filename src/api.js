const express = require('express');
const { authenticateApp, withRateLimit } = require('./auth');

const router = express.Router();

/**
 * Get GitHub App information
 */
router.get('/app', async (req, res) => {
  try {
    const octokit = authenticateApp();
    
    const app = await withRateLimit(() => octokit.apps.getAuthenticated());
    
    res.json({
      name: app.data.name,
      id: app.data.id,
      owner: app.data.owner.login,
      description: app.data.description,
      permissions: app.data.permissions,
      events: app.data.events,
      installations_count: app.data.installations_count
    });
  } catch (error) {
    console.error('Error fetching app info:', error.message);
    res.status(500).json({ error: 'Failed to fetch app information' });
  }
});

/**
 * Get app installations
 */
router.get('/installations', async (req, res) => {
  try {
    const octokit = authenticateApp();
    
    const installations = await withRateLimit(() => 
      octokit.apps.listInstallations()
    );
    
    const installationsData = installations.data.map(installation => ({
      id: installation.id,
      account: {
        login: installation.account.login,
        type: installation.account.type,
        avatar_url: installation.account.avatar_url
      },
      permissions: installation.permissions,
      events: installation.events,
      created_at: installation.created_at,
      updated_at: installation.updated_at
    }));
    
    res.json({
      total_count: installationsData.length,
      installations: installationsData
    });
  } catch (error) {
    console.error('Error fetching installations:', error.message);
    res.status(500).json({ error: 'Failed to fetch installations' });
  }
});

/**
 * Get repositories for a specific installation
 */
router.get('/installations/:installationId/repositories', async (req, res) => {
  try {
    const { installationId } = req.params;
    const octokit = authenticateApp();
    
    const repositories = await withRateLimit(() =>
      octokit.apps.listInstallationReposForAuthenticatedApp({
        installation_id: parseInt(installationId)
      })
    );
    
    const reposData = repositories.data.repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at
    }));
    
    res.json({
      total_count: reposData.length,
      repositories: reposData
    });
  } catch (error) {
    console.error('Error fetching installation repositories:', error.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

/**
 * Get repository statistics
 */
router.get('/repositories/:owner/:repo/stats', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const octokit = authenticateApp();
    
    // Get repository info
    const [repoInfo, issues, pullRequests] = await Promise.all([
      withRateLimit(() => octokit.repos.get({ owner, repo })),
      withRateLimit(() => octokit.issues.listForRepo({ 
        owner, 
        repo, 
        state: 'all',
        per_page: 1
      })),
      withRateLimit(() => octokit.pulls.list({ 
        owner, 
        repo, 
        state: 'all',
        per_page: 1
      }))
    ]);
    
    res.json({
      repository: {
        name: repoInfo.data.name,
        full_name: repoInfo.data.full_name,
        description: repoInfo.data.description,
        language: repoInfo.data.language,
        stargazers_count: repoInfo.data.stargazers_count,
        forks_count: repoInfo.data.forks_count,
        open_issues_count: repoInfo.data.open_issues_count,
        created_at: repoInfo.data.created_at,
        updated_at: repoInfo.data.updated_at
      },
      issues: {
        total: issues.data.length > 0 ? parseInt(issues.headers.link?.match(/page=(\d+)>; rel="last"/)?.[1] || '1') : 0
      },
      pull_requests: {
        total: pullRequests.data.length > 0 ? parseInt(pullRequests.headers.link?.match(/page=(\d+)>; rel="last"/)?.[1] || '1') : 0
      }
    });
  } catch (error) {
    console.error('Error fetching repository stats:', error.message);
    res.status(404).json({ error: 'Repository not found or not accessible' });
  }
});

/**
 * Create a test issue (for debugging)
 */
router.post('/test/issue', async (req, res) => {
  try {
    const { owner, repo, title, body } = req.body;
    
    if (!owner || !repo || !title) {
      return res.status(400).json({ 
        error: 'Missing required fields: owner, repo, title' 
      });
    }
    
    const octokit = authenticateApp();
    
    const issue = await withRateLimit(() =>
      octokit.issues.create({
        owner,
        repo,
        title,
        body: body || 'Test issue created by GitHub App Template'
      })
    );
    
    res.json({
      message: 'Test issue created successfully',
      issue: {
        number: issue.data.number,
        title: issue.data.title,
        url: issue.data.html_url
      }
    });
  } catch (error) {
    console.error('Error creating test issue:', error.message);
    res.status(500).json({ error: 'Failed to create test issue' });
  }
});

/**
 * Health check for API
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      app: 'GET /api/app',
      installations: 'GET /api/installations',
      repositories: 'GET /api/installations/:id/repositories',
      stats: 'GET /api/repositories/:owner/:repo/stats',
      test: 'POST /api/test/issue'
    }
  });
});

module.exports = router;