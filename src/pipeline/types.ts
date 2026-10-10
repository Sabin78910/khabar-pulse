export type Lang = "ne" | "en";
export type Region = "nepal" | "world";
export type Topic = "general" | "business" | "sports" | "tech" | "entertainment";
/** The app tabs. `top` is everything, `nepal`/`world` filter by region, the rest by topic. */
export type Category = "top" | "nepal" | "world" | "business" | "sports" | "tech" | "entertainment";

export const CATEGORIES: readonly Category[] = ["top", "nepal", "world", "business", "sports", "tech", "entertainment"];

export interface Source {
  id: string;
  name: string;
  /** Name in Devanagari, shown when the UI is in Nepali. */
  nameNe?: string;
  feed: string;
  site: string;
  lang: Lang;
  region: Region;
  topic: Topic;
}

/** One entry as read from a feed, before cleaning. */
export interface RawItem {
  title: string;
  link: string;
  description: string;
  content: string;
  date?: string;
  image?: string;
  categories: string[];
}

/** A cleaned article: only what we are allowed to show (headline, short snippet, thumbnail, link). */
export interface Article {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  snippet: string;
  image?: string;
  publishedAt: number;
  lang: Lang;
  region: Region;
  topic: Topic;
}

export interface ClusterSource {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: number;
}

/** The same story reported by one or more outlets. */
export interface Cluster {
  id: string;
  title: string;
  snippet: string;
  url: string;
  sourceId: string;
  image?: string;
  lang: Lang;
  region: Region;
  topic: Topic;
  /** Newest report in the cluster (ms since epoch). */
  updatedAt: number;
  /** First report in the cluster (ms since epoch). */
  firstAt: number;
  score: number;
  /** Every report, one per URL, newest first. */
  items: ClusterSource[];
}

export interface SourceInfo {
  id: string;
  name: string;
  nameNe?: string;
  site: string;
  lang: Lang;
  region: Region;
  topic: Topic;
}

export interface NewsPayload {
  version: 1;
  generatedAt: number;
  clusters: Cluster[];
  sources: SourceInfo[];
  /** Source ids whose feed could not be fetched or parsed this run. */
  failed: string[];
}
