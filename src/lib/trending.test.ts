import { describe, expect, it } from "vitest";
import { trendingTopics } from "./trending.ts";
import type { Cluster } from "../pipeline/types.ts";

const NOW = Date.UTC(2026, 9, 10, 12);
const HOUR = 3_600_000;

const c = (title: string, over: Partial<Cluster> & { sources?: number; ageH?: number } = {}): Cluster => {
  const { sources = 1, ageH = 1, ...rest } = over;
  return {
    id: title,
    title,
    snippet: "",
    url: "https://x.example/a",
    sourceId: "s0",
    lang: "en",
    region: "nepal",
    topic: "general",
    updatedAt: NOW - ageH * HOUR,
    firstAt: NOW - ageH * HOUR,
    score: 1,
    items: Array.from({ length: sources }, (_, i) => ({ sourceId: `s${i}`, title, url: `https://x.example/${i}`, publishedAt: NOW - ageH * HOUR })),
    ...rest,
  };
};

describe("trendingTopics", () => {
  it("weights by number of outlets", () => {
    const out = trendingTopics([c("Deuba visits Delhi", { sources: 1 }), c("Oli rally Pokhara", { sources: 4 }), c("Oli speech Biratnagar", { sources: 1 })], NOW, 8);
    expect(out[0]).toBe("Oli");
  });

  it("ignores clusters older than 6 hours", () => {
    const out = trendingTopics([c("Flood Melamchi", { ageH: 7, sources: 5 }), c("Election Kaski", { ageH: 2, sources: 2 })], NOW, 8);
    expect(out).not.toContain("Flood");
    expect(out).toEqual(["Election Kaski"]);
  });

  it("drops stopwords and generic words", () => {
    const out = trendingTopics([c("Nepal says the budget is new", { sources: 3 })], NOW, 8);
    expect(out).toEqual(["budget"]);
  });

  it("keeps Devanagari terms in their original script", () => {
    const out = trendingTopics([c("प्रधानमन्त्रीले बजेट सार्वजनिक गरे", { lang: "ne", sources: 3 }), c("बजेट आज संसदमा", { lang: "ne", sources: 2 })], NOW, 8);
    expect(out[0]).toBe("बजेट");
  });

  it("respects the limit", () => {
    const titles = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map((w) => c(`${w} Foxtrot${w}`, { sources: 2 }));
    expect(trendingTopics(titles, NOW, 3)).toHaveLength(3);
  });

  it("returns nothing for no clusters", () => {
    expect(trendingTopics([], NOW, 8)).toEqual([]);
  });
});
