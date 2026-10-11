import { tokenize } from "../pipeline/cluster.ts";
import type { Cluster } from "../pipeline/types.ts";

export const TRENDING_WINDOW_MS = 6 * 3_600_000;

/** Words that appear in almost every headline and say nothing about the story. */
const GENERIC = new Set(["nepal", "nepali", "नेपाल", "नेपाली", "news", "today", "आज", "खबर", "समाचार", "सरकार", "government", "minister", "मन्त्री", "people"]);

/** Splits a headline into words in their original script and case, punctuation removed. */
function words(title: string): { raw: string; key: string }[] {
  const out: { raw: string; key: string }[] = [];
  for (const raw of title.normalize("NFC").split(/[^\p{L}\p{N}ऀ-ॿ‌‍]+/u)) {
    if (!raw) continue;
    const key = tokenize(raw)[0];
    if (!key || GENERIC.has(key) || GENERIC.has(raw.toLowerCase())) {
      out.push({ raw, key: "" });
      continue;
    }
    out.push({ raw, key });
  }
  return out;
}

interface Entry {
  display: string;
  score: number;
  size: number;
  keys: string[];
}

/** Most mentioned terms in clusters updated within the last 6 h, weighted by number of outlets. */
export function trendingTopics(clusters: Cluster[], now: number, limit: number): string[] {
  const terms = new Map<string, Entry>();
  for (const cl of clusters) {
    if (now - cl.updatedAt > TRENDING_WINDOW_MS || cl.updatedAt > now + 60_000) continue;
    const weight = Math.max(1, new Set(cl.items.map((i) => i.sourceId)).size);
    const ws = words(cl.title);
    const seen = new Set<string>();
    const add = (keys: string[], display: string) => {
      const id = keys.join(" ");
      if (seen.has(id)) return;
      seen.add(id);
      const e = terms.get(id);
      if (e) e.score += weight;
      else terms.set(id, { display, score: weight, size: keys.length, keys });
    };
    ws.forEach((w, i) => {
      if (!w.key) return;
      add([w.key], w.raw);
      const n = ws[i + 1];
      if (n?.key) add([w.key, n.key], `${w.raw} ${n.raw}`);
    });
  }
  const ranked = [...terms.values()]
    .filter((e) => e.score >= 2)
    .sort((a, b) => b.score - a.score || b.size - a.size || a.display.localeCompare(b.display));
  const out: Entry[] = [];
  for (const e of ranked) {
    if (out.length >= limit) break;
    // A name already shown as a phrase should not repeat as a single word, or vice versa.
    if (out.some((o) => (o.size > e.size ? e.keys.every((k) => o.keys.includes(k)) : o.keys.every((k) => e.keys.includes(k))))) continue;
    out.push(e);
  }
  return out.map((e) => e.display);
}
