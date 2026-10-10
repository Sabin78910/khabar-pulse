import { hashId } from "./normalize.ts";
import type { Article, Cluster, Region, Source, Topic } from "./types.ts";

const HOUR = 3600_000;

/**
 * Hotness = coverage × freshness. Coverage grows with the number of distinct outlets (diminishing returns),
 * freshness halves roughly every 6 hours after the newest report.
 */
export function scoreCluster(outlets: number, reports: number, newestAt: number, now: number): number {
  const coverage = Math.pow(Math.max(1, outlets), 0.9) + 0.15 * Math.max(0, reports - outlets);
  const ageH = Math.max(0, (now - newestAt) / HOUR);
  const freshness = Math.pow(0.5, ageH / 6);
  return Math.round(coverage * freshness * 1000) / 1000;
}

function majority<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let n = 0;
  for (const [v, c] of counts) {
    if (c > n) {
      best = v;
      n = c;
    }
  }
  return best;
}

/** The report that represents a cluster: has an image and a snippet, then comes from the earliest report. */
export function pickLead(group: Article[]): Article {
  return [...group].sort((a, b) => {
    const qa = (a.image ? 2 : 0) + (a.snippet ? 1 : 0);
    const qb = (b.image ? 2 : 0) + (b.snippet ? 1 : 0);
    return qb - qa || a.publishedAt - b.publishedAt;
  })[0];
}

/** Turns a group of articles into a ranked cluster. `outletOf` maps a source id to its outlet name. */
export function toCluster(group: Article[], now: number, outletOf: (sourceId: string) => string): Cluster {
  const lead = pickLead(group);
  const items = [...group]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map((a) => ({ sourceId: a.sourceId, title: a.title, url: a.url, publishedAt: a.publishedAt }));
  const outlets = new Set(group.map((a) => outletOf(a.sourceId))).size;
  const updatedAt = Math.max(...group.map((a) => a.publishedAt));
  const firstAt = Math.min(...group.map((a) => a.publishedAt));
  // A specific topic needs at least half the reports to agree, so one business outlet covering
  // a political story does not move it to the Business tab.
  const topics = group.map((a) => a.topic).filter((t) => t !== "general");
  const top = topics.length ? majority(topics) : "general";
  const topic: Topic = topics.filter((t) => t === top).length * 2 >= group.length ? top : "general";
  const region: Region = majority(group.map((a) => a.region));
  return {
    // Keyed by the first report, so the id stays stable as later reports join the story.
    id: hashId([...group].sort((a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id))[0].id),
    title: lead.title,
    snippet: lead.snippet,
    url: lead.url,
    sourceId: lead.sourceId,
    image: group.find((a) => a.id === lead.id)?.image ?? group.find((a) => a.image)?.image,
    lang: lead.lang,
    region,
    topic,
    updatedAt,
    firstAt,
    score: scoreCluster(outlets, group.length, updatedAt, now),
    items,
  };
}

export function outletLookup(sources: Source[]): (id: string) => string {
  const byId = new Map(sources.map((s) => [s.id, s.name]));
  return (id) => byId.get(id) ?? id;
}

/** Sorts by score, newest first on ties. */
export function rankClusters(clusters: Cluster[]): Cluster[] {
  return [...clusters].sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}
