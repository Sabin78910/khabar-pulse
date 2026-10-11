import { clusterArticles } from "./cluster.ts";
import { canonicalUrl, dedupe, normalizeItem } from "./normalize.ts";
import { outletLookup, rankClusters, toCluster } from "./rank.ts";
import { parseFeed } from "./rss.ts";
import type { Article, Category, Cluster, Lang, NewsPayload, Source } from "./types.ts";

export interface FeedResult {
  source: Source;
  xml?: string;
  error?: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const USER_AGENT = "KhabarPulse/1.0 (+https://github.com/Sabin78910/khabar-pulse; RSS reader)";

/** Downloads one feed with a timeout. Never throws. */
export async function fetchFeed(source: Source, fetcher: Fetcher, timeoutMs = 15_000): Promise<FeedResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(source.feed, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
      redirect: "follow",
    });
    if (!res.ok) return { source, error: `HTTP ${res.status}` };
    return { source, xml: await res.text() };
  } catch (e) {
    return { source, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches every feed in parallel (bounded). */
export async function fetchAll(sources: Source[], fetcher: Fetcher, concurrency = 8): Promise<FeedResult[]> {
  const out: FeedResult[] = new Array(sources.length);
  let next = 0;
  const worker = async () => {
    while (next < sources.length) {
      const i = next++;
      out[i] = await fetchFeed(sources[i], fetcher);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  return out;
}

export interface BuildOptions {
  now: number;
  /** Only keep reports newer than this many hours. */
  maxAgeHours?: number;
  maxClusters?: number;
  /** Max reports kept per feed (feeds list newest first). */
  perFeed?: number;
  previous?: NewsPayload;
}

/** Publish times we already assigned to undated URLs last run, so they don't look "just now" forever. */
export function knownTimesFrom(previous: NewsPayload | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of previous?.clusters ?? []) for (const it of c.items) m.set(canonicalUrl(it.url), it.publishedAt);
  return m;
}

/** Parse → normalize → dedupe → cluster → rank. Pure: no I/O. */
export function buildNews(feeds: FeedResult[], sources: Source[], opts: BuildOptions): NewsPayload {
  const { now } = opts;
  const maxAge = (opts.maxAgeHours ?? 36) * 3600_000;
  const perFeed = opts.perFeed ?? 40;
  const knownTimes = knownTimesFrom(opts.previous);
  const failed: string[] = [];
  const articles: Article[] = [];
  for (const f of feeds) {
    if (!f.xml) {
      failed.push(f.source.id);
      continue;
    }
    const raw = parseFeed(f.xml);
    if (!raw.length) {
      failed.push(f.source.id);
      continue;
    }
    // Feeds list newest first, so undated items are spaced 20 minutes apart from now.
    raw.slice(0, perFeed).forEach((r, i) => {
      const a = normalizeItem(r, f.source, { now, knownTimes, fallbackTime: now - i * 20 * 60_000 });
      if (a && now - a.publishedAt <= maxAge) articles.push(a);
    });
  }
  const unique = dedupe(articles);
  const outletOf = outletLookup(sources);
  const clusters = rankClusters(clusterArticles(unique).map((g) => toCluster(g, now, outletOf))).slice(
    0,
    opts.maxClusters ?? 300,
  );
  return {
    version: 1,
    generatedAt: now,
    clusters,
    sources: sources.map(({ id, name, nameNe, site, lang, region, topic, owner, country }) => ({ id, name, nameNe, site, lang, region, topic, owner, country })),
    failed,
  };
}

/** Full run: fetch every source and build the payload. */
export async function runPipeline(sources: Source[], fetcher: Fetcher, opts: BuildOptions): Promise<NewsPayload> {
  const feeds = await fetchAll(sources, fetcher);
  return buildNews(feeds, sources, opts);
}

export interface Filter {
  cat?: Category;
  lang?: Lang | "all";
  q?: string;
}

/** Tab / language / search filter, shared by the Worker API and the app. */
export function filterClusters(clusters: Cluster[], f: Filter): Cluster[] {
  const q = f.q?.trim().toLowerCase();
  return clusters.filter((c) => {
    if (f.lang && f.lang !== "all" && c.lang !== f.lang) return false;
    switch (f.cat ?? "top") {
      case "top":
        break;
      case "nepal":
        if (c.region !== "nepal") return false;
        break;
      case "world":
        if (c.region !== "world") return false;
        break;
      default:
        if (c.topic !== f.cat) return false;
    }
    if (q) {
      const hay = (c.title + " " + c.snippet + " " + c.items.map((i) => i.title).join(" ")).toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  });
}

export function parseCategory(v: string | null | undefined): Category {
  const all: Category[] = ["top", "nepal", "world", "business", "sports", "tech", "entertainment"];
  return all.includes(v as Category) ? (v as Category) : "top";
}

export function parseLang(v: string | null | undefined): Lang | "all" {
  return v === "ne" || v === "en" ? v : "all";
}
