import { describe, it, expect } from 'vitest';
import { parseZooidUri, resolveRef } from './zooid-uri';

describe('parseZooidUri', () => {
  it('should parse same-server URI', () => {
    const result = parseZooidUri('zooid:signals/01HWXYZ123456789012345A');
    expect(result).toEqual({
      host: null,
      channel: 'signals',
      eventId: '01HWXYZ123456789012345A',
    });
  });

  it('should parse cross-server URI', () => {
    const result = parseZooidUri(
      'zooid:ori.zoon.eco/signals/01HWXYZ123456789012345A',
    );
    expect(result).toEqual({
      host: 'ori.zoon.eco',
      channel: 'signals',
      eventId: '01HWXYZ123456789012345A',
    });
  });

  it('should distinguish host from channel by dot presence', () => {
    const withDot = parseZooidUri(
      'zooid:my.server/chan/01HWXYZ123456789012345A',
    );
    expect(withDot?.host).toBe('my.server');

    const withoutDot = parseZooidUri(
      'zooid:my-channel/01HWXYZ123456789012345A',
    );
    expect(withoutDot?.host).toBeNull();
    expect(withoutDot?.channel).toBe('my-channel');
  });

  it('should return null for invalid URIs', () => {
    expect(parseZooidUri('not-a-uri')).toBeNull();
    expect(parseZooidUri('zooid:')).toBeNull();
    expect(parseZooidUri('zooid:only-one-part')).toBeNull();
    expect(parseZooidUri('https://example.com')).toBeNull();
  });
});

describe('resolveRef', () => {
  const currentServer = 'https://demo.zoon.eco';

  it('should resolve zooid: same-server to in-app link', () => {
    const result = resolveRef(
      'zooid:signals/01HWXYZ123456789012345A',
      currentServer,
    );
    expect(result).toEqual({
      type: 'zooid',
      label: 'signals/01HWXYZ123456789012345A',
      channel: 'signals',
      eventId: '01HWXYZ123456789012345A',
      href: null,
    });
  });

  it('should resolve zooid: cross-server to external link', () => {
    const result = resolveRef(
      'zooid:ori.zoon.eco/signals/01HWXYZ123456789012345A',
      currentServer,
    );
    expect(result).toEqual({
      type: 'zooid-external',
      label: 'ori.zoon.eco/signals/01HWXYZ123456789012345A',
      channel: 'signals',
      eventId: '01HWXYZ123456789012345A',
      href: 'https://ori.zoon.eco/api/v1/channels/signals/events/01HWXYZ123456789012345A',
    });
  });

  it('should resolve https: as external link', () => {
    const result = resolveRef('https://example.com/docs', currentServer);
    expect(result).toEqual({
      type: 'external',
      label: 'https://example.com/docs',
      href: 'https://example.com/docs',
    });
  });

  it('should resolve http: as external link', () => {
    const result = resolveRef('http://localhost:8787/test', currentServer);
    expect(result).toEqual({
      type: 'external',
      label: 'http://localhost:8787/test',
      href: 'http://localhost:8787/test',
    });
  });

  it('should resolve unknown schemes as plain text', () => {
    const result = resolveRef('ftp://files.example.com', currentServer);
    expect(result).toEqual({
      type: 'text',
      label: 'ftp://files.example.com',
    });
  });
});
