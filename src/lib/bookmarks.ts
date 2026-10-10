import type { Cluster, Lang } from "../pipeline/types.ts";

/** A saved story. We keep a small snapshot so bookmarks survive after the story leaves the feed. */
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  image?: string;
  lang: Lang;
  savedAt: number;
  publishedAt: number;
}

export const MAX_BOOKMARKS = 200;

export function toBookmark(c: Cluster, now: number): Bookmark {
  return { id: c.id, title: c.title, url: c.url, sourceId: c.sourceId, image: c.image, lang: c.lang, savedAt: now, publishedAt: c.updatedAt };
}

export function isBookmarked(list: Bookmark[], id: string): boolean {
  return list.some((b) => b.id === id);
}

/** Adds or removes a story; newest first, capped. */
export function toggleBookmark(list: Bookmark[], c: Cluster, now: number): Bookmark[] {
  if (isBookmarked(list, c.id)) return list.filter((b) => b.id !== c.id);
  return [toBookmark(c, now), ...list].slice(0, MAX_BOOKMARKS);
}

export function parseBookmarks(raw: unknown): Bookmark[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is Bookmark =>
        !!b && typeof b === "object" && typeof b.id === "string" && typeof b.title === "string" && typeof b.url === "string" && /^https:\/\//.test(b.url),
    )
    .slice(0, MAX_BOOKMARKS);
}
