import { dayKey } from "./time.ts";
import type { Cluster } from "../pipeline/types.ts";

export const MIN_OUTLETS = 4;
export const WINDOW_MS = 30 * 60_000;
export const MAX_PER_DAY = 3;
const MAX_IDS = 200;

/** Stories already alerted (ids, newest last) and how many alerts went out on `day`. */
export interface AlertLog {
  ids: string[];
  day: string;
  count: number;
}

export const EMPTY_LOG: AlertLog = { ids: [], day: "", count: 0 };

export function parseAlertLog(v: unknown): AlertLog {
  const o = v as Partial<AlertLog> | null;
  if (!o || !Array.isArray(o.ids) || typeof o.day !== "string" || typeof o.count !== "number") return EMPTY_LOG;
  return { ids: o.ids.filter((x): x is string => typeof x === "string").slice(-MAX_IDS), day: o.day, count: o.count };
}

const outlets = (c: Cluster | undefined) => new Set(c?.items.map((i) => i.sourceId)).size;

/** Clusters that newly reached 4+ outlets, started within 30 min, were not alerted before, within the daily cap. */
export function detectBreaking(prev: Cluster[], next: Cluster[], now: number, log: AlertLog): Cluster[] {
  const before = new Map(prev.map((c) => [c.id, outlets(c)]));
  const sent = new Set(log.ids);
  const today = dayKey(now);
  const room = MAX_PER_DAY - (log.day === today ? log.count : 0);
  if (room <= 0) return [];
  return next
    .filter(
      (c) =>
        outlets(c) >= MIN_OUTLETS &&
        (before.get(c.id) ?? 0) < MIN_OUTLETS &&
        now - c.firstAt <= WINDOW_MS &&
        !sent.has(c.id),
    )
    .slice(0, room);
}

export function recordAlerts(log: AlertLog, ids: string[], now: number): AlertLog {
  const today = dayKey(now);
  return {
    ids: [...log.ids, ...ids].slice(-MAX_IDS),
    day: today,
    count: (log.day === today ? log.count : 0) + ids.length,
  };
}
