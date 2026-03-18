export interface ZooidUri {
  host: string | null;
  channel: string;
  eventId: string;
}

export type ResolvedRef =
  | {
      type: 'zooid';
      label: string;
      channel: string;
      eventId: string;
      href: null;
    }
  | {
      type: 'zooid-external';
      label: string;
      channel: string;
      eventId: string;
      href: string;
    }
  | { type: 'external'; label: string; href: string }
  | { type: 'text'; label: string };

export function parseZooidUri(uri: string): ZooidUri | null {
  if (!uri.startsWith('zooid:')) return null;

  const path = uri.slice('zooid:'.length);
  if (!path) return null;
  const segments = path.split('/');

  if (segments.length === 2) {
    const [channel, eventId] = segments;
    if (!channel || !eventId) return null;
    return { host: null, channel, eventId };
  }

  if (segments.length === 3) {
    const [host, channel, eventId] = segments;
    if (!host || !channel || !eventId) return null;
    if (!host.includes('.')) return null;
    return { host, channel, eventId };
  }

  return null;
}

export function resolveRef(ref: string, currentServer: string): ResolvedRef {
  const zooid = parseZooidUri(ref);
  if (zooid) {
    if (zooid.host) {
      return {
        type: 'zooid-external',
        label: `${zooid.host}/${zooid.channel}/${zooid.eventId}`,
        channel: zooid.channel,
        eventId: zooid.eventId,
        href: `https://${zooid.host}/api/v1/channels/${zooid.channel}/events/${zooid.eventId}`,
      };
    }
    return {
      type: 'zooid',
      label: `${zooid.channel}/${zooid.eventId}`,
      channel: zooid.channel,
      eventId: zooid.eventId,
      href: null,
    };
  }

  if (ref.startsWith('https://') || ref.startsWith('http://')) {
    return { type: 'external', label: ref, href: ref };
  }

  return { type: 'text', label: ref };
}
