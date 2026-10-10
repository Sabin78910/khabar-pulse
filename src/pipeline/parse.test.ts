import { ATOM_XML as atomXml, RSS_XML as rssXml } from "./__fixtures__/feeds.ts";
import { parseFeed } from "./rss.ts";
import { child, decodeEntities, deepText, findAll, parseXml } from "./xml.ts";
import { cleanTitle, fromNepaliDigits, makeSnippet, stripHtml, toNepaliDigits } from "./text.ts";

const fixture = (name: string) => (name === "rss.xml" ? rssXml : atomXml);

describe("xml parser", () => {
  it("parses nested elements, attributes and CDATA", () => {
    const root = parseXml(`<a x="1"><b y='two'>hi <![CDATA[<raw> & stuff]]></b><c/></a>`);
    const a = root.children[0];
    expect(a.attrs.x).toBe("1");
    expect(child(a, "b")?.attrs.y).toBe("two");
    expect(child(a, "b")?.text).toBe("hi <raw> & stuff");
    expect(child(a, "c")?.children).toEqual([]);
  });

  it("decodes named and numeric entities and leaves unknown ones", () => {
    expect(decodeEntities("a &amp; b &#8230; &#x2014; &nbsp;x &bogus;")).toBe("a & b … —  x &bogus;");
  });

  it("survives unclosed tags, stray closers and bare < in text", () => {
    const root = parseXml(`<r><item><title>One < two</title><br></item></oops><item><title>Two</title></item></r>`);
    const titles = findAll(root, "title").map((t) => deepText(t));
    expect(titles).toEqual(["One < two", "Two"]);
  });

  it("skips comments, processing instructions and doctype", () => {
    const root = parseXml(`<?xml version="1.0"?><!DOCTYPE x><!-- c --><x>ok</x>`);
    expect(root.children.map((c) => c.name)).toEqual(["x"]);
  });
});

describe("parseFeed", () => {
  it("reads RSS 2.0 items with media thumbnails, guid links and dc:date", () => {
    const items = parseFeed(fixture("rss.xml"));
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Gagan Thapa elected Nepali Congress president");
    expect(items[0].link).toBe("https://example.com/national/2026/10/10/gagan-thapa?utm_source=rss");
    expect(items[0].image).toBe("https://example.com/img/thapa.jpg"); // upgraded to https
    expect(items[0].categories).toEqual(["Politics"]);
    expect(items[1].link).toBe("https://example.com/second");
    expect(items[1].date).toBe("2026-10-10T10:00:00Z");
    expect(items[1].image).toBe("https://cdn.example.com/second.webp");
  });

  it("reads Atom entries (alternate link, enclosure image, term categories)", () => {
    const [e] = parseFeed(fixture("atom.xml"));
    expect(e.link).toBe("https://atom.example.org/one");
    expect(e.image).toBe("https://atom.example.org/one.jpg");
    expect(e.categories).toEqual(["Technology"]);
    expect(cleanTitle(e.title)).toBe("Atom story one");
  });

  it("reads RSS 1.0 (RDF) items that sit beside the channel", () => {
    const rdf = `<rdf:RDF><channel><title>x</title></channel><item><title>RDF item</title><link>https://dw.example/a</link><dc:date>2026-10-10T09:00:00Z</dc:date></item></rdf:RDF>`;
    expect(parseFeed(rdf)[0]).toMatchObject({ title: "RDF item", link: "https://dw.example/a" });
  });

  it("prefers the largest media:content rendition", () => {
    const xml = `<rss><channel><item><title>t</title><link>https://g.example/a</link>
      <media:content url="https://i.example/140.jpg" width="140"/><media:content url="https://i.example/460.jpg" width="460"/></item></channel></rss>`;
    expect(parseFeed(xml)[0].image).toBe("https://i.example/460.jpg");
  });

  it("returns an empty list for garbage", () => {
    expect(parseFeed("<html><body>Not a feed</body></html>")).toEqual([]);
    expect(parseFeed("")).toEqual([]);
  });
});

describe("text helpers", () => {
  it("strips tags, scripts and escaped HTML", () => {
    expect(stripHtml("<p>Hello <b>world</b></p><script>x()</script>")).toBe("Hello world");
    expect(stripHtml("&lt;p&gt;Escaped&lt;/p&gt; text")).toBe("Escaped text");
  });

  it("keeps snippets to 200 characters, cut at a word, with an ellipsis", () => {
    const long = "word ".repeat(100);
    const s = makeSnippet(long);
    expect(s.length).toBeLessThanOrEqual(200);
    expect(s.endsWith("…")).toBe(true);
    expect(s).not.toMatch(/\s…$/);
  });

  it("removes CMS boilerplate from snippets", () => {
    expect(makeSnippet("<p>Real text.</p><p>The post Foo appeared first on Bar.</p>")).toBe("Real text.");
    expect(makeSnippet("Something [&#8230;]")).toBe("Something");
  });

  it("converts digits between ASCII and Devanagari", () => {
    expect(toNepaliDigits(2083)).toBe("२०८३");
    expect(fromNepaliDigits("असोज २४")).toBe("असोज 24");
  });
});
