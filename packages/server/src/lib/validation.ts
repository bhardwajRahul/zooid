/**
 * Validate a channel ID slug.
 * Rules: lowercase alphanumeric + hyphens, 3-64 chars, no leading/trailing hyphens.
 */
export function isValidChannelId(id: string): boolean {
  if (id.length < 3 || id.length > 64) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id);
}

/**
 * Validate that a webhook URL is safe to call (not targeting internal/private networks).
 * Blocks: private IPs, loopback, link-local, cloud metadata endpoints, non-http schemes.
 */
export function isAllowedWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block loopback
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return false;
  }

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return false;
  }

  // Block private/reserved IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||                          // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      a === 127 ||                          // 127.0.0.0/8
      (a === 169 && b === 254) ||          // 169.254.0.0/16 (link-local)
      a === 0                               // 0.0.0.0/8
    ) {
      return false;
    }
  }

  return true;
}
