import { categorize } from "./categorize.ts";
import { cleanTitle, makeSnippet } from "./text.ts";
import type { Article, RawItem, Source } from "./types.ts";

const TRACKING = /^(utm_[a-z]+|at_[a-z_]+|traffic_source|fbclid|gclid|ref|cmpid|ocid|mc_cid|mc_eid|src|rss)$/i;

/** Canonical form of an article URL, used for dedupe: https, no www, no tracking params, no hash. */
export function canonicalUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.protocol = "https:";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** The URL we link to: the publisher's own link, minus tracking parameters. */
export function cleanLink(raw: string): string {
  try {
    const u = new URL(raw.trim());
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Small, stable string hash (FNV-1a, 32-bit) as 8 hex chars. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Parses RSS/Atom dates (RFC 822 incl. +0545, ISO 8601). Returns ms or undefined. */
export function parseDate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  let t = Date.parse(s);
  if (Number.isNaN(t)) {
    // "Sat, 10 Oct 2026 22:18:00 NPT" and similar: swap known zone names for offsets.
    const fixed = s.replace(/\b(NPT)\b/, "+0545").replace(/\b(IST)\b/, "+0530");
    t = Date.parse(fixed);
  }
  return Number.isNaN(t) ? undefined : t;
}

export interface NormalizeOptions {
  now: number;
  /** Time to use for an undated item seen for the first time (defaults to now). */
  fallbackTime?: number;
  /** Times already known for undated URLs (from the previous run), keyed by canonical URL. */
  knownTimes?: Map<string, number>;
}

/**
 * Best guess for an item without a date: the fallback time, kept inside the day named in the URL
 * (e.g. /2026/10/10/) when there is one. Day bounds are in Nepal time (UTC+5:45).
 */
export function undatedTime(url: string, fallback: number): number {
  const m = /\/(20\d\d)\/(0[1-9]|1[0-2])\/([0-2]\d|3[01])\//.exec(url);
  if (!m) return fallback;
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - (5 * 60 + 45) * 60_000;
  const end = start + 86_400_000 - 1;
  return Math.min(end, Math.max(start, fallback));
}

/** Turns a raw feed item into a clean article, or null when it is unusable. */
export function normalizeItem(raw: RawItem, source: Source, opts: NormalizeOptions): Article | null {
  const title = cleanTitle(raw.title);
  if (!title || !/^https?:\/\//i.test(raw.link.trim())) return null;
  const url = cleanLink(raw.link);
  const key = canonicalUrl(url);
  let publishedAt = parseDate(raw.date) ?? opts.knownTimes?.get(key) ?? undatedTime(url, opts.fallbackTime ?? opts.now);
  if (publishedAt > opts.now + 10 * 60_000) publishedAt = opts.now; // bad clocks / wrong zones
  const snippet = makeSnippet(raw.description || raw.content);
  const { region, topic } = categorize(source, raw.categories, url, title);
  return {
    id: hashId(key),
    sourceId: source.id,
    title,
    url,
    snippet: snippet === title ? "" : snippet,
    image: raw.image,
    publishedAt,
    lang: source.lang,
    region,
    topic,
  };
}

/** Drops repeats: the same canonical URL, or the same headline from the same outlet. Keeps the first. */
export function dedupe(articles: Article[]): Article[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Article[] = [];
  for (const a of articles) {
    const u = canonicalUrl(a.url);
    const t = a.sourceId.split("-")[0] + "|" + a.title.toLowerCase().replace(/\s+/g, " ");
    if (seenUrl.has(u) || seenTitle.has(t)) continue;
    seenUrl.add(u);
    seenTitle.add(t);
    out.push(a);
  }
  return out;
}
