import { describe, expect, it } from "vitest";
import { MAX_SUMMARY, summarizeCluster } from "./summary.ts";
import type { Cluster } from "../pipeline/types.ts";

const item = (sourceId: string, title: string) => ({ sourceId, title, url: `https://${sourceId}.example/${encodeURIComponent(title)}`, publishedAt: 1 });

const make = (titles: [string, string][], snippet = "", lang: "en" | "ne" = "en"): Cluster => ({
  id: "c",
  title: titles[0][1],
  snippet,
  url: "https://a.example/x",
  sourceId: titles[0][0],
  lang,
  region: "nepal",
  topic: "general",
  updatedAt: 1,
  firstAt: 1,
  score: 1,
  items: titles.map(([s, t]) => item(s, t)),
});

describe("summarizeCluster", () => {
  it("is empty for a single-source cluster", () => {
    expect(summarizeCluster(make([["a", "Flood hits Kathmandu valley"]], "Heavy rain flooded roads."))).toBe("");
    expect(summarizeCluster(make([["a", "Flood hits Kathmandu valley"], ["a", "Flood hits Kathmandu valley again"]]))).toBe("");
  });

  it("picks the consensus sentence over the outlier", () => {
    const c = make([
      ["a", "Flood hits Kathmandu valley, roads closed"],
      ["b", "Kathmandu valley flood closes roads"],
      ["c", "Flood closes Kathmandu valley roads"],
      ["d", "Celebrity opens new cafe"],
    ]);
    const out = summarizeCluster(c);
    expect(out).toMatch(/flood/i);
    expect(out).not.toMatch(/cafe/i);
  });

  it("uses at most 2 sentences and respects the length cap", () => {
    const long = "Flood waters rose across Kathmandu valley overnight " + "and ".repeat(0) + "x".repeat(400);
    const c = make(
      [
        ["a", "Flood waters rise across Kathmandu valley overnight"],
        ["b", "Kathmandu valley flood waters rise overnight"],
        ["c", "Overnight flood waters rise in Kathmandu valley"],
      ],
      `${long}. Second flood sentence. Third flood sentence.`,
    );
    const out = summarizeCluster(c);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(MAX_SUMMARY);
    expect(out.split(/(?<=[.!?])\s/).length).toBeLessThanOrEqual(2);
  });

  it("handles Devanagari input", () => {
    const c = make(
      [
        ["a", "काठमाडौंमा बाढी, सडक अवरुद्ध"],
        ["b", "काठमाडौं उपत्यकामा बाढीले सडक अवरुद्ध"],
        ["c", "बाढीले काठमाडौंका सडक अवरुद्ध"],
        ["d", "नयाँ क्याफे खुल्यो"],
      ],
      "",
      "ne",
    );
    const out = summarizeCluster(c);
    expect(out).toMatch(/बाढी/);
    expect(out).not.toMatch(/क्याफे/);
    expect(out.length).toBeLessThanOrEqual(MAX_SUMMARY);
  });
});
