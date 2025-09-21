const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');

/**
 * Generate JWT token for GitHub App authentication
 * @param {string} appId - GitHub App ID
 * @param {string} privateKey - GitHub App private key
 * @returns {string} JWT token
 */
function generateJWT(appId, privateKey) {
  if (!appId || !privateKey) {
    throw new Error('GitHub App ID and private key are required');
  }

  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iat: now - 60, // issued 60 seconds ago
    exp: now + (10 * 60), // expires in 10 minutes
    iss: parseInt(appId, 10)
  };

  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    throw new Error(`Failed to generate JWT: ${error.message}`);
  }
}

/**
 * Create authenticated Octokit instance for GitHub App
 * @param {string} appId - GitHub App ID
 * @param {string} privateKey - GitHub App private key
 * @returns {Octokit} Authenticated Octokit instance
 */
function authenticateApp(appId = process.env.GITHUB_APP_ID, privateKey = process.env.GITHUB_PRIVATE_KEY) {
  try {
    const token = generateJWT(appId, privateKey);
    
    return new Octokit({
      auth: `Bearer ${token}`,
      userAgent: 'GitHub-App-Template/1.0.0'
    });
  } catch (error) {
    throw new Error(`Failed to authenticate GitHub App: ${error.message}`);
  }
}

/**
 * Get installation access token
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {number} installationId - Installation ID
 * @returns {Promise<string>} Installation access token
 */
async function getInstallationToken(octokit, installationId) {
  try {
    const { data } = await octokit.apps.createInstallationAccessToken({
      installation_id: installationId
    });
    
    return data.token;
  } catch (error) {
    throw new Error(`Failed to get installation token: ${error.message}`);
  }
}

/**
 * Create Octokit instance for a specific installation
 * @param {number} installationId - Installation ID
 * @returns {Promise<Octokit>} Octokit instance with installation token
 */
async function authenticateInstallation(installationId) {
  try {
    const appOctokit = authenticateApp();
    const installationToken = await getInstallationToken(appOctokit, installationId);
    
    return new Octokit({
      auth: `token ${installationToken}`,
      userAgent: 'GitHub-App-Template/1.0.0'
    });
  } catch (error) {
    throw new Error(`Failed to authenticate installation: ${error.message}`);
  }
}

/**
 * Verify GitHub App configuration
 * @returns {Promise<Object>} App information
 */
async function verifyAppConfig() {
  try {
    const octokit = authenticateApp();
    const { data: app } = await octokit.apps.getAuthenticated();
    
    console.log(`✅ GitHub App authenticated successfully:`);
    console.log(`   Name: ${app.name}`);
    console.log(`   ID: ${app.id}`);
    console.log(`   Owner: ${app.owner.login}`);
    
    return app;
  } catch (error) {
    console.error(`❌ GitHub App authentication failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rate limit handler with retry logic
 * @param {Function} operation - API operation to execute
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise} Operation result
 */
async function withRateLimit(operation, retries = 3) {
  try {
    return await operation();
  } catch (error) {
    if (error.status === 403 && error.headers['x-ratelimit-remaining'] === '0' && retries > 0) {
      const resetTime = parseInt(error.headers['x-ratelimit-reset']) * 1000;
      const waitTime = resetTime - Date.now() + 1000; // Add 1 second buffer
      
      console.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRateLimit(operation, retries - 1);
    }
    
    throw error;
  }
}

module.exports = {
  generateJWT,
  authenticateApp,
  getInstallationToken,
  authenticateInstallation,
  verifyAppConfig,
  withRateLimit
};