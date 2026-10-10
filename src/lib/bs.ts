import { toNepaliDigits } from "../pipeline/text.ts";

/**
 * Bikram Sambat (BS) ⇄ Gregorian (AD) conversion.
 * Month lengths for BS 2070–2090 (the official calendar is published year by year; this table matches the
 * widely used nepali-date-converter data and Hamro Patro, e.g. 10 Oct 2026 = Asoj 24, 2083).
 * Anchor: 1 Baisakh 2070 = 14 April 2013.
 */
const FIRST_YEAR = 2070;
const ANCHOR_UTC = Date.UTC(2013, 3, 14);
const DAY = 86_400_000;
/** Nepal Standard Time is UTC+5:45. */
export const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;

export const BS_MONTH_DAYS: readonly (readonly number[])[] = [
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2070
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2071
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2072
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2073
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2074
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2075
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2076
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2077
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2078
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2079
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2084
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2085
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2086
  [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], // 2087
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2088
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2089
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2090
];
export const LAST_YEAR = FIRST_YEAR + BS_MONTH_DAYS.length - 1;

export const BS_MONTHS_NE = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"];
export const BS_MONTHS_EN = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
export const WEEKDAYS_NE = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];

export interface BsDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–32 */
  day: number;
}

export function daysInBsYear(year: number): number {
  const row = BS_MONTH_DAYS[year - FIRST_YEAR];
  if (!row) throw new RangeError(`BS year ${year} is outside ${FIRST_YEAR}–${LAST_YEAR}`);
  return row.reduce((a, b) => a + b, 0);
}

export function daysInBsMonth(year: number, month: number): number {
  const row = BS_MONTH_DAYS[year - FIRST_YEAR];
  if (!row || month < 1 || month > 12) throw new RangeError(`Invalid BS month ${year}-${month}`);
  return row[month - 1];
}

/** Converts a Gregorian calendar date (year, month 1–12, day) to BS. */
export function adToBs(year: number, month: number, day: number): BsDate {
  let days = Math.round((Date.UTC(year, month - 1, day) - ANCHOR_UTC) / DAY);
  if (days < 0) throw new RangeError("Date is before BS 2070");
  let y = FIRST_YEAR;
  while (days >= daysInBsYear(y)) {
    days -= daysInBsYear(y);
    y++;
    if (y > LAST_YEAR) throw new RangeError(`Date is after BS ${LAST_YEAR}`);
  }
  let m = 1;
  while (days >= daysInBsMonth(y, m)) {
    days -= daysInBsMonth(y, m);
    m++;
  }
  return { year: y, month: m, day: days + 1 };
}

/** Converts a BS date to a Gregorian date (UTC midnight). */
export function bsToAd({ year, month, day }: BsDate): Date {
  if (day < 1 || day > daysInBsMonth(year, month)) throw new RangeError(`Invalid BS day ${year}-${month}-${day}`);
  let days = 0;
  for (let y = FIRST_YEAR; y < year; y++) days += daysInBsYear(y);
  for (let m = 1; m < month; m++) days += daysInBsMonth(year, m);
  days += day - 1;
  return new Date(ANCHOR_UTC + days * DAY);
}

/** Today's BS date in Nepal, whatever the device time zone. */
export function bsFromTimestamp(ms: number): BsDate {
  const d = new Date(ms + NPT_OFFSET_MS);
  return adToBs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** "असोज २४, २०८३, शनिबार" or "24 Asoj 2083". */
export function formatBs(bs: BsDate, lang: "ne" | "en", weekday?: number): string {
  if (lang === "ne") {
    const base = `${BS_MONTHS_NE[bs.month - 1]} ${toNepaliDigits(bs.day)}, ${toNepaliDigits(bs.year)}`;
    return weekday === undefined ? base : `${base}, ${WEEKDAYS_NE[weekday]}`;
  }
  return `${bs.day} ${BS_MONTHS_EN[bs.month - 1]} ${bs.year}`;
}

/** Nepal-local weekday (0 = Sunday) for a timestamp. */
export function nepalWeekday(ms: number): number {
  return new Date(ms + NPT_OFFSET_MS).getUTCDay();
}
