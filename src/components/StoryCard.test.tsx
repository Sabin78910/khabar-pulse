import { render } from "@testing-library/react";
import { StoryCard } from "./StoryCard.tsx";
import { t } from "../lib/i18n.ts";
import type { Cluster } from "../pipeline/types.ts";

const cluster = {
  id: "c1",
  title: "Headline",
  snippet: "Snippet",
  url: "https://example.org/a",
  image: "https://example.org/a.jpg",
  lang: "en",
  sourceId: "s1",
  updatedAt: Date.now(),
  items: [{ sourceId: "s1", url: "https://example.org/a", title: "Headline", publishedAt: Date.now() }],
} as unknown as Cluster;

function renderCard(lead: boolean) {
  const { container } = render(
    <StoryCard cluster={cluster} lead={lead} now={Date.now()} lang="en" s={t("en")} sourceName={(id) => id} saved={false} onOpen={() => {}} onToggleSave={() => {}} />,
  );
  return container.querySelector("img")!;
}

describe("StoryCard thumbnail", () => {
  it("reserves space and lazy-loads a normal card image", () => {
    const img = renderCard(false);
    expect(img).toHaveAttribute("width", "96");
    expect(img).toHaveAttribute("height", "96");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("loads the lead image eagerly with high priority", () => {
    const img = renderCard(true);
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).toHaveAttribute("width");
    expect(img).toHaveAttribute("height");
  });
});
