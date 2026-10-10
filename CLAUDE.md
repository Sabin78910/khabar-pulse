# Khabar Pulse
Purpose: fast, clean Nepal + world news PWA/Android app. RSS feeds → clustered stories ("N sources") → link out to publishers.

## Commands
- Test: `npm test`
- Lint: `npm run lint && npm run typecheck` (typecheck covers the app and `worker/`)
- Build: `npm run build`
- Fresh news locally: `npm run news` (writes public/news.json from the live feeds)

## Architecture
- `src/config/sources.ts` — feed list (language, region, topic). Verify a feed with curl before adding it.
- `src/pipeline/` — pure TS, shared by the Worker, the Node fallback and the app: xml → rss → normalize → categorize → cluster → rank → pipeline (filter).
- `src/lib/` — Bikram Sambat dates, relative time, streak, bookmarks, briefing, i18n, news loading.
- `src/App.tsx`, `src/components/` — UI. `public/sw.js` — offline cache.
- `worker/` — Cloudflare Worker: cron every 10 min → KV → `/api/news?cat=&lang=&q=`.
- `scripts/build-news.ts` — same pipeline in Node; `deploy.yml` publishes news.json with Pages every 30 min.
- `android/` — Capacitor project (appId com.sabinkhanal.khabarpulse); `android.yml` builds the AAB.

## Rules
- Read only the files you need; do not scan the whole repo.
- Every behavior change needs a test. Run tests and lint before finishing.
- Legal: show only headline, ≤200-char snippet, thumbnail, source name and time. Never store or show full articles. Always link to the publisher and credit every outlet.
- No new dependencies, permissions, or signing/secrets changes without asking.
- Never commit secrets, keystores, .env files.
- Keep PRs under ~300 changed lines; one issue per PR.
- Be concise: diffs plus a 3-line summary.
- If tests still fail after 3 attempts, stop and report the blocker.

## Definition of done
Lint clean, tests pass, CI green, short summary, PR opened as draft.
