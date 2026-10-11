/** localStorage helpers that never throw (private mode, quota, disabled storage). */
export function readJson<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const s = globalThis.localStorage?.getItem(key);
    return s ? parse(JSON.parse(s)) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working without persistence.
  }
}

export const KEYS = {
  lang: "kp.lang",
  contentLang: "kp.contentLang",
  theme: "kp.theme",
  bookmarks: "kp.bookmarks",
  streak: "kp.streak",
  news: "kp.news",
  alerts: "kp.alerts",
  alertLog: "kp.alertLog",
} as const;
