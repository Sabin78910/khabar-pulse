import { useEffect, useRef, useState } from "react";
import type { Cluster } from "../pipeline/types.ts";
import type { Strings, UiLang } from "../lib/i18n.ts";
import { toNepaliDigits } from "../pipeline/text.ts";
import { relativeTime } from "../lib/time.ts";

interface Props {
  stories: Cluster[];
  now: number;
  lang: UiLang;
  s: Strings;
  sourceName: (id: string) => string;
  onOpen: (url: string) => void;
  onClose: () => void;
}

/** "Today in 60 seconds": full-screen swipeable cards (scroll-snap), with dots and arrow keys. */
export function Briefing({ stories, now, lang, s, sourceName, onOpen, onClose }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(stories.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setIndex(clamped);
  };

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const num = (n: number) => (lang === "ne" ? toNepaliDigits(n) : String(n));

  return (
    <div className="briefing" role="dialog" aria-modal="true" aria-label={s.briefing}>
      <div className="briefing__top">
        <div>
          <p className="briefing__kicker">{s.briefing}</p>
          <p className="briefing__count" aria-live="polite">
            {num(index + 1)} / {num(stories.length)}
          </p>
        </div>
        <button ref={closeBtn} type="button" className="icon-btn" aria-label={s.close} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="briefing__progress" aria-hidden="true">
        {stories.map((c, i) => (
          <span key={c.id} className={i <= index ? "is-done" : ""} />
        ))}
      </div>
      <div
        className="briefing__track"
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(i);
        }}
      >
        {stories.map((c, i) => (
          <section key={c.id} className="briefing__card" aria-roledescription="slide" aria-label={`${num(i + 1)}`} lang={c.lang}>
            {c.image && <img className="briefing__img" src={c.image} alt="" referrerPolicy="no-referrer" loading={i < 2 ? "eager" : "lazy"} />}
            <div className="briefing__text">
              <p className="story__meta">
                <span className="story__source">{sourceName(c.sourceId)}</span> · {relativeTime(c.updatedAt, now, lang)}
                {new Set(c.items.map((x) => sourceName(x.sourceId))).size > 1 && (
                  <> · {s.sources(new Set(c.items.map((x) => sourceName(x.sourceId))).size)}</>
                )}
              </p>
              <h2 className="briefing__title">{c.title}</h2>
              {c.snippet && <p className="briefing__snippet">{c.snippet}</p>}
              <button type="button" className="btn btn--primary" onClick={() => onOpen(c.url)}>
                {s.readAt(sourceName(c.sourceId))} ↗
              </button>
            </div>
          </section>
        ))}
      </div>
      <div className="briefing__nav">
        <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
          ← {s.prev}
        </button>
        {index < stories.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => go(index + 1)}>
            {s.next} →
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {s.close}
          </button>
        )}
      </div>
    </div>
  );
}
