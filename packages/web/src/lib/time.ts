export function formatFull(iso: string): string {
  const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(iso);
  const ts = hasOffset ? iso : iso + 'Z';
  return new Date(ts).toLocaleString();
}

const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Extract millisecond timestamp from a ULID (first 10 chars encode 48-bit time). */
export function ulidTimestamp(ulid: string): number {
  let time = 0;
  for (let i = 0; i < 10; i++) {
    time = time * 32 + ULID_CHARS.indexOf(ulid[i].toUpperCase());
  }
  return time;
}

export function formatRelative(iso: string): string {
  const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(iso);
  const ts = hasOffset ? iso : iso + 'Z';
  return formatRelativeMs(new Date(ts).getTime());
}

export function formatRelativeUlid(ulid: string): string {
  return formatRelativeMs(ulidTimestamp(ulid));
}

function formatRelativeMs(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
