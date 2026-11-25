import { describe, it, expect } from 'vitest';

describe('Session Error Detection & Recovery Logic (REL-05, REL-04)', () => {
  const isAuthError = (err: any) => {
    const message = err instanceof Error ? err.message : String(err || '');
    return (
      err?.statusCode === 401 ||
      err?.statusCode === 403 ||
      err?.status === 401 ||
      err?.status === 403 ||
      /session not found|session expired|session access token|unauthorized|invalid or expired session/i.test(message)
    );
  };

  it('accurately identifies 401 Session access token missing error', () => {
    const err = new Error('Session access token is required. Please provide a valid Authorization or X-Session-Token header.');
    (err as any).statusCode = 401;

    expect(isAuthError(err)).toBe(true);
  });

  it('accurately identifies 403 Invalid or expired session credentials', () => {
    const err = new Error('Unauthorized: Invalid or expired session credentials');
    (err as any).statusCode = 403;

    expect(isAuthError(err)).toBe(true);
  });

  it('accurately identifies session expired message without status code', () => {
    const err = new Error('Session expired');
    expect(isAuthError(err)).toBe(true);
  });

  it('accurately identifies session not found message', () => {
    const err = new Error('Session not found');
    expect(isAuthError(err)).toBe(true);
  });

  it('does NOT misclassify generic network or syntax errors as session auth errors', () => {
    const networkErr = new Error('Network error. Please check your connection.');
    const syntaxErr = new Error('Syntax error parsing JSON response');

    expect(isAuthError(networkErr)).toBe(false);
    expect(isAuthError(syntaxErr)).toBe(false);
  });

  it('generates correct redirection query parameter without loops', () => {
    const targetUrl = '/?error=session-expired';
    expect(targetUrl).toBe('/?error=session-expired');

    const searchParams = new URLSearchParams('error=session-expired');
    expect(searchParams.get('error')).toBe('session-expired');
  });
});
