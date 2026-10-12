import { daysBetween } from "./time.ts";

/** Reading streak: consecutive days on which the reader opened at least one story. */
export interface Streak {
  current: number;
  best: number;
  lastDay: string | null;
  /** Stories opened on `lastDay`. */
  today: number;
  /** Every day with a read (YYYY-MM-DD, ascending, capped), so devices can union them when syncing. */
  days: string[];
}

export const MAX_DAYS = 400;

export const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: null, today: 0, days: [] };

export const MILESTONES = [3, 7, 14, 30, 50, 100, 365];

export interface ReadResult {
  streak: Streak;
  /** True when this read started a new day of the streak (a gentle celebration moment). */
  newDay: boolean;
  /** Set when the new streak length is a milestone. */
  milestone?: number;
}

/** Records one story read on `day` (YYYY-MM-DD). A missed day resets the streak to 1; no penalty otherwise. */
export function recordRead(s: Streak, day: string): ReadResult {
  if (s.lastDay === day) return { streak: { ...s, today: s.today + 1 }, newDay: false };
  const gap = s.lastDay ? daysBetween(s.lastDay, day) : Infinity;
  if (gap < 0) return { streak: s, newDay: false }; // clock went backwards: ignore
  const current = gap === 1 ? s.current + 1 : 1;
  const days = [...s.days.filter((d) => d !== day), day].slice(-MAX_DAYS);
  const streak = { current, best: Math.max(s.best, current), lastDay: day, today: 1, days };
  return { streak, newDay: true, milestone: MILESTONES.includes(current) ? current : undefined };
}

/** The streak as it stands on `day`: still alive if the last read was today or yesterday. */
export function liveStreak(s: Streak, day: string): number {
  if (!s.lastDay) return 0;
  const gap = daysBetween(s.lastDay, day);
  return gap === 0 || gap === 1 ? s.current : 0;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseStreak(raw: unknown): Streak {
  if (!raw || typeof raw !== "object") return EMPTY_STREAK;
  const r = raw as Partial<Streak>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    current: num(r.current),
    best: num(r.best),
    lastDay: typeof r.lastDay === "string" && DAY_RE.test(r.lastDay) ? r.lastDay : null,
    today: num(r.today),
    days: Array.isArray(r.days) ? r.days.filter((d): d is string => typeof d === "string" && DAY_RE.test(d)).slice(-MAX_DAYS) : [],
  };
}
