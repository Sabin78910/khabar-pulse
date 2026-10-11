import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefing } from "./components/Briefing.tsx";
import { BookmarkIcon, StoryCard, StorySkeleton } from "./components/StoryCard.tsx";
import { isPayload, loadNews, newsEndpoints } from "./lib/api.ts";
import { parseBookmarks, toggleBookmark, type Bookmark } from "./lib/bookmarks.ts";
import { bsFromTimestamp, formatBs, nepalWeekday } from "./lib/bs.ts";
import { pickBriefing } from "./lib/briefing.ts";
import { sourceProfile, t, type UiLang } from "./lib/i18n.ts";
import { isNative, openArticle } from "./lib/open.ts";
import { KEYS, readJson, writeJson } from "./lib/storage.ts";
import { EMPTY_STREAK, liveStreak, parseStreak, recordRead, type Streak } from "./lib/streak.ts";
import { dayKey, relativeTime } from "./lib/time.ts";
import { useInstallPrompt } from "./install.ts";
import { filterClusters } from "./pipeline/pipeline.ts";
import { toNepaliDigits } from "./pipeline/text.ts";
import { CATEGORIES, type Category, type Cluster, type NewsPayload } from "./pipeline/types.ts";

type Theme = "dark" | "light";
type ContentLang = "all" | "ne" | "en";
type Status = "loading" | "ready" | "error";

const PULL_TRIGGER = 72;

