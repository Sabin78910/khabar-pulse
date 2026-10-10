/**
 * A tiny, forgiving XML parser for RSS / Atom feeds.
 * It builds a light element tree, understands CDATA, comments, processing instructions,
 * DOCTYPE and self-closing tags, and survives the broken markup real news sites publish
 * (stray `&`, unclosed tags, HTML inside descriptions).
 */
export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Concatenated direct text (CDATA included), entities decoded. */
  text: string;
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  zwj: "‍",
  zwnj: "‌",
};

/** Decodes named and numeric character references; unknown entities are left as they are. */
export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    const v = NAMED[body.toLowerCase()];
    return v ?? m;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Parses an XML string into a synthetic root element whose children are the top-level elements. */
export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlElement[] = [root];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    const top = stack[stack.length - 1];
    if (lt === -1) {
      top.text += decodeEntities(xml.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(xml.slice(i, lt));
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      const stop = end === -1 ? n : end;
      top.text += xml.slice(lt + 9, stop);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml[lt + 1] === "?" || xml[lt + 1] === "!") {
      const end = xml.indexOf(">", lt + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const gt = findTagEnd(xml, lt + 1);
    if (gt === -2) {
      top.text += "<";
      i = lt + 1;
      continue;
    }
    if (gt === -1) {
      top.text += decodeEntities(xml.slice(lt));
      break;
    }
    const inner = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (inner[0] === "/") {
      const name = inner.slice(1).trim();
      // Pop to the matching open tag; ignore stray closing tags.
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    if (!/^[A-Za-z_]/.test(inner)) {
      // Not a tag (e.g. "a < b" in text): keep it as text.
      top.text += decodeEntities("<" + inner + ">");
      continue;
    }
    const selfClosing = inner.endsWith("/");
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const sp = body.search(/\s/);
    const name = sp === -1 ? body : body.slice(0, sp);
    const el: XmlElement = { name, attrs: sp === -1 ? {} : parseAttrs(body.slice(sp + 1)), children: [], text: "" };
    top.children.push(el);
    if (!selfClosing) stack.push(el);
  }
  return root;
}

/** Finds the `>` closing a tag, skipping quoted attribute values. -1: no end, -2: not a tag. */
function findTagEnd(xml: string, from: number): number {
  let quote = "";
  for (let k = from; k < xml.length; k++) {
    const c = xml[k];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return k;
    } else if (c === "<") {
      return -2; // a bare "<" in text, not a tag
    }
  }
  return -1;
}

/** Local part of a possibly namespaced tag name, lower-cased. */
export function localName(name: string): string {
  const c = name.indexOf(":");
  return (c === -1 ? name : name.slice(c + 1)).toLowerCase();
}

/** Depth-first search for every element with the given (case-insensitive) qualified name. */
export function findAll(el: XmlElement, name: string, out: XmlElement[] = []): XmlElement[] {
  const want = name.toLowerCase();
  for (const c of el.children) {
    if (c.name.toLowerCase() === want) out.push(c);
    else findAll(c, name, out);
  }
  return out;
}

/** The first direct child whose qualified name matches one of `names`. */
export function child(el: XmlElement, ...names: string[]): XmlElement | undefined {
  for (const want of names) {
    const w = want.toLowerCase();
    const hit = el.children.find((c) => c.name.toLowerCase() === w);
    if (hit) return hit;
  }
  return undefined;
}

/** All text inside an element, including nested elements (for feeds that put HTML in titles). */
export function deepText(el: XmlElement): string {
  let s = el.text;
  for (const c of el.children) s += deepText(c);
  return s;
}
