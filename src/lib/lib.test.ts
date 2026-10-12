import { isPayload, loadNews, newsEndpoints, PAGES_NEWS_URL } from "./api.ts";
import { isBookmarked, MAX_BOOKMARKS, parseBookmarks, toggleBookmark } from "./bookmarks.ts";
import { pickBriefing, secondsPerCard } from "./briefing.ts";
import { adToBs, bsFromTimestamp, bsToAd, daysInBsYear, formatBs, LAST_YEAR, nepalWeekday } from "./bs.ts";
import { STRINGS } from "./i18n.ts";
import { safeUrl } from "./open.ts";
import { liveStreak, parseStreak, recordRead, EMPTY_STREAK } from "./streak.ts";
import { daysBetween, relativeTime } from "./time.ts";
import type { Cluster, NewsPayload } from "../pipeline/types.ts";

const NOW = Date.UTC(2026, 9, 10, 12);

const cluster = (id: string, over: Partial<Cluster> = {}): Cluster => ({
  id,
  title: `Story ${id}`,
  snippet: "",
  url: `https://x.example/${id}`,
  sourceId: "s",
  lang: "en",
  region: "nepal",
  topic: "general",
  updatedAt: NOW,
  firstAt: NOW,
  score: 1,
  items: [],
  ...over,
});

describe("Bikram Sambat", () => {
  it("converts known dates (verified against Hamro Patro and New Year days)", () => {
    expect(adToBs(2026, 10, 10)).toEqual({ year: 2083, month: 6, day: 24 }); // Asoj 24, 2083
    expect(adToBs(2026, 4, 14)).toEqual({ year: 2083, month: 1, day: 1 });
    expect(adToBs(2024, 4, 13)).toEqual({ year: 2081, month: 1, day: 1 });
    expect(adToBs(2023, 4, 14)).toEqual({ year: 2080, month: 1, day: 1 });
    expect(adToBs(2026, 4, 13)).toEqual({ year: 2082, month: 12, day: 30 });
  });

  it("round-trips every day for years", () => {
    for (let t = Date.UTC(2014, 0, 1); t < Date.UTC(2032, 0, 1); t += 86_400_000 * 7) {
      const d = new Date(t);
      const bs = adToBs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(bsToAd(bs).getTime()).toBe(t);
    }
  });

  it("has 365 or 366 days in every year of the table", () => {
    for (let y = 2070; y <= LAST_YEAR; y++) expect([365, 366]).toContain(daysInBsYear(y));
  });

  it("uses Nepal time, not the device zone", () => {
    // 19:00 UTC on 13 Apr 2026 is already 00:45 on 14 Apr in Nepal: New Year 2083.
    expect(bsFromTimestamp(Date.UTC(2026, 3, 13, 19, 0))).toEqual({ year: 2083, month: 1, day: 1 });
    expect(nepalWeekday(Date.UTC(2026, 9, 10, 12))).toBe(6); // Saturday
  });

  it("formats in Nepali and English", () => {
    expect(formatBs({ year: 2083, month: 6, day: 24 }, "ne", 6)).toBe("असोज २४, २०८३, शनिबार");
    expect(formatBs({ year: 2083, month: 6, day: 24 }, "en")).toBe("24 Asoj 2083");
  });

  it("rejects dates outside the table or invalid days", () => {
    expect(() => adToBs(2010, 1, 1)).toThrow(RangeError);
    expect(() => bsToAd({ year: 2083, month: 1, day: 40 })).toThrow(RangeError);
  });
});

describe("relative time", () => {
  it("uses Nepali numerals in Nepali", () => {
    expect(relativeTime(NOW - 30_000, NOW, "ne")).toBe("भर्खरै");
    expect(relativeTime(NOW - 5 * 60_000, NOW, "ne")).toBe("५ मिनेट अघि");
    expect(relativeTime(NOW - 3 * 3600_000, NOW, "ne")).toBe("३ घण्टा अघि");
    expect(relativeTime(NOW - 2 * 86_400_000, NOW, "ne")).toBe("२ दिन अघि");
  });

  it("is short in English and never negative", () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW, "en")).toBe("5 min ago");
    expect(relativeTime(NOW + 60_000, NOW, "en")).toBe("just now");
  });

  it("counts days between day keys across months", () => {
    expect(daysBetween("2026-09-30", "2026-10-01")).toBe(1);
    expect(daysBetween("2026-10-10", "2026-10-10")).toBe(0);
  });
});

