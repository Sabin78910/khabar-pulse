# Khabar Pulse · खबर पल्स

Fast, clean, trustworthy Nepal and world news. One feed from 44 outlets, with the same story from several
outlets merged into one card that says **"N sources"** and lists every outlet.

**Live:** https://sabin78910.github.io/khabar-pulse/

- Tabs: Top, Nepal, World, Business, Sports, Tech, Entertainment; Nepali/English UI and story-language filter
- "Today in 60 seconds": the top 8 stories as swipeable cards
- Search, bookmarks, a gentle reading streak, pull to refresh, skeleton loaders, offline cache, dark/light
- Bikram Sambat date in the header (with tests), relative times in Nepali numerals
- Legal by design: only the headline, a ≤200-character snippet, the thumbnail and the source name with time.
  Every tap opens the publisher's own article.

## How the news gets here
```
RSS/Atom feeds ──► pipeline (src/pipeline, pure TS)
                   fetch → parse → clean → dedupe → cluster (Devanagari-aware) → rank → categorise
        ├─ Cloudflare Worker (worker/): cron every 10 min → KV → GET /api/news?cat=&lang=&q=
        └─ GitHub Actions (deploy.yml): every 30 min → news.json published with the Pages site
App: uses VITE_API_URL when the Worker is live, otherwise ./news.json
```
The GitHub Actions path works with no setup. To turn on the faster Worker, add the repo secrets
`CLOUDFLARE_API_TOKEN` (Workers + KV edit) and `CLOUDFLARE_ACCOUNT_ID`, then run **Deploy Worker API**.
It creates the KV namespace, deploys, seeds it, and rebuilds the site so it uses the API.
Note: the free Workers plan limits CPU time per run; if the cron hits that limit, the news.json fallback still updates.

## Develop
```
npm ci
npm run news     # fetch live feeds into public/news.json
npm run dev
npm test && npm run lint && npm run typecheck && npm run build
```

## Android
Capacitor wraps the web build (`com.sabinkhanal.khabarpulse`). `Android CI` builds a release AAB with JDK 21 and signs
it when `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` exist. Play listing text: `store/`.

Privacy: https://sabin78910.github.io/privacy-policy/ · License: MIT
