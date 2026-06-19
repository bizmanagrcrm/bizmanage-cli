import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiService } from '../lib/src/services/api.js';
import { PushService } from '../lib/src/services/push.js';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('page push regression fixes', () => {
  const mockConfig = {
    instanceUrl: 'https://test.bizmanage.com',
    apiKey: 'test-api-key-123456'
  };

  let tempDir: string | undefined;
  let mockClient: {
    post: jest.Mock;
    get: jest.Mock;
    interceptors: {
      request: { use: jest.Mock };
      response: { use: jest.Mock };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      post: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockedAxios.create = jest.fn(() => mockClient as any);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
      tempDir = undefined;
    }
  });

  it('preserves page metadata in the push payload', async () => {
    const apiService = new ApiService(mockConfig);

    await apiService.pushPage(
      {
        url: 'fundraisers-portal',
        name: 'Fundraisers Portal',
        publihsed: false,
        render_type: 'standalone',
        access_policy: 'internal',
        data: { theme: 'dark' },
        version: 7,
        max_version: 9
      },
      '<html><body>Portal</body></html>',
      'src\\pages\\fundraisers-portal.html'
    );

    expect(mockClient.post).toHaveBeenCalledTimes(1);

    const [url, payload, requestConfig] = mockClient.post.mock.calls[0];
    expect(url).toBe('/restapi/custom-pages/by-url');
    expect(payload).toEqual({
      url: 'fundraisers-portal',
      name: 'Fundraisers Portal',
      content: '<html><body>Portal</body></html>',
      publihsed: false,
      data: { theme: 'dark' },
      access_policy: 'internal',
      render_type: 'standalone'
    });
    expect(payload).not.toHaveProperty('version');
    expect(payload).not.toHaveProperty('max_version');
    expect(requestConfig).toEqual({
      metadata: { sourceFilePath: 'src\\pages\\fundraisers-portal.html' }
    });
  });

  it('pushes paired page files once and clears both page hashes after success', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bizmanage-page-push-'));
    const pagesDir = path.join(tempDir, 'src', 'pages');
    await fs.ensureDir(pagesDir);

    await fs.writeFile(
      path.join(pagesDir, 'fundraisers-portal.html'),
      '<html><body>Fundraisers Portal</body></html>',
      'utf8'
    );
    await fs.writeJSON(
      path.join(pagesDir, 'fundraisers-portal.json'),
      {
        url: 'fundraisers-portal',
        name: 'Fundraisers Portal',
        render_type: 'standalone'
      },
      { spaces: 2 }
    );

    const pushService = new PushService(mockConfig);
    const apiService = (pushService as any).apiService as { pushPage: jest.Mock };
    apiService.pushPage = jest.fn().mockResolvedValue({});

    const firstPush = await pushService.pushChangedFiles(tempDir);

    expect(firstPush.success).toBe(true);
    expect(firstPush.errors).toHaveLength(0);
    expect(firstPush.pushedFiles).toHaveLength(1);
    expect(apiService.pushPage).toHaveBeenCalledTimes(1);
    expect(apiService.pushPage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'fundraisers-portal',
        name: 'Fundraisers Portal',
        render_type: 'standalone'
      }),
      '<html><body>Fundraisers Portal</body></html>',
      expect.stringContaining('fundraisers-portal.html')
    );

    const secondPush = await pushService.pushChangedFiles(tempDir);

    expect(secondPush.success).toBe(true);
    expect(secondPush.pushedFiles).toHaveLength(0);
    expect(secondPush.errors).toHaveLength(0);
    expect(apiService.pushPage).toHaveBeenCalledTimes(1);
  });
});
