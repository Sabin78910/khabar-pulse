import type { Cluster } from "../pipeline/types.ts";
import type { UiLang } from "./i18n.ts";
import { safeUrl } from "./open.ts";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

const VIA: Record<UiLang, string> = { en: "via Khabar Pulse", ne: "खबर पल्स मार्फत" };

/** Headline, the publisher's URL and our credit. Never the snippet or any article text. */
export function shareText(c: Cluster, lang: UiLang): string {
  return `${c.title}\n${c.url}\n${VIA[lang]}`;
}

/** Native share sheet when there is one, otherwise copy to the clipboard. */
export async function shareStory(c: Cluster, lang: UiLang, env: ShareEnv): Promise<ShareResult> {
  const url = safeUrl(c.url);
  if (!url) return "failed";
  const text = shareText(c, lang);
  if (env.share) {
    try {
      await env.share({ title: c.title, text, url: c.url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (!env.clipboard) return "failed";
    await env.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** The browser's share and clipboard, bound so `this` stays correct. */
export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    share: nav?.share ? (d) => nav.share(d) : undefined,
    clipboard: nav?.clipboard ? { writeText: (t) => nav.clipboard.writeText(t) } : undefined,
  };
}
