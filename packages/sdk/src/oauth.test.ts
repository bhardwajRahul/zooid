import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthTokenManager } from './oauth';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OAuthTokenManager', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with explicit tokenEndpoint', () => {
    it('exchanges credentials for an access token', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ access_token: 'tok_123', expires_in: 300 }),
      );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      const token = await mgr.getToken();
      expect(token).toBe('tok_123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://accounts.zooid.dev/api/auth/oauth2/token');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      );
      const body = new URLSearchParams(init.body);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe('sa_client');
      expect(body.get('client_secret')).toBe('secret_abc');
    });

    it('caches the token and does not re-fetch when fresh', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ access_token: 'tok_123', expires_in: 300 }),
      );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      const t1 = await mgr.getToken();
      const t2 = await mgr.getToken();
      expect(t1).toBe('tok_123');
      expect(t2).toBe('tok_123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes when token is within 30s of expiry', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'tok_1', expires_in: 300 }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'tok_2', expires_in: 300 }),
        );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      const t1 = await mgr.getToken();
      expect(t1).toBe('tok_1');

      // Advance time to 271s later (within 30s of 300s expiry)
      vi.advanceTimersByTime(271_000);

      const t2 = await mgr.getToken();
      expect(t2).toBe('tok_2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not refresh when token has plenty of time left', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ access_token: 'tok_1', expires_in: 300 }),
      );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      await mgr.getToken();
      // Advance 200s — still 100s left, well outside 30s buffer
      vi.advanceTimersByTime(200_000);
      await mgr.getToken();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on non-200 response from token endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'invalid_client' }, 401),
      );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'bad_secret',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      await expect(mgr.getToken()).rejects.toThrow(
        'OAuth token exchange failed: 401',
      );
    });

    it('defaults expires_in to 300 when not provided', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'tok_1' }), // no expires_in
        )
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok_2' }));

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );

      await mgr.getToken();
      // 271s into a 300s default window — should refresh
      vi.advanceTimersByTime(271_000);
      const t2 = await mgr.getToken();
      expect(t2).toBe('tok_2');
    });
  });

  describe('with auto-discovery', () => {
    it('discovers token endpoint from well-known and OIDC config', async () => {
      // 1. GET /.well-known/zooid.json
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          version: '0.1',
          auth_url: 'https://accounts.zooid.dev/api/auth',
        }),
      );
      // 2. GET /.well-known/openid-configuration
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          token_endpoint: 'https://accounts.zooid.dev/api/auth/oauth2/token',
        }),
      );
      // 3. POST token exchange
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ access_token: 'tok_discovered', expires_in: 300 }),
      );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
      );

      const token = await mgr.getToken();
      expect(token).toBe('tok_discovered');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://beno.zoon.eco/.well-known/zooid.json',
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://accounts.zooid.dev/.well-known/openid-configuration',
      );
      expect(mockFetch.mock.calls[2][0]).toBe(
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );
    });

    it('caches discovered endpoint across refreshes', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ auth_url: 'https://accounts.zooid.dev/api/auth' }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            token_endpoint: 'https://accounts.zooid.dev/api/auth/oauth2/token',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'tok_1', expires_in: 60 }),
        )
        // Second refresh — only token exchange, no discovery
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'tok_2', expires_in: 60 }),
        );

      const mgr = new OAuthTokenManager(
        'https://beno.zoon.eco',
        'sa_client',
        'secret_abc',
        mockFetch,
      );

      await mgr.getToken();
      vi.advanceTimersByTime(31_000); // past 30s buffer on 60s token
      await mgr.getToken();

      // 2 discovery + 2 token exchange = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
      // Second refresh should hit token endpoint directly (call index 3)
      expect(mockFetch.mock.calls[3][0]).toBe(
        'https://accounts.zooid.dev/api/auth/oauth2/token',
      );
    });

    it('throws when server has no auth_url', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ version: '0.1' }), // no auth_url
      );

      const mgr = new OAuthTokenManager(
        'https://self-hosted.example.com',
        'sa_client',
        'secret_abc',
        mockFetch,
      );

      await expect(mgr.getToken()).rejects.toThrow(
        'Server has no auth_url in /.well-known/zooid.json',
      );
    });
  });
});
