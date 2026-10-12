import { MAX_BOOKMARKS, parseBookmarks, type Bookmark } from "./bookmarks.ts";
import { EMPTY_STREAK, MAX_DAYS, parseStreak, type Streak } from "./streak.ts";
import { daysBetween } from "./time.ts";

/** What travels between devices (encrypted by the sync client). `removed` holds tombstones: url → time removed. */
export interface SyncDoc {
  bookmarks: Bookmark[];
  removed: Record<string, number>;
  streak: Streak;
}

export function parseRemoved(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [url, at] of Object.entries(raw)) if (typeof at === "number" && Number.isFinite(at)) out[url] = at;
  return out;
}

export function parseSyncDoc(raw: unknown): SyncDoc {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { bookmarks: parseBookmarks(r.bookmarks), removed: parseRemoved(r.removed), streak: parseStreak(r.streak) };
}

function mergeStreak(a: Streak, b: Streak): Streak {
  const days = [...new Set([...a.days, ...b.days])].sort().slice(-MAX_DAYS);
  let best = Math.max(a.best, b.best);
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  if (!prev) return { ...EMPTY_STREAK, best };
  const lastDay = prev;
  const today = Math.max(a.lastDay === lastDay ? a.today : 0, b.lastDay === lastDay ? b.today : 0, 1);
  return { current: run, best, lastDay, today, days };
}

/** Merge by URL keeping the newest savedAt; a removal wins unless the save is newer. Commutative. */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const removed: Record<string, number> = { ...a.removed };
  for (const [url, at] of Object.entries(b.removed)) removed[url] = Math.max(removed[url] ?? 0, at);

  const byUrl = new Map<string, Bookmark>();
  for (const bm of [...a.bookmarks, ...b.bookmarks]) {
    const have = byUrl.get(bm.url);
    if (!have || bm.savedAt > have.savedAt) byUrl.set(bm.url, bm);
  }
  for (const [url, bm] of [...byUrl]) {
    if ((removed[url] ?? -1) >= bm.savedAt) byUrl.delete(url);
    else delete removed[url];
  }
  const bookmarks = [...byUrl.values()].sort((x, y) => y.savedAt - x.savedAt || (x.url < y.url ? -1 : 1)).slice(0, MAX_BOOKMARKS);
  return { bookmarks, removed, streak: mergeStreak(a.streak, b.streak) };
}
