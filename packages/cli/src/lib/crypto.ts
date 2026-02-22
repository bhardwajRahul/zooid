function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

/** Create a stateless HS256 admin JWT from the server secret. */
export async function createAdminToken(secret: string): Promise<string> {
  const header = base64url(
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        scope: 'admin',
        iat: Math.floor(Date.now() / 1000),
      }),
    ),
  );

  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  const signature = base64url(Buffer.from(sig));

  return `${data}.${signature}`;
}