function initialTheme(): Theme {
  const saved = readJson<Theme | null>(KEYS.theme, (v) => (v === "light" || v === "dark" ? v : null), null);
  if (saved) return saved;
  return globalThis.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [lang, setLang] = useState<UiLang>(() => readJson<UiLang>(KEYS.lang, (v) => (v === "en" ? "en" : "ne"), "ne"));
  const [contentLang, setContentLang] = useState<ContentLang>(() =>
    readJson<ContentLang>(KEYS.contentLang, (v) => (v === "ne" || v === "en" ? v : "all"), "all"),
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [payload, setPayload] = useState<NewsPayload | null>(() => readJson(KEYS.news, (v) => (isPayload(v) ? v : null), null));
  const [status, setStatus] = useState<Status>(payload ? "ready" : "loading");
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [cat, setCat] = useState<Category>("top");
  const [view, setView] = useState<"feed" | "saved">("feed");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => readJson(KEYS.bookmarks, parseBookmarks, []));
  const [streak, setStreak] = useState<Streak>(() => readJson(KEYS.streak, parseStreak, EMPTY_STREAK));
  const [toast, setToast] = useState<{ text: string; big: boolean } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const { canInstall, install } = useInstallPrompt();
  const s = t(lang);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0B0B0F" : "#FAFAF7");
    writeJson(KEYS.theme, theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    writeJson(KEYS.lang, lang);
  }, [lang]);
  useEffect(() => writeJson(KEYS.contentLang, contentLang), [contentLang]);
  useEffect(() => writeJson(KEYS.bookmarks, bookmarks), [bookmarks]);
  useEffect(() => writeJson(KEYS.streak, streak), [streak]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { payload: p } = await loadNews(newsEndpoints(import.meta.env.VITE_API_URL, isNative()), fetch);
      setPayload(p);
      setStatus("ready");
      writeJson(KEYS.news, p);
    } catch {
      setStatus((st) => (st === "ready" ? "ready" : "error"));
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    // Re-check every 10 minutes while the app is open (matches the Worker cron).
    const poll = setInterval(() => document.visibilityState === "visible" && void refresh(), 10 * 60_000);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.big ? 4200 : 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const sourceName = useMemo(() => {
    const m = new Map((payload?.sources ?? []).map((x) => [x.id, lang === "ne" && x.nameNe ? x.nameNe : x.name]));
    return (id: string) => m.get(id) ?? id;
  }, [payload, lang]);

  const profileOf = useMemo(() => {
    const m = new Map((payload?.sources ?? []).map((x) => [x.id, x]));
    return (id: string) => sourceProfile(m.get(id), lang);
  }, [payload, lang]);

  const visible = useMemo(
    () => filterClusters(payload?.clusters ?? [], { cat, lang: contentLang, q: query }),
    [payload, cat, contentLang, query],
  );
  const briefing = useMemo(
    () => pickBriefing(filterClusters(payload?.clusters ?? [], { cat: "top", lang: contentLang })),
    [payload, contentLang],
  );
  const savedIds = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks]);

  const onOpen = useCallback(
    (url: string) => {
      void openArticle(url);
      const res = recordRead(streak, dayKey(Date.now()));
      setStreak(res.streak);
      if (res.milestone) setToast({ text: t(lang).streakMilestone(res.milestone), big: true });
      else if (res.newDay) setToast({ text: t(lang).streakNew(res.streak.current), big: false });
    },
    [streak, lang],
  );

  const onToggleSave = useCallback((c: Cluster) => setBookmarks((list) => toggleBookmark(list, c, Date.now())), []);

  const today = now;
  const bs = bsFromTimestamp(today);
  const bsText = formatBs(bs, lang, lang === "ne" ? nepalWeekday(today) : undefined);
  const adText = new Date(today).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", {
    weekday: lang === "ne" ? undefined : "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const streakNow = liveStreak(streak, dayKey(now));

  // Pull to refresh (touch only, at the top of the page).
  const onTouchStart = (e: React.TouchEvent) => {
    pullStart.current = window.scrollY <= 0 && !briefingOpen ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current === null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    setPull(dy > 0 ? Math.min(110, dy * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER && !refreshing) void refresh();
    pullStart.current = null;
    setPull(0);
  };

  const updatedLabel = payload ? s.updated(relativeTime(payload.generatedAt, now, lang)) : "";

  return (
    <div className="app" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <a className="skip" href="#feed">
        Skip to stories
      </a>
      <header className="masthead">
        <div className="masthead__row">
          <div className="brand">
            <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="16" fill="#DC143C" />
              <path d="M10 36h10l5-12 8 22 6-16 4 6h11" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h1 className="brand__name">{s.appName}</h1>
              <p className="brand__date">
                <span lang={lang}>{bsText}</span>
                <span className="brand__ad"> · {adText}</span>
              </p>
            </div>
          </div>
          <div className="masthead__actions">
            {streakNow > 0 && (
              <span className="streak" title={s.streak(streakNow)} aria-label={s.streak(streakNow)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5Z" fill="currentColor" />
                </svg>
                {lang === "ne" ? toNepaliDigits(streakNow) : streakNow}
              </span>
            )}
            <button
              type="button"
              className={`icon-btn${searchOpen ? " is-on" : ""}`}
              aria-label={s.search}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setQuery("");
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`icon-btn${view === "saved" ? " is-on" : ""}`}
              aria-label={s.bookmarks}
              aria-pressed={view === "saved"}
              onClick={() => setView((v) => (v === "saved" ? "feed" : "saved"))}
            >
              <BookmarkIcon filled={view === "saved"} />
            </button>
            <button type="button" className="icon-btn icon-btn--text" aria-label={s.language} title={s.language} onClick={() => setLang(lang === "ne" ? "en" : "ne")}>
              {lang === "ne" ? "EN" : "ने"}
            </button>
            <button type="button" className="icon-btn" aria-label={s.theme} title={s.theme} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.5" fill="currentColor" />
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="search">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.searchPlaceholder}
              aria-label={s.search}
            />
          </div>
        )}
        {view === "feed" && (
          <nav className="tabs" aria-label="Sections">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`tab${cat === c ? " is-active" : ""}`} aria-current={cat === c ? "page" : undefined} onClick={() => setCat(c)}>
                {s.tabs[c]}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="pull" style={{ height: pull }} aria-hidden={pull === 0}>
        {pull > 0 && <span>{pull >= PULL_TRIGGER ? s.release : s.pullToRefresh}</span>}
      </div>

      <main id="feed" className="feed">
        {offline && <p className="notice">{s.offline}</p>}

        {view === "saved" ? (
          <section aria-label={s.bookmarks}>
            <h2 className="section-title">{s.bookmarks}</h2>
            {bookmarks.length === 0 ? (
              <p className="empty">{s.noSaved}</p>
            ) : (
              <ul className="saved">
                {bookmarks.map((b) => (
                  <li key={b.id} lang={b.lang}>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpen(b.url);
                      }}
                    >
                      <span className="story__meta">
                        <span className="story__source">{sourceName(b.sourceId)}</span> · {relativeTime(b.publishedAt, now, lang)}
                      </span>
                      <span className="saved__title">{b.title}</span>
                    </a>
                    <button type="button" className="icon-btn is-on" aria-label={s.unsave} onClick={() => setBookmarks((l) => l.filter((x) => x.id !== b.id))}>
                      <BookmarkIcon filled />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            <div className="toolbar">
              <div className="seg" role="group" aria-label={s.contentLang}>
                {(["all", "ne", "en"] as const).map((v) => (
                  <button key={v} type="button" className={contentLang === v ? "is-on" : ""} aria-pressed={contentLang === v} onClick={() => setContentLang(v)}>
                    {v === "all" ? s.contentAll : v === "ne" ? s.contentNe : s.contentEn}
                  </button>
                ))}
              </div>
              <button type="button" className="refresh" onClick={() => void refresh()} disabled={refreshing} aria-label={s.refresh}>
                <svg className={refreshing ? "spin" : ""} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{refreshing ? s.refreshing : updatedLabel || s.refresh}</span>
              </button>
            </div>

            {cat === "top" && !query && status === "ready" && briefing.length > 0 && (
              <button type="button" className="briefing-cta" onClick={() => setBriefingOpen(true)}>
                <span className="briefing-cta__pulse" aria-hidden="true" />
                <span className="briefing-cta__text">
                  <strong>{s.briefing}</strong>
                  <span>{s.briefingHint}</span>
                </span>
                <span className="briefing-cta__go" aria-hidden="true">→</span>
              </button>
            )}

            {status === "loading" && (
              <div className="grid" aria-busy="true">
                <StorySkeleton lead />
                {Array.from({ length: 6 }, (_, i) => (
                  <StorySkeleton key={i} />
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="empty">
                <p>{s.loadError}</p>
                <button type="button" className="btn btn--primary" onClick={() => void refresh()}>
                  {s.retry}
                </button>
              </div>
            )}

            {status === "ready" && visible.length === 0 && <p className="empty">{query ? s.noResults(query) : s.empty}</p>}

            {status === "ready" && visible.length > 0 && (
              <div className="grid">
                {visible.slice(0, 120).map((c, i) => (
                  <StoryCard
                    key={c.id}
                    cluster={c}
                    lead={i === 0 && !query}
                    now={now}
                    lang={lang}
                    s={s}
                    sourceName={sourceName}
                    profileOf={profileOf}
                    saved={savedIds.has(c.id)}
                    onOpen={onOpen}
                    onToggleSave={onToggleSave}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>{s.legal}</p>
        <p>
          {canInstall && (
            <button type="button" className="btn" onClick={() => void install()}>
              {s.install}
            </button>
          )}{" "}
          <a href="https://sabin78910.github.io/privacy-policy/" target="_blank" rel="noopener noreferrer">
            {s.privacy}
          </a>{" "}
          · <a href="https://github.com/Sabin78910/khabar-pulse" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>

      {toast && (
        <div className={`toast${toast.big ? " toast--big" : ""}`} role="status">
          {toast.big && (
            <span className="toast__burst" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </span>
          )}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4-1-6 1-9.5Z" fill="currentColor" />
          </svg>
          {toast.text}
        </div>
      )}

      {briefingOpen && (
        <Briefing stories={briefing} now={now} lang={lang} s={s} sourceName={sourceName} onOpen={onOpen} onClose={() => setBriefingOpen(false)} />
      )}
    </div>
  );
}
