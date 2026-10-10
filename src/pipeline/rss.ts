import type { RawItem } from "./types.ts";
import { child, deepText, findAll, localName, parseXml, type XmlElement } from "./xml.ts";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;

function text(el: XmlElement | undefined): string {
  return el ? deepText(el).trim() : "";
}

function firstImgSrc(html: string): string | undefined {
  const m = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
  return m ? m[1] : undefined;
}

/** Picks the best thumbnail: media:thumbnail, media:content, enclosure, itunes:image, then the first <img>. */
export function extractImage(item: XmlElement, description: string, content: string): string | undefined {
  const candidates: string[] = [];
  const sized: { url: string; width: number }[] = [];
  const visit = (el: XmlElement) => {
    for (const c of el.children) {
      const n = c.name.toLowerCase();
      if (n === "media:thumbnail" && c.attrs.url) candidates.push(c.attrs.url);
      else if (n === "media:content" && c.attrs.url) {
        const type = (c.attrs.type ?? "").toLowerCase();
        const medium = (c.attrs.medium ?? "").toLowerCase();
        if (medium === "image" || type.startsWith("image/") || (!type && !medium && IMAGE_EXT.test(c.attrs.url))) {
          candidates.push(c.attrs.url);
          const w = Number(c.attrs.width);
          if (w > 0) sized.push({ url: c.attrs.url, width: w });
        }
        visit(c); // media:content may wrap a media:thumbnail
      } else if (n === "media:group") visit(c);
      else if (n === "enclosure" && c.attrs.url && (c.attrs.type ?? "").toLowerCase().startsWith("image/"))
        candidates.push(c.attrs.url);
      else if (n === "link" && c.attrs.rel === "enclosure" && c.attrs.href && (c.attrs.type ?? "").startsWith("image/"))
        candidates.push(c.attrs.href);
      else if (n === "itunes:image" && c.attrs.href) candidates.push(c.attrs.href);
      else if (n === "image" && c.children.length === 0 && /^https?:/i.test(c.text.trim())) candidates.push(c.text.trim());
    }
  };
  visit(item);
  // Several renditions (e.g. The Guardian's 140px and 460px): prefer the largest up to 1600px.
  const best = sized.filter((x) => x.width <= 1600).sort((a, b) => b.width - a.width)[0];
  if (best) candidates.unshift(best.url);
  const inline = firstImgSrc(description) ?? firstImgSrc(content);
  if (inline) candidates.push(inline);
  for (const raw of candidates) {
    const url = raw.trim().replace(/^\/\//, "https://");
    if (/^https?:\/\//i.test(url)) return url.replace(/^http:\/\//i, "https://");
  }
  return undefined;
}

function atomLink(entry: XmlElement): string {
  const links = entry.children.filter((c) => localName(c.name) === "link");
  const alt = links.find((l) => !l.attrs.rel || l.attrs.rel === "alternate") ?? links[0];
  if (!alt) return "";
  return (alt.attrs.href ?? alt.text).trim();
}

function rssLink(item: XmlElement): string {
  const link = child(item, "link");
  const fromText = link ? text(link) || (link.attrs.href ?? "") : "";
  if (fromText) return fromText.trim();
  const guid = child(item, "guid");
  if (guid && guid.attrs.isPermaLink !== "false" && /^https?:/i.test(text(guid))) return text(guid);
  const origin = child(item, "feedburner:origLink");
  return text(origin);
}

function readItem(el: XmlElement, atom: boolean): RawItem {
  const title = text(child(el, "title"));
  const description = text(child(el, "description", "summary", atom ? "content" : "description"));
  const content = text(child(el, "content:encoded", atom ? "content" : "content:encoded"));
  const date = text(child(el, "pubDate", "dc:date", "published", "updated", "a10:updated")) || undefined;
  const categories = el.children
    .filter((c) => localName(c.name) === "category" || c.name.toLowerCase() === "dc:subject")
    .map((c) => (c.attrs.term ?? text(c)).trim())
    .filter(Boolean);
  return {
    title,
    link: atom ? atomLink(el) : rssLink(el),
    description,
    content,
    date,
    image: extractImage(el, description, content),
    categories,
  };
}

/** Parses an RSS 2.0, RSS 1.0 (RDF) or Atom document into raw items. Never throws. */
export function parseFeed(xml: string): RawItem[] {
  let root: XmlElement;
  try {
    root = parseXml(xml);
  } catch {
    return [];
  }
  const items = findAll(root, "item").map((el) => readItem(el, false));
  const entries = findAll(root, "entry").map((el) => readItem(el, true));
  return [...items, ...entries].filter((i) => i.title || i.link);
}
