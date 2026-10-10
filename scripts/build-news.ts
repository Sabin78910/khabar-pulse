// Runs the news pipeline in Node and writes news.json (the GitHub Actions fallback for the Worker).
// Usage: node scripts/build-news.ts <out-file>   (Node 22.18+ runs TypeScript directly)
// PREVIOUS_URL (optional): the live news.json, used to keep first-seen times for undated feeds.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SOURCES } from "../src/config/sources.ts";
import { runPipeline } from "../src/pipeline/pipeline.ts";
import type { NewsPayload } from "../src/pipeline/types.ts";

const out = process.argv[2] ?? "public/news.json";
const previousUrl = process.env.PREVIOUS_URL;

async function loadPrevious(): Promise<NewsPayload | undefined> {
  if (!previousUrl) return undefined;
  try {
    const res = await fetch(previousUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const data = (await res.json()) as NewsPayload;
    return data?.version === 1 && Array.isArray(data.clusters) ? data : undefined;
  } catch {
    return undefined;
  }
}

const started = Date.now();
const previous = await loadPrevious();
const payload = await runPipeline(SOURCES, fetch, { now: Date.now(), previous });
const final = payload.clusters.length === 0 && previous ? { ...previous, failed: payload.failed } : payload;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(final));
const multi = final.clusters.filter((c) => new Set(c.items.map((i) => i.sourceId)).size > 1).length;
console.log(
  `news.json: ${final.clusters.length} stories (${multi} covered by 2+ feeds), ` +
    `${SOURCES.length - payload.failed.length}/${SOURCES.length} feeds ok in ${Date.now() - started} ms`,
);
if (payload.failed.length) console.log(`failed feeds: ${payload.failed.join(", ")}`);
if (final.clusters.length === 0) {
  console.error("No stories at all: every feed failed.");
  process.exit(1);
}
