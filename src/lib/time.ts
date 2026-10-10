import { toNepaliDigits } from "../pipeline/text.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 d ago" — or in Nepali with Devanagari numerals. */
export function relativeTime(ms: number, now: number, lang: "ne" | "en"): string {
  const diff = Math.max(0, now - ms);
  const ne = lang === "ne";
  if (diff < MIN) return ne ? "भर्खरै" : "just now";
  if (diff < HOUR) {
    const n = Math.floor(diff / MIN);
    return ne ? `${toNepaliDigits(n)} मिनेट अघि` : `${n} min ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return ne ? `${toNepaliDigits(n)} घण्टा अघि` : `${n} h ago`;
  }
  const n = Math.floor(diff / DAY);
  return ne ? `${toNepaliDigits(n)} दिन अघि` : `${n} d ago`;
}

/** Local calendar day key (YYYY-MM-DD) in the device time zone. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days between two day keys (b − a). */
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / DAY);
}
