import type { Cluster } from "../pipeline/types.ts";

/**
 * "Today in 60 seconds": the top stories, with variety. At most `perBucket` from one region/topic bucket
 * so the briefing is not eight cricket scores, then filled up by score if there are not enough buckets.
 */
export function pickBriefing(ranked: Cluster[], size = 8, perBucket = 3): Cluster[] {
  const picked: Cluster[] = [];
  const counts = new Map<string, number>();
  for (const c of ranked) {
    if (picked.length >= size) break;
    const key = `${c.region}/${c.topic}`;
    const n = counts.get(key) ?? 0;
    if (n >= perBucket) continue;
    counts.set(key, n + 1);
    picked.push(c);
  }
  for (const c of ranked) {
    if (picked.length >= size) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

/** Seconds per card so the whole briefing takes about a minute. */
export function secondsPerCard(count: number, total = 60): number {
  return count ? Math.max(4, Math.round(total / count)) : 0;
}
