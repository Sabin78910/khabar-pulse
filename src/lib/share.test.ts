import { shareStory, shareText } from "./share.ts";
import type { Cluster } from "../pipeline/types.ts";

const c: Cluster = {
  id: "c1",
  title: "Gagan Thapa elected",
  snippet: "Secret snippet text",
  url: "https://kathmandupost.com/a",
  sourceId: "kp",
  lang: "en",
  region: "nepal",
  topic: "general",
  updatedAt: 1,
  firstAt: 1,
  score: 1,
  items: [{ sourceId: "kp", title: "Gagan Thapa elected", url: "https://kathmandupost.com/a", publishedAt: 1 }],
};

describe("shareText", () => {
  it("is the headline, the publisher URL and the attribution, never the snippet", () => {
    const text = shareText(c, "en");
    expect(text).toBe("Gagan Thapa elected\nhttps://kathmandupost.com/a\nvia Khabar Pulse");
    expect(text).not.toContain("Secret");
  });
  it("uses the Nepali attribution", () => {
    expect(shareText(c, "ne")).toContain("खबर पल्स");
  });
});

describe("shareStory", () => {
  it("uses navigator.share when available", async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn();
    expect(await shareStory(c, "en", { share, clipboard: { writeText } })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: c.title, text: shareText(c, "en"), url: c.url });
    expect(writeText).not.toHaveBeenCalled();
  });
  it("treats a dismissed share sheet as cancelled, not a failure", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("x", "AbortError");
    });
    expect(await shareStory(c, "en", { share })).toBe("cancelled");
  });
  it("copies to the clipboard when sharing is unavailable", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareStory(c, "en", { clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(shareText(c, "en"));
  });
  it("reports failure when nothing works", async () => {
    expect(await shareStory(c, "en", {})).toBe("failed");
  });
  it("refuses non-http publisher URLs", async () => {
    expect(await shareStory({ ...c, url: "javascript:alert(1)" }, "en", { share: vi.fn() })).toBe("failed");
  });
});
