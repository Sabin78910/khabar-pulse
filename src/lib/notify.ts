import { safeUrl } from "./open.ts";
import type { Strings } from "./i18n.ts";
import type { Cluster } from "../pipeline/types.ts";

interface Notifier {
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

/** Shows one notification per story; the service worker opens `data.url` on tap. */
export async function showBreaking(reg: Notifier, stories: Cluster[], s: Strings): Promise<void> {
  for (const c of stories) {
    const url = safeUrl(c.url);
    if (!url) continue;
    const n = new Set(c.items.map((i) => i.sourceId)).size;
    await reg.showNotification(s.alertTitle(n), { body: c.title, tag: c.id, icon: "./icon-192.png", data: { url } });
  }
}

export function notificationsSupported(): boolean {
  return typeof Notification !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}
