import type { Bookmark } from "./bookmarks.ts";
import { EMPTY_STREAK, recordRead } from "./streak.ts";
import { mergeDocs, parseSyncDoc, type SyncDoc } from "./syncMerge.ts";

const bm = (url: string, savedAt: number): Bookmark => ({ id: url, title: "t", url, sourceId: "kp", lang: "en", savedAt, publishedAt: 1 });
const doc = (bookmarks: Bookmark[], removed: Record<string, number> = {}, days: string[] = []): SyncDoc => {
  let streak = EMPTY_STREAK;
  for (const d of days) streak = recordRead(streak, d).streak;
  return { bookmarks, removed, streak };
};

describe("mergeDocs bookmarks", () => {
  it("unions bookmarks by url, newest first, keeping the newest copy", () => {
    const a = doc([bm("https://a.com/1", 10), bm("https://a.com/2", 5)]);
    const b = doc([bm("https://a.com/2", 9), bm("https://a.com/3", 20)]);
    const m = mergeDocs(a, b);
    expect(m.bookmarks.map((x) => [x.url, x.savedAt])).toEqual([
      ["https://a.com/3", 20],
      ["https://a.com/1", 10],
      ["https://a.com/2", 9],
    ]);
  });

  it("a newer removal wins over an older save", () => {
    const m = mergeDocs(doc([bm("https://a.com/1", 10)]), doc([], { "https://a.com/1": 15 }));
    expect(m.bookmarks).toEqual([]);
    expect(m.removed["https://a.com/1"]).toBe(15);
  });

  it("a save newer than the removal brings the bookmark back", () => {
    const m = mergeDocs(doc([bm("https://a.com/1", 30)]), doc([], { "https://a.com/1": 15 }));
    expect(m.bookmarks).toHaveLength(1);
    expect(m.removed["https://a.com/1"]).toBeUndefined();
  });
});

describe("mergeDocs streak", () => {
  it("unions read days, keeps the max best streak and recomputes current", () => {
    const a = doc([], {}, ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    const b = doc([], {}, ["2026-10-09", "2026-10-10"]);
    const m = mergeDocs(a, b).streak;
    expect(m.best).toBe(4);
    expect(m.lastDay).toBe("2026-10-10");
    expect(m.current).toBe(2);
    expect(m.days).toHaveLength(6);
  });

  it("bridges a gap when the two devices read on complementary days", () => {
    const m = mergeDocs(doc([], {}, ["2026-10-01", "2026-10-03"]), doc([], {}, ["2026-10-02"])).streak;
    expect(m.current).toBe(3);
    expect(m.best).toBe(3);
  });

  it("is commutative", () => {
    const a = doc([bm("https://a.com/1", 1)], {}, ["2026-10-01"]);
    const b = doc([bm("https://a.com/2", 2)], { "https://a.com/9": 3 }, ["2026-10-02"]);
    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
  });
});

describe("parseSyncDoc", () => {
  it("rejects garbage and fills defaults", () => {
    expect(parseSyncDoc(null)).toEqual(doc([]));
    expect(parseSyncDoc({ bookmarks: "x", removed: 4, streak: 5 })).toEqual(doc([]));
  });
});
