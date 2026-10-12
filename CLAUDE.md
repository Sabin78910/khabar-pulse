# Khabar Pulse
Nepal and world news from 44 sources, with the same story merged across outlets.

## Stack
React 19 · TypeScript (strict) · Vite · Vitest · ESLint. Installable PWA with offline support.
Design: ink and paper, Nepal crimson #DC143C accent, Fraunces headlines, Noto Sans Devanagari.

## Commands
- Dev: `npm run dev` · Build: `npm run build`
- Test: `npm test` · Lint: `npm run lint && npm run typecheck`

## Architecture
- `src/pipeline/` fetch, parse, dedupe and cluster · `src/config/sources.ts` the feed list
- `worker/` 10 minute Cloudflare refresh; `deploy.yml` rebuilds news.json every 30 minutes as a fallback.

## Data rules
- Show only headline, short snippet, thumbnail and source, then link out to the publisher. Never copy an
  article. Credit every outlet in a cluster.
- Verify a feed with curl before adding it to sources.ts.
- Cross-device sync uses the shared Sabin Labs ID: the sync code in localStorage key `sabin-labs-sync-code`,
  shared by every app on sabin78910.github.io. Never log it or send it anywhere but sync-api.

## Testing rules
- Every behaviour change needs a test. Pure logic in `src/*.ts` is unit-tested; components get the
  behaviour test, not the markup. Run lint, typecheck and tests before finishing.

## Frontend rules
- Keep the existing design system, dark-first with a working light theme. Editorial layouts, not dashboard
  grids. Respect `prefers-reduced-motion`, keep AA contrast and 44px targets.
- Self-host fonts with @fontsource; a Google Fonts link blocks first paint and costs ~2s on mobile.
- Keep gzipped JS under ~180KB and Lighthouse mobile performance at 90+.

## Security and git
- Never commit secrets, keystores, .env files or email addresses.
- Keep the Content-Security-Policy strict; add a host to connect-src only when a feature needs it.
- `main` is protected: branch, open a PR, merge when CI is green. One issue per PR, under ~300 lines.

## Done when
Lint clean, tests pass, CI green, PR opened with a three line summary. User facing work follows `docs/FEEL.md`.
