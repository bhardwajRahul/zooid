import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractSubdomain,
  isZoonHosted,
  syncRolesToZoon,
  listRolesFromZoon,
  createCredential,
  listCredentials,
  rotateCredential,
  revokeCredential,
} from './zoon';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('extractSubdomain', () => {
  it('extracts subdomain from *.zoon.eco URL', () => {
    expect(extractSubdomain('https://beno.zoon.eco')).toBe('beno');
  });

  it('extracts subdomain from *.zoon.eco with trailing slash', () => {
    expect(extractSubdomain('https://beno.zoon.eco/')).toBe('beno');
  });

  it('returns null for non-zoon URL', () => {
    expect(extractSubdomain('https://my-server.workers.dev')).toBeNull();
  });

  it('returns null for bare zoon.eco (no subdomain)', () => {
    expect(extractSubdomain('https://zoon.eco')).toBeNull();
  });
});

describe('isZoonHosted', () => {
  it('returns true for *.zoon.eco', () => {
    expect(isZoonHosted('https://beno.zoon.eco')).toBe(true);
  });

  it('returns false for self-hosted', () => {
    expect(isZoonHosted('https://my-zooid.workers.dev')).toBe(false);
  });
});

describe('syncRolesToZoon', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('PUTs roles to platform API', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ synced: 2, deleted: 0, warnings: [] }),
    );

    const result = await syncRolesToZoon(
      'https://beno.zoon.eco',
      'jwt_token',
      [
        { slug: 'analyst', scopes: ['sub:market-data', 'pub:signals'] },
        { slug: 'executor', scopes: ['sub:signals', 'pub:trades'] },
      ],
      { fetch: mockFetch },
    );

    expect(result.synced).toBe(2);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.zooid.dev/api/v1/servers/beno/roles');
    expect(init.method).toBe('PUT');
    expect(init.headers['Authorization']).toBe('Bearer jwt_token');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body).toHaveLength(2);
    expect(body[0].slug).toBe('analyst');
  });

  it('throws on non-zoon URL', async () => {
    await expect(
      syncRolesToZoon('https://my-server.workers.dev', 'tok', [], {
        fetch: mockFetch,
      }),
    ).rejects.toThrow('not a Zoon-hosted server');
  });
});

describe('listRolesFromZoon', () => {
  it('GETs roles from platform API', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { slug: 'analyst', name: 'Analyst', scopes: ['pub:signals'] },
        ]),
      );

    const result = await listRolesFromZoon(
      'https://beno.zoon.eco',
      'jwt_token',
      { fetch: mockFetch },
    );

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('analyst');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.zooid.dev/api/v1/servers/beno/roles',
    );
  });
});

describe('createCredential', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('POSTs to credentials endpoint and returns client_id/secret', async () => {
    // GET roles to resolve role_ids
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { slug: 'analyst', name: 'Analyst', scopes: ['pub:signals'] },
      ]),
    );
    // POST credential
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          name: 'signal-bot',
          client_id: 'sa_123',
          client_secret: 'secret_xyz',
        },
        201,
      ),
    );

    const result = await createCredential(
      'https://beno.zoon.eco',
      'jwt_token',
      'signal-bot',
      ['analyst'],
      { fetch: mockFetch },
    );

    expect(result.client_id).toBe('sa_123');
    expect(result.client_secret).toBe('secret_xyz');

    // Verify credential POST
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe('https://api.zooid.dev/api/v1/servers/beno/credentials');
    const body = JSON.parse(init.body);
    expect(body.name).toBe('signal-bot');
    expect(body.role_slugs).toEqual(['analyst']);
  });
});

describe('listCredentials', () => {
  it('GETs credentials from platform API', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          name: 'bot-1',
          client_id: 'sa_1',
          roles: [{ slug: 'analyst', name: 'Analyst' }],
          created_at: '2026-03-21T00:00:00.000Z',
        },
      ]),
    );

    const result = await listCredentials('https://beno.zoon.eco', 'jwt_token', {
      fetch: mockFetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('bot-1');
    expect(result[0].client_id).toBe('sa_1');
  });

  it('returns empty array when no credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(jsonResponse([]));

    const result = await listCredentials('https://beno.zoon.eco', 'jwt_token', {
      fetch: mockFetch,
    });

    expect(result).toHaveLength(0);
  });

  it('throws on API error', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401));

    await expect(
      listCredentials('https://beno.zoon.eco', 'jwt_token', {
        fetch: mockFetch,
      }),
    ).rejects.toThrow('Failed to list credentials: 401');
  });
});

describe('createCredential', () => {
  it('throws when no matching roles found', async () => {
    const mockFetch = vi.fn();
    // GET roles returns empty
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await expect(
      createCredential(
        'https://beno.zoon.eco',
        'jwt_token',
        'bot',
        ['nonexistent'],
        {
          fetch: mockFetch,
        },
      ),
    ).rejects.toThrow('No matching roles');
  });

  it('throws when credential creation fails', async () => {
    const mockFetch = vi.fn();
    // GET roles
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ slug: 'analyst', name: 'Analyst', scopes: ['pub:*'] }]),
    );
    // POST credential — 500
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'internal' }, 500));

    await expect(
      createCredential(
        'https://beno.zoon.eco',
        'jwt_token',
        'bot',
        ['analyst'],
        {
          fetch: mockFetch,
        },
      ),
    ).rejects.toThrow();
  });
});

describe('rotateCredential', () => {
  it('POSTs rotate and returns new secret', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ client_id: 'sa_1', client_secret: 'new_secret' }),
      );

    const result = await rotateCredential(
      'https://beno.zoon.eco',
      'jwt_token',
      'sa_1',
      { fetch: mockFetch },
    );

    expect(result.client_secret).toBe('new_secret');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.zooid.dev/api/v1/servers/beno/credentials/sa_1/rotate',
    );
  });

  it('throws on 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, 404));

    await expect(
      rotateCredential('https://beno.zoon.eco', 'jwt_token', 'nonexistent', {
        fetch: mockFetch,
      }),
    ).rejects.toThrow('Failed to rotate credential');
  });
});

describe('revokeCredential', () => {
  it('DELETEs credential', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ deleted: true }));

    await revokeCredential('https://beno.zoon.eco', 'jwt_token', 'sa_1', {
      fetch: mockFetch,
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.zooid.dev/api/v1/servers/beno/credentials/sa_1',
    );
    expect(init.method).toBe('DELETE');
  });

  it('throws on 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, 404));

    await expect(
      revokeCredential('https://beno.zoon.eco', 'jwt_token', 'nonexistent', {
        fetch: mockFetch,
      }),
    ).rejects.toThrow('Failed to revoke credential');
  });
});
