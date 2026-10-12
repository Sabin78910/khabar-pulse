import { toNepaliDigits } from "../pipeline/text.ts";

export interface ForexRate {
  iso3: string;
  name: string;
  unit: number;
  buy: number;
  sell: number;
}

export interface ForexDay {
  date: string;
  rates: ForexRate[];
}

export const FEATURED = ["USD", "INR", "QAR", "AED", "SAR", "MYR", "KRW", "AUD"] as const;

const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 10;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** NRB lists oldest first, so ask for a recent window and pick the newest day from it. */
export function forexUrl(now: number): string {
  const nepalNow = now + NPT_OFFSET_MS;
  const q = new URLSearchParams({
    from: isoDay(nepalNow - (WINDOW_DAYS - 1) * DAY_MS),
    to: isoDay(nepalNow),
    per_page: String(WINDOW_DAYS),
    page: "1",
  });
  return `https://www.nrb.org.np/api/forex/v1/rates?${q}`;
}

export function latestDay(dates: string[]): string | null {
  return dates.reduce<string | null>((a, d) => (a === null || d > a ? d : a), null);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function parseRate(raw: unknown): ForexRate | null {
  if (!isObj(raw) || !isObj(raw.currency)) return null;
  const { iso3, name, unit } = raw.currency;
  const buy = Number(raw.buy);
  const sell = Number(raw.sell);
  if (typeof iso3 !== "string" || typeof unit !== "number" || unit <= 0 || !Number.isFinite(buy) || !Number.isFinite(sell)) return null;
  return { iso3, name: typeof name === "string" ? name : iso3, unit, buy, sell };
}

/** Picks the newest published day from an NRB API response; null when none usable. */
export function parseForex(raw: unknown): ForexDay | null {
  if (!isObj(raw) || !isObj(raw.data) || !Array.isArray(raw.data.payload)) return null;
  const days = raw.data.payload.filter((p): p is Record<string, unknown> => isObj(p) && typeof p.date === "string" && Array.isArray(p.rates));
  const date = latestDay(days.map((d) => d.date as string));
  const day = days.find((d) => d.date === date);
  if (!day) return null;
  const rates = (day.rates as unknown[]).map(parseRate).filter((r): r is ForexRate => r !== null);
  return rates.length ? { date: day.date as string, rates } : null;
}

export function parseStoredForex(raw: unknown): ForexDay | null {
  if (!isObj(raw) || typeof raw.date !== "string" || !Array.isArray(raw.rates)) return null;
  const rates = raw.rates.filter((r): r is ForexRate => isObj(r) && typeof r.iso3 === "string" && typeof r.unit === "number" && typeof r.buy === "number" && typeof r.sell === "number");
  return rates.length ? { date: raw.date, rates } : null;
}

export async function loadForex(now: number, fetcher: typeof fetch): Promise<ForexDay> {
  const res = await fetcher(forexUrl(now));
  if (!res.ok) throw new Error(`NRB ${res.status}`);
  const day = parseForex(await res.json());
  if (!day) throw new Error("No NRB rates");
  return day;
}

/** NPR for `amount` of a currency at the buy rate; rates are quoted per `unit`. */
export function convertToNpr(amount: number, rate: ForexRate): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return (amount / rate.unit) * rate.buy;
}

export function formatRate(n: number, lang: "ne" | "en"): string {
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return lang === "ne" ? toNepaliDigits(s) : s;
}

export function formatForexDate(date: string, lang: "ne" | "en"): string {
  return lang === "ne" ? toNepaliDigits(date) : date;
}
