import { categorize } from "./categorize.ts";
import { clusterArticles, fingerprint, similarity, tokenize } from "./cluster.ts";
import { canonicalUrl, dedupe, hashId, normalizeItem, parseDate, undatedTime } from "./normalize.ts";
import { buildNews, fetchAll, filterClusters, knownTimesFrom, parseCategory, parseLang } from "./pipeline.ts";
import { pickLead, scoreCluster, toCluster } from "./rank.ts";
import type { Article, RawItem, Source } from "./types.ts";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const HOUR = 3600_000;

const src = (over: Partial<Source> = {}): Source => ({
  id: "s1",
  name: "Source One",
  feed: "https://s1.example/feed",
  site: "https://s1.example",
  lang: "en",
  region: "nepal",
  topic: "general",
  ...over,
});

let n = 0;
const art = (title: string, over: Partial<Article> = {}): Article => ({
  id: `a${++n}`,
  sourceId: "s1",
  title,
  url: `https://x.example/${n}`,
  snippet: "",
  publishedAt: NOW - HOUR,
  lang: "en",
  region: "nepal",
  topic: "general",
  ...over,
});

const raw = (over: Partial<RawItem> = {}): RawItem => ({
  title: "A headline",
  link: "https://s1.example/a",
  description: "<p>Desc</p>",
  content: "",
  date: "Sat, 10 Oct 2026 10:00:00 GMT",
  categories: [],
  ...over,
});

