import type { NewsPayload } from "../pipeline/types.ts";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Where the live site publishes news.json (used by the Android app, which has no server of its own). */
export const PAGES_NEWS_URL = "https://sabin78910.github.io/khabar-pulse/news.json";

export function isPayload(v: unknown): v is NewsPayload {
  const p = v as NewsPayload;
  return !!p && p.version === 1 && typeof p.generatedAt === "number" && Array.isArray(p.clusters) && Array.isArray(p.sources);
}

/** Endpoints to try, best first: the Cloudflare Worker API (if configured), then the static news.json. */
export function newsEndpoints(apiUrl: string | undefined, native: boolean): string[] {
  const list: string[] = [];
  const api = apiUrl?.trim().replace(/\/+$/, "");
  if (api) list.push(`${api}/api/news`);
  list.push(native ? PAGES_NEWS_URL : "./news.json");
  return list;
}

export interface LoadResult {
  payload: NewsPayload;
  from: string;
}

/** Tries each endpoint in order and returns the first valid payload. Throws when all fail. */
export async function loadNews(endpoints: string[], fetcher: Fetcher, timeoutMs = 12_000): Promise<LoadResult> {
  let lastError: unknown = new Error("No endpoints");
  for (const url of endpoints) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // cache: "no-cache" revalidates with the server; the service worker still answers offline.
      const res = await fetcher(url, { signal: ctrl.signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const data: unknown = await res.json();
      if (!isPayload(data)) throw new Error(`Unexpected data from ${url}`);
      return { payload: data, from: url };
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
