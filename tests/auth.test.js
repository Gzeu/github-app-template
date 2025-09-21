const { generateJWT, authenticateApp, withRateLimit } = require('../src/auth');
const jwt = require('jsonwebtoken');

// Mock environment variables
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_PRIVATE_KEY = 'fake-private-key-for-testing';

describe('Authentication', () => {
  describe('generateJWT', () => {
    test('should throw error with missing appId', () => {
      expect(() => {
        generateJWT(null, 'key');
      }).toThrow('GitHub App ID and private key are required');
    });
    
    test('should throw error with missing privateKey', () => {
      expect(() => {
        generateJWT('123', null);
      }).toThrow('GitHub App ID and private key are required');
    });
  });
  
  describe('withRateLimit', () => {
    test('should execute operation successfully', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await withRateLimit(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
    
    test('should retry on rate limit error', async () => {
      const rateLimitError = {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 1
        }
      };
      
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');
      
      // Mock setTimeout for faster test
      jest.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());
      
      const result = await withRateLimit(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
      
      // Restore setTimeout
      jest.restoreAllMocks();
    });
  });
});