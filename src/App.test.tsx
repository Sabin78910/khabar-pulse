import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.tsx";
import type { NewsPayload } from "./pipeline/types.ts";

const now = Date.now();
const payload: NewsPayload = {
  version: 1,
  generatedAt: now,
  failed: [],
  sources: [
    { id: "kp", name: "The Kathmandu Post", site: "https://kathmandupost.com", lang: "en", region: "nepal", topic: "general" },
    { id: "ok", name: "Onlinekhabar English", site: "https://english.onlinekhabar.com", lang: "en", region: "nepal", topic: "general" },
  ],
  clusters: [
    {
      id: "c1",
      title: "Gagan Thapa elected Nepali Congress president",
      snippet: "Thapa won the vote.",
      url: "https://kathmandupost.com/a",
      sourceId: "kp",
      lang: "en",
      region: "nepal",
      topic: "general",
      updatedAt: now,
      firstAt: now,
      score: 2,
      items: [
        { sourceId: "kp", title: "Gagan Thapa elected Nepali Congress president", url: "https://kathmandupost.com/a", publishedAt: now },
        { sourceId: "ok", title: "Congress elects Thapa", url: "https://english.onlinekhabar.com/b", publishedAt: now },
      ],
    },
    {
      id: "c2",
      title: "Premier League result",
      snippet: "",
      url: "https://example.com/c",
      sourceId: "kp",
      lang: "en",
      region: "world",
      topic: "sports",
      updatedAt: now,
      firstAt: now,
      score: 1,
      items: [{ sourceId: "kp", title: "Premier League result", url: "https://example.com/c", publishedAt: now }],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("kp.lang", JSON.stringify("en"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));
  vi.stubGlobal("open", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("loads stories, shows the source count and lists every outlet", async () => {
    render(<App />);
    expect(await screen.findByText("Gagan Thapa elected Nepali Congress president")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: /2 sources/ });
    await userEvent.click(chip);
    expect(screen.getByText("Onlinekhabar English")).toBeInTheDocument();
  });

  it("filters by tab and opens the publisher in a new tab, starting a streak", async () => {
    render(<App />);
    await screen.findByText("Premier League result");
    await userEvent.click(screen.getByRole("button", { name: "Sports" }));
    expect(screen.queryByText("Gagan Thapa elected Nepali Congress president")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Premier League result/ }));
    expect(window.open).toHaveBeenCalledWith("https://example.com/c", "_blank", "noopener,noreferrer");
    expect(await screen.findByRole("status")).toHaveTextContent(/Streak started/);
  });

  it("saves a bookmark and switches to Nepali", async () => {
    render(<App />);
    await screen.findByText("Premier League result");
    await userEvent.click(screen.getAllByRole("button", { name: "Save story" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /भाषा/ }));
    await waitFor(() => expect(document.documentElement.lang).toBe("ne"));
  });

  it("shows an error with retry when news cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    render(<App />);
    expect(await screen.findByText(/Could not load news/)).toBeInTheDocument();
  });

  it("hides a source from the feed and remembers the choice", async () => {
    render(<App />);
    await screen.findByText("Premier League result");
    await userEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("heading", { name: "English" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "The Kathmandu Post" }));
    expect(JSON.parse(localStorage.getItem("kp.hiddenSources") ?? "[]")).toEqual(["kp"]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Premier League result")).not.toBeInTheDocument();
    // The shared story survives, led by the remaining outlet.
    expect(screen.getByText("Congress elects Thapa")).toBeInTheDocument();
  });
});
