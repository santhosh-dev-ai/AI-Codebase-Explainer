import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionToken, setSessionToken, clearSessionToken, apiClient } from '@/lib/api-client';

describe('API Client & Session Token Authentication (REL-01, REL-04)', () => {
  const testSessionId = '12345678-1234-1234-1234-123456789abc';
  const testToken = 'signed.token.entropy123';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and retrieves session tokens via sessionStorage', () => {
    expect(getSessionToken(testSessionId)).toBeNull();

    setSessionToken(testSessionId, testToken);
    expect(getSessionToken(testSessionId)).toBe(testToken);
  });

  it('clears session tokens reliably with clearSessionToken', () => {
    setSessionToken(testSessionId, testToken);
    expect(getSessionToken(testSessionId)).toBe(testToken);

    clearSessionToken(testSessionId);
    expect(getSessionToken(testSessionId)).toBeNull();
  });

  it('attaches X-Session-Token and Bearer authorization header when sessionId is in URL', async () => {
    setSessionToken(testSessionId, testToken);

    const clientInstance = (apiClient as any).client;
    const requestInterceptor = clientInstance.interceptors.request.handlers[0].fulfilled;

    const dummyConfig = {
      url: `/api/repository/${testSessionId}/tree`,
      headers: {} as Record<string, string>,
    };

    const updatedConfig = await requestInterceptor(dummyConfig);

    expect(updatedConfig.headers['X-Session-Token']).toBe(testToken);
    expect(updatedConfig.headers['Authorization']).toBe(`Bearer ${testToken}`);
  });

  it('preserves error HTTP status code on rejected promises (REL-05)', async () => {
    const clientInstance = (apiClient as any).client;
    const responseInterceptorErr = clientInstance.interceptors.response.handlers[0].rejected;

    const mockAxiosError = {
      response: {
        status: 401,
        data: {
          error: {
            message: 'Session access token is required. Please provide a valid Authorization or X-Session-Token header.',
          },
        },
      },
    };

    await expect(responseInterceptorErr(mockAxiosError)).rejects.toMatchObject({
      message: 'Session access token is required. Please provide a valid Authorization or X-Session-Token header.',
      statusCode: 401,
      status: 401,
    });
  });
});
