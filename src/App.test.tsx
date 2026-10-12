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
});

describe("sync across devices", () => {
  // A fake sync server: stores whatever ciphertext is PUT and returns it on GET.
  function stubServer() {
    let doc: { version: number; data: string } | null = null;
    const puts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!String(url).includes("/v1/spaces/")) return new Response(JSON.stringify(payload));
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          puts.push(body.data);
          doc = { version: (doc?.version ?? 0) + 1, data: body.data };
          return new Response(JSON.stringify({ version: doc.version }));
        }
        return doc ? new Response(JSON.stringify(doc)) : new Response("{}", { status: 404 });
      }),
    );
    return { puts };
  }

  it("turns on, shows a code, and syncs only ciphertext under the khabar-pulse app id", async () => {
    const server = stubServer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sync across devices" }));
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    const code = (screen.getByLabelText("Your sync code") as HTMLInputElement).value;
    expect(code).toMatch(/^SS1-/);
    expect(localStorage.getItem("sabin-labs-sync-code")).toBe(code);
    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.puts[0]).not.toContain("kathmandupost");
    const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith("/khabar-pulse"))).toBe(true);
    expect(await screen.findByRole("button", { name: /Synced · / })).toBeInTheDocument();
  });

  it("rejects an invalid pasted code and forgets the code when turned off", async () => {
    stubServer();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sync across devices" }));
    await user.type(screen.getByLabelText("Paste sync code"), "nope");
    await user.click(screen.getByRole("button", { name: "Use code" }));
    expect(screen.getByRole("alert")).toHaveTextContent("not a valid sync code");
    expect(localStorage.getItem("sabin-labs-sync-code")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Turn on" }));
    await user.click(screen.getByRole("button", { name: "Turn off" }));
    expect(localStorage.getItem("sabin-labs-sync-code")).toBeNull();
  });

  it("keeps working and shows Error with retry when the server fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (String(url).includes("/v1/spaces/") ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(payload)))),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sync across devices" }));
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByRole("button", { name: /Sync error · Retry/ })).toBeInTheDocument();
  });
});
