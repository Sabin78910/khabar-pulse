import { useState } from "react";
import type { Cluster } from "../pipeline/types.ts";
import type { Strings, UiLang } from "../lib/i18n.ts";
import { relativeTime } from "../lib/time.ts";

interface Props {
  cluster: Cluster;
  lead?: boolean;
  now: number;
  lang: UiLang;
  s: Strings;
  sourceName: (id: string) => string;
  /** Owner and country label for an outlet, "" when unknown. */
  profileOf: (id: string) => string;
  saved: boolean;
  onOpen: (url: string) => void;
  onToggleSave: (c: Cluster) => void;
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One story: headline, short snippet, thumbnail, source + time, and every outlet that covered it. */
export function StoryCard({ cluster: c, lead, now, lang, s, sourceName, profileOf, saved, onOpen, onToggleSave }: Props) {
  const [showSources, setShowSources] = useState(false);
  const outlets = [...new Set(c.items.map((i) => sourceName(i.sourceId)))];
  const [imgOk, setImgOk] = useState(true);
  return (
    <article className={`story${lead ? " story--lead" : ""}`} lang={c.lang}>
      <a
        className="story__main"
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          onOpen(c.url);
        }}
        aria-label={`${c.title}. ${s.opensPublisher}: ${sourceName(c.sourceId)}`}
      >
        {c.image && imgOk && (
          <div className="story__media">
            <img src={c.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          </div>
        )}
        <div className="story__body">
          <p className="story__meta">
            <span className="story__source">{sourceName(c.sourceId)}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={new Date(c.updatedAt).toISOString()}>{relativeTime(c.updatedAt, now, lang)}</time>
          </p>
          <h2 className="story__title">{c.title}</h2>
          {c.snippet && <p className="story__snippet">{c.snippet}</p>}
        </div>
      </a>
      <div className="story__actions">
        {outlets.length > 1 ? (
          <button
            type="button"
            className="chip chip--sources"
            aria-expanded={showSources}
            onClick={() => setShowSources((v) => !v)}
          >
            <span className="chip__dot" aria-hidden="true" />
            {s.sources(outlets.length)}
          </button>
        ) : (
          <span className="chip chip--quiet chip--caution">{s.singleSource}</span>
        )}
        <button
          type="button"
          className={`icon-btn${saved ? " is-on" : ""}`}
          aria-pressed={saved}
          aria-label={saved ? s.unsave : s.save}
          title={saved ? s.unsave : s.save}
          onClick={() => onToggleSave(c)}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      {showSources && (
        <ul className="sources" aria-label={s.coveredBy}>
          {c.items.map((it) => (
            <li key={it.url}>
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(it.url);
                }}
              >
                <span className="sources__name">{sourceName(it.sourceId)}</span>
                {profileOf(it.sourceId) && <span className="sources__profile">{profileOf(it.sourceId)}</span>}
                <span className="sources__title">{it.title}</span>
                <span className="sources__time">{relativeTime(it.publishedAt, now, lang)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function StorySkeleton({ lead }: { lead?: boolean }) {
  return (
    <div className={`story story--skeleton${lead ? " story--lead" : ""}`} aria-hidden="true">
      <div className="story__main">
        <div className="story__media sk" />
        <div className="story__body">
          <div className="sk sk--line sk--short" />
          <div className="sk sk--line" />
          <div className="sk sk--line" />
          <div className="sk sk--line sk--mid" />
        </div>
      </div>
    </div>
  );
}
