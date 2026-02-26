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

/** Create an EdDSA admin JWT signed with an Ed25519 private key. */
export async function createEdDSAAdminToken(
  privateKeyJwk: JsonWebKey,
  kid: string,
): Promise<string> {
  const header = base64url(
    Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid })),
  );
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        scope: 'admin',
        iat: Math.floor(Date.now() / 1000),
      }),
    ),
  );

  const message = `${header}.${payload}`;
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(message),
  );
  const signature = base64url(Buffer.from(sig));

  return `${message}.${signature}`;
}
