import { BizmanageService } from '../src/services/bizmanage';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BizmanageService', () => {
  let bizmanageService: BizmanageService;
  const mockConfig = {
    instanceUrl: 'https://test.bizmanage.com',
    apiKey: 'test-api-key-123456'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return a mocked client
    const mockClient = {
      get: jest.fn(),
    };
    mockedAxios.create = jest.fn(() => mockClient as any);
    
    bizmanageService = new BizmanageService(mockConfig);
  });

  describe('ping', () => {
    it('should return success when API returns 200', async () => {
      const mockClient = mockedAxios.create();
      mockClient.get = jest.fn().mockResolvedValue({ status: 200 });

      const result = await bizmanageService.ping();

      expect(result).toEqual({
        authenticated: true,
        status: 200,
        message: 'Authentication successful',
        timestamp: expect.any(Date)
      });

      expect(mockClient.get).toHaveBeenCalledWith('/restapi/ping');
    });

    it('should return failure when API returns 403', async () => {
      const mockClient = mockedAxios.create();
      const mockError = {
        response: { status: 403 },
        message: 'Forbidden'
      };
      mockClient.get = jest.fn().mockRejectedValue(mockError);

      const result = await bizmanageService.ping();

      expect(result).toEqual({
        authenticated: false,
        status: 403,
        message: 'Authentication failed - invalid or expired credentials',
        timestamp: expect.any(Date)
      });
    });

    it('should return failure when API returns 401', async () => {
      const mockClient = mockedAxios.create();
      const mockError = {
        response: { status: 401 },
        message: 'Unauthorized'
      };
      mockClient.get = jest.fn().mockRejectedValue(mockError);

      const result = await bizmanageService.ping();

      expect(result).toEqual({
        authenticated: false,
        status: 401,
        message: 'Unauthorized - missing or invalid API key',
        timestamp: expect.any(Date)
      });
    });

    it('should handle network errors', async () => {
      const mockClient = mockedAxios.create();
      const mockError = {
        message: 'Network Error'
      };
      mockClient.get = jest.fn().mockRejectedValue(mockError);

      const result = await bizmanageService.ping();

      expect(result).toEqual({
        authenticated: false,
        status: 0,
        message: 'Network error: Network Error',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('testConnection', () => {
    it('should return success with response time when authenticated', async () => {
      const mockClient = mockedAxios.create();
      mockClient.get = jest.fn().mockResolvedValue({ status: 200 });

      const result = await bizmanageService.testConnection();

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toBe('Authentication successful');
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should return failure with response time when not authenticated', async () => {
      const mockClient = mockedAxios.create();
      const mockError = {
        response: { status: 403 },
        message: 'Forbidden'
      };
      mockClient.get = jest.fn().mockRejectedValue(mockError);

      const result = await bizmanageService.testConnection();

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.message).toBe('Authentication failed - invalid or expired credentials');
      expect(result.responseTime).toBeGreaterThan(0);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const result = bizmanageService.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate configuration without instance URL', () => {
      const invalidService = new BizmanageService({
        instanceUrl: '',
        apiKey: 'test-key'
      });

      const result = invalidService.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Instance URL is required');
    });

    it('should invalidate configuration with invalid URL', () => {
      const invalidService = new BizmanageService({
        instanceUrl: 'not-a-url',
        apiKey: 'test-key'
      });

      const result = invalidService.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Instance URL must start with http:// or https://');
    });

    it('should invalidate configuration without API key', () => {
      const invalidService = new BizmanageService({
        instanceUrl: 'https://test.com',
        apiKey: ''
      });

      const result = invalidService.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API key is required');
    });

    it('should invalidate configuration with short API key', () => {
      const invalidService = new BizmanageService({
        instanceUrl: 'https://test.com',
        apiKey: 'short'
      });

      const result = invalidService.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API key appears to be too short');
    });
  });

  describe('getApiKeyInfo', () => {
    it('should mask long API key correctly', () => {
      const result = bizmanageService.getApiKeyInfo();

      expect(result.hasKey).toBe(true);
      expect(result.preview).toBe('test***3456');
    });

    it('should mask short API key', () => {
      const shortKeyService = new BizmanageService({
        instanceUrl: 'https://test.com',
        apiKey: 'short'
      });

      const result = shortKeyService.getApiKeyInfo();

      expect(result.hasKey).toBe(true);
      expect(result.preview).toBe('****');
    });

    it('should handle missing API key', () => {
      const noKeyService = new BizmanageService({
        instanceUrl: 'https://test.com',
        apiKey: ''
      });

      const result = noKeyService.getApiKeyInfo();

      expect(result.hasKey).toBe(false);
      expect(result.preview).toBe('');
    });
  });

  describe('getInstanceUrl', () => {
    it('should return the configured instance URL', () => {
      const url = bizmanageService.getInstanceUrl();
      expect(url).toBe('https://test.bizmanage.com');
    });
  });
});
