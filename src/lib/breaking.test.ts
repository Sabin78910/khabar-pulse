import { detectBreaking, EMPTY_LOG, MAX_PER_DAY, parseAlertLog, recordAlerts } from "./breaking.ts";
import type { Cluster } from "../pipeline/types.ts";

const NOW = new Date(2026, 9, 10, 12).getTime();
const MIN = 60_000;

const mk = (id: string, outlets: number, over: Partial<Cluster> = {}): Cluster => ({
  id,
  title: `Story ${id}`,
  snippet: "",
  url: `https://x.example/${id}`,
  sourceId: "a",
  lang: "en",
  region: "nepal",
  topic: "general",
  updatedAt: NOW,
  firstAt: NOW - 10 * MIN,
  score: 1,
  items: Array.from({ length: outlets }, (_, i) => ({ sourceId: `s${i}`, title: "t", url: `https://s${i}.example/${id}`, publishedAt: NOW })),
  ...over,
});

describe("detectBreaking", () => {
  it("alerts when a story newly reaches 4 outlets", () => {
    expect(detectBreaking([mk("a", 3)], [mk("a", 4)], NOW, EMPTY_LOG).map((c) => c.id)).toEqual(["a"]);
    expect(detectBreaking([], [mk("a", 4)], NOW, EMPTY_LOG)).toHaveLength(1);
  });
  it("ignores stories under the threshold or that already had 4", () => {
    expect(detectBreaking([], [mk("a", 3)], NOW, EMPTY_LOG)).toEqual([]);
    expect(detectBreaking([mk("a", 4)], [mk("a", 5)], NOW, EMPTY_LOG)).toEqual([]);
  });
  it("counts distinct outlets only", () => {
    const c = mk("a", 4);
    c.items = c.items.map((i) => ({ ...i, sourceId: "same" }));
    expect(detectBreaking([], [c], NOW, EMPTY_LOG)).toEqual([]);
  });
  it("requires firstAt within 30 minutes", () => {
    expect(detectBreaking([], [mk("a", 4, { firstAt: NOW - 31 * MIN })], NOW, EMPTY_LOG)).toEqual([]);
    expect(detectBreaking([], [mk("a", 4, { firstAt: NOW - 30 * MIN })], NOW, EMPTY_LOG)).toHaveLength(1);
  });
  it("does not alert twice for the same story", () => {
    const log = recordAlerts(EMPTY_LOG, ["a"], NOW);
    expect(detectBreaking([mk("a", 3)], [mk("a", 4)], NOW, log)).toEqual([]);
  });
  it("caps at 3 per day, across refreshes, and resets next day", () => {
    const next = ["a", "b", "c", "d", "e"].map((id) => mk(id, 4));
    const first = detectBreaking([], next, NOW, EMPTY_LOG);
    expect(first).toHaveLength(MAX_PER_DAY);
    const log = recordAlerts(EMPTY_LOG, first.map((c) => c.id), NOW);
    expect(detectBreaking([], next, NOW, log)).toEqual([]);
    const tomorrow = NOW + 24 * 60 * MIN;
    const fresh = ["d", "e"].map((id) => mk(id, 4, { firstAt: tomorrow - MIN }));
    expect(detectBreaking([], fresh, tomorrow, log)).toHaveLength(2);
  });
});

describe("parseAlertLog", () => {
  it("accepts valid data and rejects junk", () => {
    const log = recordAlerts(EMPTY_LOG, ["a"], NOW);
    expect(parseAlertLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    expect(parseAlertLog({ ids: 5 })).toEqual(EMPTY_LOG);
    expect(parseAlertLog(null)).toEqual(EMPTY_LOG);
  });
});
