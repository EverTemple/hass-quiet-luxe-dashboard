import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogueLoadError, loadCatalogue, resetCatalogueCache } from './ktv-catalogue';
import { CATALOGUE_FIELDS, CatalogueFormatError } from './ktv-search';

function payload(version: string): Record<string, unknown> {
  return {
    v: version,
    built: '2026-11-11T00:00:00.000Z',
    langs: { '1': 'Mandarin' },
    fields: [...CATALOGUE_FIELDS],
    rows: [['1', '富士山下', '陈奕迅', '', 2, 'fssx', 'cyx', 999998]],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('loadCatalogue', () => {
  beforeEach(() => {
    resetCatalogueCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetCatalogueCache();
  });

  it('fetches the url same-origin and parses the catalogue', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse(payload('a')));
    const catalogue = await loadCatalogue('/local/ktv/catalogue.json?v=a', 'a', fetchStub);
    expect(fetchStub).toHaveBeenCalledWith('/local/ktv/catalogue.json?v=a', {
      credentials: 'same-origin',
    });
    expect(catalogue.version).toBe('a');
    expect(catalogue.songs[0]?.title).toBe('富士山下');
  });

  it('uses the global fetch by default, resolved at call time', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse(payload('g')));
    vi.stubGlobal('fetch', fetchStub);
    await loadCatalogue('/x.json', 'g');
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('downloads once per version, including concurrent callers', async () => {
    const fetchStub = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(payload('a'))));
    const [first, second] = await Promise.all([
      loadCatalogue('/c.json', 'a', fetchStub),
      loadCatalogue('/c.json', 'a', fetchStub),
    ]);
    await loadCatalogue('/c.json', 'a', fetchStub);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('refetches when the version changes', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(payload('a')))
      .mockResolvedValueOnce(jsonResponse(payload('b')));
    await loadCatalogue('/c.json?v=a', 'a', fetchStub);
    const next = await loadCatalogue('/c.json?v=b', 'b', fetchStub);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(next.version).toBe('b');
  });

  it('rejects on a network failure and retries on the next call', async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse(payload('a')));
    await expect(loadCatalogue('/c.json', 'a', fetchStub)).rejects.toThrow(CatalogueLoadError);
    const catalogue = await loadCatalogue('/c.json', 'a', fetchStub);
    expect(catalogue.version).toBe('a');
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('rejects on an HTTP error status without caching it', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(payload('a')));
    await expect(loadCatalogue('/c.json', 'a', fetchStub)).rejects.toThrow('HTTP 404');
    await expect(loadCatalogue('/c.json', 'a', fetchStub)).resolves.toBeDefined();
  });

  it('rejects on a body that is not JSON', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(loadCatalogue('/c.json', 'a', fetchStub)).rejects.toThrow('not valid JSON');
  });

  it('rejects on a catalogue whose format does not validate', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse({ ...payload('a'), fields: ['no'] }));
    await expect(loadCatalogue('/c.json', 'a', fetchStub)).rejects.toThrow(CatalogueFormatError);
  });

  it('refuses a cross-origin url without fetching or caching it', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse(payload('a')));
    await expect(
      loadCatalogue('https://evil.example/catalogue.json', 'a', fetchStub),
    ).rejects.toThrow('cross-origin');
    await expect(
      loadCatalogue('//evil.example/catalogue.json', 'a', fetchStub),
    ).rejects.toThrow('cross-origin');
    expect(fetchStub).not.toHaveBeenCalled();
    await expect(loadCatalogue('/local/c.json', 'a', fetchStub)).resolves.toBeDefined();
  });

  it('accepts an absolute url on this origin', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse(payload('a')));
    await expect(
      loadCatalogue(`${location.origin}/local/c.json`, 'a', fetchStub),
    ).resolves.toBeDefined();
  });
});
