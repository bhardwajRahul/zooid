/**
 * Manages OAuth client_credentials token exchange for M2M authentication.
 *
 * Handles token endpoint discovery (via /.well-known/zooid.json → OIDC discovery),
 * credential exchange, caching, and automatic refresh before expiry.
 */
export class OAuthTokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;
  private tokenEndpoint?: string;

  constructor(
    private serverUrl: string,
    private clientId: string,
    private clientSecret: string,
    private _fetch: typeof globalThis.fetch,
    tokenEndpoint?: string,
  ) {
    this.tokenEndpoint = tokenEndpoint;
  }

  /**
   * Get a valid access token. Returns a cached token if still fresh,
   * or exchanges credentials for a new one.
   */
  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 30_000) {
      return this.accessToken;
    }
    return this.refresh();
  }

  /**
   * Discover the token endpoint from the server's well-known metadata
   * and the OIDC provider's openid-configuration.
   */
  private async discover(): Promise<string> {
    const wellKnownRes = await this._fetch(
      `${this.serverUrl}/.well-known/zooid.json`,
    );
    const wellKnown = (await wellKnownRes.json()) as Record<string, unknown>;
    const authUrl = wellKnown.auth_url as string | undefined;
    if (!authUrl) {
      throw new Error('Server has no auth_url in /.well-known/zooid.json');
    }
    const issuer = new URL(authUrl).origin;
    const oidcRes = await this._fetch(
      `${issuer}/.well-known/openid-configuration`,
    );
    const oidcConfig = (await oidcRes.json()) as Record<string, unknown>;
    return oidcConfig.token_endpoint as string;
  }

  /** Exchange client credentials for a new access token. */
  private async refresh(): Promise<string> {
    if (!this.tokenEndpoint) {
      this.tokenEndpoint = await this.discover();
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await this._fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`OAuth token exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in ?? 300) * 1000;
    return this.accessToken;
  }
}
