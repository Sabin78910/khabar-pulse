import { fromNepaliDigits } from "./text.ts";
import type { Article } from "./types.ts";

const EN_STOP = new Set(
  ("a an the and or but if of to in on at by for from with without into onto over under about after before " +
    "as is are was were be been being am do does did has have had will would shall should can could may might must " +
    "it its this that these those he she they them his her their we our you your i me my not no yes new says said " +
    "say than then there here who whom whose what which when where why how all any each more most some such only " +
    "own same so too very just up down out off again further once also amid via vs per").split(" "),
);

const NE_STOP = new Set(
  ("र तथा वा पनि नै भने भन्ने यो त्यो यी ती ले लाई को का की मा बाट सँग संग देखि सम्म छ छन् थियो थिए हुने हुन् " +
    "भएको भएका भएकी गरेको गरेका गर्ने गर्न गरी गरे हो होइन एक दुई अब अझै कि किन कसरी के कुन जो जुन आफ्नो " +
    "उनी उनको उनले उनका यस यसको उक्त सबै धेरै केही नयाँ भन्दा लागि माथि बीच बिच अघि पछि रहेको रहेका दिए दिने").split(
    " ",
  ),
);

/** Postpositions often glued to Nepali nouns ("सरकारले", "नेपालमा"). Longest first. */
const NE_SUFFIXES = ["हरूलाई", "हरूको", "हरूले", "हरूमा", "हरूबाट", "द्वारा", "हरू", "लाई", "बाट", "सँग", "संग", "देखि", "सम्म", "को", "का", "की", "ले", "मा"];

const DEVANAGARI = /[\u0900-\u097f]/;

function stem(token: string): string {
  if (DEVANAGARI.test(token)) {
    for (const suf of NE_SUFFIXES) {
      if (token.endsWith(suf) && token.length - suf.length >= 2) return token.slice(0, -suf.length);
    }
    return token;
  }
  let t = token.replace(/'s$/, "");
  if (t.length > 4 && t.endsWith("ies")) t = t.slice(0, -3) + "y";
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us")) t = t.slice(0, -1);
  return t;
}

/** Splits a headline into comparable tokens. Devanagari-aware: danda, digits and glued postpositions handled. */
export function tokenize(title: string): string[] {
  const s = fromNepaliDigits(title.normalize("NFC").toLowerCase())
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u0964\u0965]/g, " ");
  // eslint-disable-next-line no-misleading-character-class -- Devanagari ranges are intended
  const raw = s.split(/[^a-z0-9'\u0900-\u0963\u0966-\u097f]+/).map((t) => t.replace(/^'+|'+$/g, ""));
  const out: string[] = [];
  for (const t of raw) {
    if (!t || EN_STOP.has(t) || NE_STOP.has(t)) continue;
    const st = stem(t);
    if (st.length < 2 && !/^\d+$/.test(st)) continue;
    if (EN_STOP.has(st) || NE_STOP.has(st)) continue;
    out.push(st);
  }
  return out;
}

/** Character 3-gram shingles over the joined tokens (catches inflection differences). */
export function shingles(tokens: string[], k = 3): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    const chars = Array.from(` ${t} `);
    if (chars.length <= k) out.add(chars.join(""));
    for (let i = 0; i + k <= chars.length; i++) out.add(chars.slice(i, i + k).join(""));
  }
  return out;
}

function dice<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

export interface Fingerprint {
  tokens: Set<string>;
  shingles: Set<string>;
}

export function fingerprint(title: string): Fingerprint {
  const tokens = tokenize(title);
  return { tokens: new Set(tokens), shingles: shingles(tokens) };
}

/** Similarity of two headlines in [0, 1]: half token overlap, half character shingle overlap. */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  let shared = 0;
  for (const t of a.tokens) if (b.tokens.has(t)) shared++;
  if (shared < 2) return 0; // one shared word ("Nepal", "election") is never enough
  const tok = dice(a.tokens, b.tokens);
  const sh = dice(a.shingles, b.shingles);
  const containment = shared / Math.min(a.tokens.size, b.tokens.size);
  return Math.min(1, 0.4 * tok + 0.4 * sh + 0.2 * containment);
}

export interface ClusterOptions {
  threshold?: number;
  /** Two reports further apart than this are never the same story. */
  windowMs?: number;
}

/**
 * Groups articles that report the same story. Greedy single pass, newest first: each article joins the
 * existing group it is most similar to (best match against any member) or starts a new one.
 * An inverted token index keeps it fast; tokens shared by many articles are skipped as candidates.
 */
export function clusterArticles(articles: Article[], opts: ClusterOptions = {}): Article[][] {
  const threshold = opts.threshold ?? 0.5;
  const windowMs = opts.windowMs ?? 36 * 3600_000;
  const sorted = [...articles].sort((x, y) => y.publishedAt - x.publishedAt);
  const prints = sorted.map((a) => fingerprint(a.title));
  const df = new Map<string, number>();
  for (const p of prints) for (const t of p.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  const maxDf = Math.max(8, Math.ceil(sorted.length * 0.05));

  const groups: number[][] = [];
  const groupOf: number[] = [];
  const index = new Map<string, number[]>(); // token -> article indices already placed
  sorted.forEach((a, i) => {
    const p = prints[i];
    const candidates = new Set<number>();
    for (const t of p.tokens) {
      if ((df.get(t) ?? 0) > maxDf) continue;
      for (const j of index.get(t) ?? []) candidates.add(j);
    }
    let best = -1;
    let bestSim = threshold;
    for (const j of candidates) {
      const b = sorted[j];
      if (b.lang !== a.lang || Math.abs(b.publishedAt - a.publishedAt) > windowMs) continue;
      const s = similarity(p, prints[j]);
      if (s >= bestSim) {
        bestSim = s;
        best = groupOf[j];
      }
    }
    if (best === -1) {
      best = groups.length;
      groups.push([]);
    }
    groups[best].push(i);
    groupOf[i] = best;
    for (const t of p.tokens) {
      const list = index.get(t);
      if (list) list.push(i);
      else index.set(t, [i]);
    }
  });
  return groups.map((g) => g.map((i) => sorted[i]));
}
