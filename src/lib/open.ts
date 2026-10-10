import { Capacitor } from "@capacitor/core";

/** Only http(s) links from feeds are ever opened. */
export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Opens the publisher's article: in-app browser tab on Android, a new tab on the web. */
export async function openArticle(url: string): Promise<void> {
  const safe = safeUrl(url);
  if (!safe) return;
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: safe, toolbarColor: "#0B0B0F" });
    return;
  }
  window.open(safe, "_blank", "noopener,noreferrer");
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
