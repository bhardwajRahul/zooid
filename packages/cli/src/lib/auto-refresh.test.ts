import { describe, it, expect, vi } from 'vitest';
import { maybeRefreshToken } from './auto-refresh';

describe('maybeRefreshToken', () => {
  it('does nothing if auth_method is not oidc', async () => {
    const saveFn = vi.fn();
    await maybeRefreshToken(
      {
        admin_token: 'eyJ...',
        auth_method: 'token',
      },
      'https://beno.zoon.eco',
      { save: saveFn },
    );
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('does nothing if token has plenty of time left', async () => {
    // Create a JWT with exp 10 minutes from now (well outside 2-min buffer)
    const exp = Math.floor(Date.now() / 1000) + 600;
    const payload = btoa(JSON.stringify({ exp }));
    const fakeJwt = `eyJ.${payload}.sig`;

    const saveFn = vi.fn();
    await maybeRefreshToken(
      {
        admin_token: fakeJwt,
        auth_method: 'oidc',
      },
      'https://beno.zoon.eco',
      { save: saveFn },
    );
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('prints re-login message when token is near expiry', async () => {
    // Create a JWT expiring in 90 seconds (within 2-min buffer)
    const exp = Math.floor(Date.now() / 1000) + 90;
    const payload = btoa(JSON.stringify({ exp }));
    const fakeJwt = `eyJ.${payload}.sig`;

    const writeSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const saveFn = vi.fn();

    await maybeRefreshToken(
      {
        admin_token: fakeJwt,
        auth_method: 'oidc',
      },
      'https://beno.zoon.eco',
      { save: saveFn },
    );

    expect(saveFn).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith(
      'Session expired. Run `npx zooid login` to re-authenticate.\n',
    );
    writeSpy.mockRestore();
  });
});
