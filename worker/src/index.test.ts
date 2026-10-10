import { handle, refresh, type Env } from "./index.ts";
import type { NewsPayload } from "../../src/pipeline/types.ts";

function fakeKv(initial?: NewsPayload) {
  const store = new Map<string, string>();
  if (initial) store.set("news:v1", JSON.stringify(initial));
  return {
    store,
    kv: {
      get: async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
      put: async (k: string, v: string) => void store.set(k, v),
    } as unknown as KVNamespace,
  };
}

const cluster = (id: string, region: "nepal" | "world", lang: "ne" | "en") => ({
  id,
  title: `t ${id}`,
  snippet: "",
  url: "https://x.example",
  sourceId: "s",
  lang,
  region,
  topic: "general" as const,
  updatedAt: 1,
  firstAt: 1,
  score: 1,
  items: [],
});

const payload: NewsPayload = {
  version: 1,
  generatedAt: 123,
  failed: [],
  sources: [],
  clusters: [cluster("a", "nepal", "ne"), cluster("b", "world", "en")],
};

describe("worker API", () => {
  it("serves filtered news with CORS and cache headers", async () => {
    const env: Env = { NEWS: fakeKv(payload).kv };
    const res = await handle(new Request("https://api.example/api/news?cat=world&lang=en"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("max-age=120");
    const body = (await res.json()) as NewsPayload;
    expect(body.clusters.map((c) => c.id)).toEqual(["b"]);
  });

  it("answers preflight, 503 before the first refresh, 404 elsewhere", async () => {
    const env: Env = { NEWS: fakeKv().kv };
    expect((await handle(new Request("https://api.example/api/news", { method: "OPTIONS" }), env)).status).toBe(204);
    expect((await handle(new Request("https://api.example/api/news"), env)).status).toBe(503);
    expect((await handle(new Request("https://api.example/nope"), env)).status).toBe(404);
  });

  it("reports health", async () => {
    const env: Env = { NEWS: fakeKv(payload).kv };
    const body = (await (await handle(new Request("https://api.example/api/health"), env)).json()) as { ok: boolean; stories: number };
    expect(body).toMatchObject({ ok: true, stories: 2 });
  });

  it("keeps the previous payload when every feed fails", async () => {
    const { kv, store } = fakeKv(payload);
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
    try {
      const fresh = await refresh({ NEWS: kv }, 999);
      expect(fresh.clusters).toHaveLength(0);
      expect(JSON.parse(store.get("news:v1")!).generatedAt).toBe(123);
    } finally {
      globalThis.fetch = original;
    }
  });
});
