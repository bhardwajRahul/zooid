export function printSuccess(message: string): void {
  console.log(`\u2713 ${message}`);
}

export function printError(message: string): void {
  console.error(`\u2717 ${message}`);
}

export function printInfo(label: string, value: string): void {
  console.log(`  ${label}: ${value}`);
}

export function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
