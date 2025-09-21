// Test setup file

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.GITHUB_APP_ID = process.env.GITHUB_APP_ID || '12345';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce test output noise
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});