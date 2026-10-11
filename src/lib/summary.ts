import { tokenize } from "../pipeline/cluster.ts";
import type { Cluster } from "../pipeline/types.ts";

export const MAX_SUMMARY = 280;
const MAX_SENTENCES = 2;

interface Candidate {
  text: string;
  /** Which report it came from: "s" for the lead snippet, else the item index. */
  report: string;
  tokens: Set<string>;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const terminate = (s: string) => (/[.!?।…]$/.test(s) ? s : `${s}.`);

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Extractive "What we know" summary: up to two sentences, taken from our own headlines and snippets, that
 * share the most tokens with the other reports. No network, no model. Empty unless 2+ outlets reported it.
 */
export function summarizeCluster(cluster: Cluster): string {
  if (new Set(cluster.items.map((i) => i.sourceId)).size < 2) return "";

  const raw: { text: string; report: string }[] = cluster.items.map((it, i) => ({ text: it.title, report: String(i) }));
  for (const s of sentences(cluster.snippet)) raw.push({ text: s, report: "s" });
  const cands: Candidate[] = raw
    .map((r) => ({ ...r, tokens: new Set(tokenize(r.text)) }))
    .filter((c) => c.tokens.size >= 2);

  const scored = cands
    .map((c) => {
      let score = 0;
      for (const t of c.tokens) {
        const reports = new Set(cands.filter((o) => o.report !== c.report && o.tokens.has(t)).map((o) => o.report));
        score += reports.size;
      }
      return { c, score: score / Math.sqrt(c.tokens.size) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: Candidate[] = [];
  const parts: string[] = [];
  let len = 0;
  for (const { c } of scored) {
    if (parts.length >= MAX_SENTENCES) break;
    // skip near-duplicates of a sentence we already have
    const dup = picked.some((p) => {
      let shared = 0;
      for (const t of c.tokens) if (p.tokens.has(t)) shared++;
      return shared / Math.min(c.tokens.size, p.tokens.size) > 0.7;
    });
    if (dup) continue;
    const sentence = terminate(c.text.trim());
    const room = MAX_SUMMARY - len - (parts.length ? 1 : 0);
    if (parts.length && sentence.length > room) continue;
    const text = clip(sentence, room);
    parts.push(text);
    picked.push(c);
    len += text.length + (parts.length > 1 ? 1 : 0);
  }
  return parts.join(" ");
}
