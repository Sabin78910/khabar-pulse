import { decodeEntities } from "./xml.ts";

export const SNIPPET_MAX = 200;

/** Removes tags, scripts and styles, decodes entities and collapses whitespace. */
export function stripHtml(html: string): string {
  const noBlocks = html
    .replace(/<(script|style|noscript|iframe|figure|figcaption)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  // Escaped HTML (&lt;p&gt;) appears in some feeds: decode, then strip again.
  let s = decodeEntities(noBlocks);
  if (/<[a-z/][^>]*>/i.test(s)) s = s.replace(/<[^>]*>/g, " ");
  return s.replace(/[\u00a0\s]+/g, " ").trim();
}

/** Boilerplate some CMSs append to every description. */
const BOILERPLATE = [
  /The post .{0,300}? appeared first on .{0,120}?\.?$/i,
  /Continue reading\.{0,3}\s*$/i,
  /Read more\.{0,3}\s*$/i,
  /\[\s*(…|\.\.\.|&#8230;)\s*\]/g,
  /थप पढ्नुहोस्\s*$/,
];

/** A short, clean, publisher-safe snippet: at most `max` characters, cut at a word boundary. */
export function makeSnippet(htmlOrText: string, max = SNIPPET_MAX): string {
  let s = stripHtml(htmlOrText);
  for (const re of BOILERPLATE) s = s.replace(re, "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return base.replace(/[\s,;:\-\u2013\u2014\u0964]+$/, "") + "…";
}

/** Cleans a headline: no tags, single spaces, no trailing separators. */
export function cleanTitle(title: string): string {
  return stripHtml(title).replace(/\s*[|–—-]\s*$/, "").trim();
}

const NE_DIGITS = "०१२३४५६७८९";

/** Converts ASCII digits to Devanagari digits (for Nepali UI). */
export function toNepaliDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}

/** Converts Devanagari digits to ASCII digits. */
export function fromNepaliDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(NE_DIGITS.indexOf(d)));
}
