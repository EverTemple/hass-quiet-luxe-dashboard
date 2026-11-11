import { parseCatalogue, type Catalogue } from './ktv-search';

export class CatalogueLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`ktv catalogue: ${message}`, options);
    this.name = 'CatalogueLoadError';
  }
}

/** The subset of `fetch` the loader needs; tests pass a stub or use `vi.stubGlobal('fetch', ...)`. */
export type CatalogueFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * One in-flight or settled download per catalogue version, shared by every card
 * on the page. The file is about 3.6 MB, so two cards (or a card remounted by
 * HA's edit mode) must not fetch it twice. Only the newest version is kept: a
 * version change means the previous index can never be asked for again.
 */
const cache = new Map<string, Promise<Catalogue>>();

async function download(url: string, fetchImpl: CatalogueFetch): Promise<Catalogue> {
  let response: Response;
  try {
    response = await fetchImpl(url, { credentials: 'same-origin' });
  } catch (error) {
    throw new CatalogueLoadError(`request for ${url} failed`, { cause: error });
  }
  if (!response.ok) {
    throw new CatalogueLoadError(`request for ${url} returned HTTP ${String(response.status)}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new CatalogueLoadError(`${url} is not valid JSON`, { cause: error });
  }
  return parseCatalogue(body);
}

/**
 * Loads and indexes the catalogue published at `url`. `version` is the cache key
 * (the sensor's `catalogue_version`); a failure is not cached, so the next call
 * retries. `fetchImpl` defaults to the global `fetch`, looked up at call time.
 */
export function loadCatalogue(
  url: string,
  version: string,
  fetchImpl: CatalogueFetch = (input, init) => fetch(input, init),
): Promise<Catalogue> {
  // The file is fetched with the user's cookies, so only this origin is allowed;
  // a url from a sensor attribute must not be able to point the card elsewhere.
  try {
    if (new URL(url, location.href).origin !== location.origin) {
      return Promise.reject(new CatalogueLoadError(`refusing cross-origin url ${url}`));
    }
  } catch (error) {
    return Promise.reject(new CatalogueLoadError(`${url} is not a valid url`, { cause: error }));
  }
  const cached = cache.get(version);
  if (cached !== undefined) {
    return cached;
  }
  cache.clear();
  const pending = download(url, fetchImpl);
  cache.set(version, pending);
  pending.catch(() => {
    if (cache.get(version) === pending) {
      cache.delete(version);
    }
  });
  return pending;
}

/** Test seam: forgets every cached download. */
export function resetCatalogueCache(): void {
  cache.clear();
}
