import type { Cluster } from "../pipeline/types.ts";

/** Removes hidden outlets from each story. A story left with no reports is dropped; if its lead outlet is hidden the newest remaining report becomes the lead. */
export function applySourcePrefs(clusters: Cluster[], hidden: ReadonlySet<string>): Cluster[] {
  if (hidden.size === 0) return clusters;
  const out: Cluster[] = [];
  for (const c of clusters) {
    const items = c.items.filter((i) => !hidden.has(i.sourceId));
    if (items.length === 0) continue;
    if (items.length === c.items.length) {
      out.push(c);
      continue;
    }
    if (!hidden.has(c.sourceId)) {
      out.push({ ...c, items });
      continue;
    }
    const lead = items[0];
    // The old snippet and image belong to the hidden outlet, so they are not carried over.
    out.push({
      ...c,
      sourceId: lead.sourceId,
      title: lead.title,
      url: lead.url,
      snippet: "",
      image: undefined,
      updatedAt: lead.publishedAt,
      items,
    });
  }
  return out;
}

export function parseHiddenSources(raw: unknown): Set<string> {
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
}
