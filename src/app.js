const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const webhookHandler = require('./webhooks');
const { authenticateApp } = require('./auth');
const apiRoutes = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Parse JSON bodies
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    app: 'GitHub App Template',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Webhook endpoint
app.use('/webhooks', webhookHandler);

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'GitHub App Template Server',
    status: 'running',
    endpoints: {
      health: '/health',
      webhooks: '/webhooks',
      api: '/api'
    },
    documentation: 'https://github.com/Gzeu/github-app-template'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 GitHub App Template Server started!`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhooks`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
  console.log(`\n📚 Documentation: https://github.com/Gzeu/github-app-template\n`);
});

module.exports = app;