describe("normalize", () => {
  it("canonicalises URLs for dedupe", () => {
    expect(canonicalUrl("http://www.Example.com/a/?utm_source=rss&id=3#top")).toBe("https://example.com/a?id=3");
    expect(canonicalUrl("https://bbc.co.uk/news/x?at_medium=RSS&at_campaign=rss")).toBe("https://bbc.co.uk/news/x");
  });

  it("parses RFC 822 dates with Nepal offset and ISO dates", () => {
    expect(parseDate("Sat, 10 Oct 2026 22:18:00 +0545")).toBe(Date.UTC(2026, 9, 10, 16, 33));
    expect(parseDate("  Sat, 10 Oct 2026 22:18:00 +0545\n   ")).toBe(Date.UTC(2026, 9, 10, 16, 33));
    expect(parseDate("2026-10-10T10:00:00Z")).toBe(Date.UTC(2026, 9, 10, 10));
    expect(parseDate("not a date")).toBeUndefined();
  });

  it("hashes stably", () => {
    expect(hashId("abc")).toBe(hashId("abc"));
    expect(hashId("abc")).not.toBe(hashId("abd"));
    expect(hashId("x")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("builds a clean article with a short snippet and the source language", () => {
    const a = normalizeItem(raw({ description: "<b>x</b> ".repeat(150) }), src({ lang: "ne" }), { now: NOW })!;
    expect(a.snippet.length).toBeLessThanOrEqual(200);
    expect(a.lang).toBe("ne");
    expect(a.publishedAt).toBe(Date.UTC(2026, 9, 10, 10));
  });

  it("rejects items without a title or an http link", () => {
    expect(normalizeItem(raw({ title: "" }), src(), { now: NOW })).toBeNull();
    expect(normalizeItem(raw({ link: "javascript:alert(1)" }), src(), { now: NOW })).toBeNull();
  });

  it("clamps future dates to now", () => {
    const a = normalizeItem(raw({ date: "2030-01-01T00:00:00Z" }), src(), { now: NOW })!;
    expect(a.publishedAt).toBe(NOW);
  });

  it("dates undated items from the previous run, else inside the day in the URL", () => {
    const known = new Map([["https://s1.example/a", NOW - 5 * HOUR]]);
    expect(normalizeItem(raw({ date: undefined }), src(), { now: NOW, knownTimes: known })!.publishedAt).toBe(NOW - 5 * HOUR);
    const dayStart = Date.UTC(2026, 9, 8) - (5 * 60 + 45) * 60_000;
    expect(undatedTime("https://kp.example/national/2026/10/08/story", NOW)).toBe(dayStart + 86_400_000 - 1);
    expect(undatedTime("https://kp.example/no-date", NOW - HOUR)).toBe(NOW - HOUR);
  });

  it("dedupes by canonical URL and by same-outlet headline", () => {
    const a = art("Same story", { url: "https://x.example/p?utm_source=a" });
    const b = art("Different", { url: "https://www.x.example/p" });
    const c = art("Same story", { url: "https://x.example/other", sourceId: "s1" });
    const d = art("Same story", { url: "https://y.example/3", sourceId: "s2" });
    expect(dedupe([a, b, c, d]).map((x) => x.id)).toEqual([a.id, d.id]);
  });
});

describe("categorize", () => {
  it("uses feed tags and URL paths for topics", () => {
    expect(categorize(src(), ["खेलकुद"], "https://a.example/x", "x").topic).toBe("sports");
    expect(categorize(src(), [], "https://kathmandupost.com/money/2026/10/10/x", "x").topic).toBe("business");
    expect(categorize(src(), ["Science and Tech"], "https://a.example/x", "x").topic).toBe("tech");
  });

  it("moves international stories from Nepali outlets to World", () => {
    expect(categorize(src(), ["अन्तर्राष्ट्रिय"], "https://a.example/x", "x").region).toBe("world");
    expect(categorize(src(), [], "https://kathmandupost.com/world/2026/x", "x").region).toBe("world");
  });

  it("moves Nepal stories from world outlets to Nepal", () => {
    expect(categorize(src({ region: "world" }), [], "https://bbc.example/x", "Floods hit Nepal's west").region).toBe("nepal");
  });

  it("lets a topic outlet's politics story fall back to general", () => {
    expect(categorize(src({ topic: "business" }), ["Headline", "Politics"], "https://b.example/x", "x").topic).toBe("general");
    expect(categorize(src({ topic: "business" }), ["Economy"], "https://b.example/x", "x").topic).toBe("business");
  });

  it("uses narrow title keywords only as a last resort", () => {
    expect(categorize(src(), [], "https://a.example/x", "Nepal beat UAE in T20 thriller").topic).toBe("sports");
    expect(categorize(src(), [], "https://a.example/x", "Government sets a new goal").topic).toBe("general");
  });
});

describe("clustering", () => {
  it("tokenizes English without stopwords and with light stemming", () => {
    expect(tokenize("The floods hit Nepal's villages")).toEqual(["flood", "hit", "nepal", "village"]);
  });

  it("tokenizes Devanagari: danda, digits and glued postpositions", () => {
    expect(tokenize("सरकारले बजेट ल्यायो। २०८३ सालमा")).toEqual(["सरकार", "बजेट", "ल्यायो", "2083", "साल"]);
  });

  it("scores paraphrased headlines of the same event high and unrelated ones zero", () => {
    const a = fingerprint("Gagan Thapa elected Nepali Congress president");
    const b = fingerprint("Nepali Congress elects Gagan Thapa as party president");
    const c = fingerprint("Floods kill five in Baglung");
    expect(similarity(a, b)).toBeGreaterThan(0.5);
    expect(similarity(a, c)).toBe(0);
  });

  it("matches Nepali headlines that differ only in postpositions", () => {
    const a = fingerprint("बागलुङमा बाढीपहिरोले पाँच जनाको मृत्यु");
    const b = fingerprint("बागलुङको बाढीपहिरोमा पाँच जनाको मृत्यु");
    expect(similarity(a, b)).toBeGreaterThan(0.6);
  });

  it("needs at least two shared words", () => {
    expect(similarity(fingerprint("Nepal election"), fingerprint("Nepal floods"))).toBe(0);
  });

  it("groups the same story across outlets and keeps others apart", () => {
    const items = [
      art("Gagan Thapa elected Nepali Congress president", { sourceId: "kp" }),
      art("Nepali Congress elects Gagan Thapa as president", { sourceId: "ok" }),
      art("Gagan Thapa wins Nepali Congress president race", { sourceId: "tht" }),
      art("Floods kill five in Baglung district", { sourceId: "kp" }),
    ];
    const groups = clusterArticles(items);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 3]);
  });

  it("never merges different languages or reports days apart", () => {
    const a = art("Gagan Thapa elected Nepali Congress president");
    const b = art("Gagan Thapa elected Nepali Congress president", { lang: "ne" });
    const c = art("Gagan Thapa elected Nepali Congress president", { publishedAt: NOW - 72 * HOUR });
    expect(clusterArticles([a, b, c])).toHaveLength(3);
  });
});

describe("ranking", () => {
  it("rewards more outlets and fresher news", () => {
    expect(scoreCluster(5, 5, NOW, NOW)).toBeGreaterThan(scoreCluster(1, 1, NOW, NOW));
    expect(scoreCluster(2, 2, NOW, NOW)).toBeGreaterThan(scoreCluster(2, 2, NOW - 6 * HOUR, NOW));
    expect(scoreCluster(1, 1, NOW - 6 * HOUR, NOW)).toBeCloseTo(scoreCluster(1, 1, NOW, NOW) / 2, 2);
  });

  it("picks a lead with an image and a snippet", () => {
    const plain = art("t");
    const rich = art("t", { image: "https://i.example/x.jpg", snippet: "s" });
    expect(pickLead([plain, rich]).id).toBe(rich.id);
  });

  it("builds a cluster that counts outlets, not feeds, and keeps a stable id", () => {
    const g = [
      art("Story", { sourceId: "tht", publishedAt: NOW - 2 * HOUR }),
      art("Story", { sourceId: "tht-sports", publishedAt: NOW - HOUR }),
      art("Story", { sourceId: "kp", topic: "sports" }),
    ];
    const outletOf = (id: string) => (id.startsWith("tht") ? "THT" : id);
    const c = toCluster(g, NOW, outletOf);
    expect(c.items).toHaveLength(3);
    expect(c.items[0].publishedAt).toBeGreaterThanOrEqual(c.items[1].publishedAt);
    expect(c.score).toBe(scoreCluster(2, 3, NOW - HOUR, NOW));
    expect(c.topic).toBe("general"); // one sports report of three is not enough
    expect(toCluster([...g, art("Story", { sourceId: "x" })], NOW, outletOf).id).toBe(c.id);
  });
});

describe("pipeline", () => {
  const rss = (items: string) => `<rss><channel>${items}</channel></rss>`;
  const item = (title: string, link: string, date = "Sat, 10 Oct 2026 11:00:00 GMT") =>
    `<item><title>${title}</title><link>${link}</link><description>About ${title}</description><pubDate>${date}</pubDate></item>`;

  it("builds ranked clusters from several feeds and reports failures", () => {
    const sources = [src({ id: "a", name: "A", owner: "public-service", country: "GB" }), src({ id: "b", name: "B" }), src({ id: "c", name: "C" })];
    const payload = buildNews(
      [
        { source: sources[0], xml: rss(item("Gagan Thapa elected Nepali Congress president", "https://a.example/1") + item("Old", "https://a.example/old", "Mon, 05 Oct 2026 10:00:00 GMT")) },
        { source: sources[1], xml: rss(item("Nepali Congress elects Gagan Thapa president", "https://b.example/1") + item("Cricket team lands", "https://b.example/2")) },
        { source: sources[2], error: "HTTP 404" },
      ],
      sources,
      { now: NOW },
    );
    expect(payload.failed).toEqual(["c"]);
    expect(payload.clusters[0].items).toHaveLength(2);
    expect(payload.clusters).toHaveLength(2); // "Old" is outside the window
    expect(payload.sources.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(payload.sources[0]).toMatchObject({ owner: "public-service", country: "GB" });
  });

  it("fetches with bounded concurrency and never throws", async () => {
    let active = 0;
    let peak = 0;
    const fetcher = async (url: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (url.includes("bad")) throw new Error("boom");
      return new Response("<rss/>", { status: url.includes("404") ? 404 : 200 });
    };
    const sources = Array.from({ length: 10 }, (_, i) => src({ id: `s${i}`, feed: i === 3 ? "https://bad" : i === 4 ? "https://404" : `https://ok/${i}` }));
    const res = await fetchAll(sources, fetcher, 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(res[3].error).toBe("boom");
    expect(res[4].error).toBe("HTTP 404");
    expect(res[0].xml).toBe("<rss/>");
  });

  it("remembers times of previous items by canonical URL", () => {
    const m = knownTimesFrom({
      version: 1,
      generatedAt: NOW,
      failed: [],
      sources: [],
      clusters: [{ items: [{ url: "http://www.a.example/x/", publishedAt: 5, sourceId: "a", title: "t" }] } as never],
    });
    expect(m.get("https://a.example/x")).toBe(5);
  });

  it("filters by tab, language and search words", () => {
    const base = toCluster([art("Nepal budget passes")], NOW, (x) => x);
    const world = { ...base, items: [], id: "w", region: "world" as const, title: "World cup final", topic: "sports" as const };
    const ne = { ...base, items: [], id: "n", lang: "ne" as const, title: "बजेट पारित" };
    const all = [base, world, ne];
    expect(filterClusters(all, { cat: "nepal" }).map((c) => c.id)).toEqual([base.id, "n"]);
    expect(filterClusters(all, { cat: "sports" }).map((c) => c.id)).toEqual(["w"]);
    expect(filterClusters(all, { lang: "ne" }).map((c) => c.id)).toEqual(["n"]);
    expect(filterClusters(all, { q: "BUDGET nepal" }).map((c) => c.id)).toEqual([base.id]);
    expect(filterClusters(all, { q: "बजेट" }).map((c) => c.id)).toEqual(["n"]);
  });

  it("parses query parameters defensively", () => {
    expect(parseCategory("sports")).toBe("sports");
    expect(parseCategory("<script>")).toBe("top");
    expect(parseLang("ne")).toBe("ne");
    expect(parseLang(null)).toBe("all");
  });
});
