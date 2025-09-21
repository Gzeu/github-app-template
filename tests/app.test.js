const request = require('supertest');
const app = require('../src/app');

describe('GitHub App Template', () => {
  describe('Health Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.app).toBe('GitHub App Template');
    });
    
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
    });
  });
  
  describe('Root Endpoint', () => {
    test('GET / should return app information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body.message).toBe('GitHub App Template Server');
      expect(response.body.status).toBe('running');
      expect(response.body.endpoints).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
      
      expect(response.body.error).toBe('Not found');
    });
  });
  
  describe('Webhook Endpoint', () => {
    test('POST /webhooks without signature should return 401', async () => {
      await request(app)
        .post('/webhooks')
        .send({ test: 'data' })
        .expect(401);
    });
  });
});