// Khabar Pulse API: a Cloudflare Worker.
// - Cron (every 10 min): fetch every RSS feed, cluster, rank, store the payload in KV.
// - GET /api/news?cat=&lang=&q=  → filtered payload, CORS-enabled, edge-cached for 2 minutes.
// - GET /api/health → { ok, generatedAt, stories }
import { SOURCES } from "../../src/config/sources.ts";
import { filterClusters, parseCategory, parseLang, runPipeline } from "../../src/pipeline/pipeline.ts";
import type { NewsPayload } from "../../src/pipeline/types.ts";

export interface Env {
  NEWS: KVNamespace;
}

const KEY = "news:v1";

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, maxAge = 120): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=600`,
    },
  });
}

export async function refresh(env: Env, now = Date.now()): Promise<NewsPayload> {
  const previous = (await env.NEWS.get<NewsPayload>(KEY, "json")) ?? undefined;
  const payload = await runPipeline(SOURCES, fetch, { now, previous });
  if (payload.clusters.length > 0 || !previous) await env.NEWS.put(KEY, JSON.stringify(payload));
  return payload;
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, 0);
  if (url.pathname === "/api/health") {
    const p = await env.NEWS.get<NewsPayload>(KEY, "json");
    return json({ ok: !!p, generatedAt: p?.generatedAt ?? null, stories: p?.clusters.length ?? 0 }, 200, 30);
  }
  if (url.pathname === "/api/news") {
    const p = await env.NEWS.get<NewsPayload>(KEY, "json");
    if (!p) return json({ error: "Warming up: the first refresh has not run yet." }, 503, 0);
    const clusters = filterClusters(p.clusters, {
      cat: parseCategory(url.searchParams.get("cat")),
      lang: parseLang(url.searchParams.get("lang")),
      q: url.searchParams.get("q") ?? undefined,
    });
    return json({ ...p, clusters });
  }
  return json({ error: "Not found" }, 404, 0);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cache = (caches as unknown as { default: Cache }).default;
    if (req.method === "GET") {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    const res = await handle(req, env);
    if (req.method === "GET" && res.status === 200) ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