describe("reading streak", () => {
  it("starts, grows on consecutive days and celebrates milestones", () => {
    let r = recordRead(EMPTY_STREAK, "2026-10-08");
    expect(r).toMatchObject({ newDay: true, streak: { current: 1 } });
    r = recordRead(r.streak, "2026-10-09");
    r = recordRead(r.streak, "2026-10-10");
    expect(r.streak.current).toBe(3);
    expect(r.milestone).toBe(3);
  });

  it("does not celebrate twice on the same day", () => {
    const first = recordRead(EMPTY_STREAK, "2026-10-10");
    const second = recordRead(first.streak, "2026-10-10");
    expect(second.newDay).toBe(false);
    expect(second.streak.today).toBe(2);
  });

  it("restarts gently after a missed day and keeps the best", () => {
    let s = recordRead(EMPTY_STREAK, "2026-10-01").streak;
    s = recordRead(s, "2026-10-02").streak;
    const r = recordRead(s, "2026-10-05");
    expect(r.streak.current).toBe(1);
    expect(r.streak.best).toBe(2);
    expect(liveStreak(s, "2026-10-03")).toBe(2);
    expect(liveStreak(s, "2026-10-04")).toBe(0);
  });

  it("parses stored data defensively", () => {
    expect(parseStreak({ current: -3, best: "x", lastDay: "bad" })).toEqual(EMPTY_STREAK);
    expect(parseStreak(null)).toEqual(EMPTY_STREAK);
  });
});

describe("bookmarks", () => {
  it("toggles, newest first, capped", () => {
    let list = toggleBookmark([], cluster("a"), 1);
    list = toggleBookmark(list, cluster("b"), 2);
    expect(list.map((b) => b.id)).toEqual(["b", "a"]);
    expect(isBookmarked(list, "a")).toBe(true);
    list = toggleBookmark(list, cluster("a"), 3);
    expect(list.map((b) => b.id)).toEqual(["b"]);
    let many = list;
    for (let i = 0; i < MAX_BOOKMARKS + 5; i++) many = toggleBookmark(many, cluster(`c${i}`), i);
    expect(many).toHaveLength(MAX_BOOKMARKS);
  });

  it("drops corrupt or unsafe stored entries", () => {
    expect(parseBookmarks([{ id: "x", title: "t", url: "javascript:alert(1)" }, { id: "y", title: "t", url: "https://ok.example" }, 5])).toHaveLength(1);
    expect(parseBookmarks("nope")).toEqual([]);
  });
});

describe("briefing", () => {
  it("takes 8 stories with variety across sections", () => {
    const ranked = [
      ...Array.from({ length: 6 }, (_, i) => cluster(`s${i}`, { topic: "sports", region: "world" })),
      ...Array.from({ length: 6 }, (_, i) => cluster(`n${i}`)),
      ...Array.from({ length: 6 }, (_, i) => cluster(`b${i}`, { topic: "business" })),
    ];
    const b = pickBriefing(ranked);
    expect(b).toHaveLength(8);
    expect(b.filter((c) => c.topic === "sports")).toHaveLength(3);
  });

  it("fills up when there is little variety, and paces about a minute", () => {
    const ranked = Array.from({ length: 10 }, (_, i) => cluster(`s${i}`));
    expect(pickBriefing(ranked)).toHaveLength(8);
    expect(secondsPerCard(8)).toBe(8);
    expect(secondsPerCard(0)).toBe(0);
  });
});

describe("news client", () => {
  const payload: NewsPayload = { version: 1, generatedAt: NOW, clusters: [], sources: [], failed: [] };

  it("prefers the API, then the static file (absolute on Android)", () => {
    expect(newsEndpoints("https://api.example.dev/", false)).toEqual(["https://api.example.dev/api/news", "./news.json"]);
    expect(newsEndpoints(undefined, false)).toEqual(["./news.json"]);
    expect(newsEndpoints("", true)).toEqual([PAGES_NEWS_URL]);
  });

  it("falls back to the next endpoint when one fails", async () => {
    const fetcher = async (url: string) =>
      url.includes("api") ? new Response("down", { status: 503 }) : new Response(JSON.stringify(payload));
    const res = await loadNews(["https://api.example/api/news", "./news.json"], fetcher);
    expect(res.from).toBe("./news.json");
  });

  it("rejects invalid data and throws when every endpoint fails", async () => {
    expect(isPayload({ version: 2 })).toBe(false);
    const fetcher = async () => new Response(JSON.stringify({ nope: true }));
    await expect(loadNews(["a", "b"], fetcher)).rejects.toThrow(/Unexpected data/);
  });
});

describe("i18n and safety", () => {
  it("has every English key in Nepali", () => {
    expect(Object.keys(STRINGS.ne).sort()).toEqual(Object.keys(STRINGS.en).sort());
    expect(Object.keys(STRINGS.ne.tabs)).toEqual(Object.keys(STRINGS.en.tabs));
    expect(STRINGS.ne.sources(5)).toBe("५ स्रोत");
    expect(STRINGS.en.sources(1)).toBe("1 source");
  });

  it("only opens http(s) links", () => {
    expect(safeUrl("https://ok.example/a")).toBe("https://ok.example/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});

import { isLicensingHash } from "./licensing.ts";
describe("isLicensingHash", () => {
  it("matches the licensing route only", () => {
    expect(isLicensingHash("#/licensing")).toBe(true);
    expect(isLicensingHash("#/licensing/")).toBe(true);
    expect(isLicensingHash("#feed")).toBe(false);
    expect(isLicensingHash("")).toBe(false);
  });
});
