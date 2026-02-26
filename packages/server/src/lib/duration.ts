/**
 * Parse a human-friendly duration string into seconds.
 *
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 * Examples: "5m", "1h", "7d", "30d", "90s"
 */
export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `Invalid duration "${input}". Use format: <number><s|m|h|d> (e.g. "5m", "1h", "7d")`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}
