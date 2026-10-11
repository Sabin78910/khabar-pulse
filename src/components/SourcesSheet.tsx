import { useEffect, useRef } from "react";
import type { Strings, UiLang } from "../lib/i18n.ts";
import type { SourceInfo } from "../pipeline/types.ts";

interface Props {
  sources: SourceInfo[];
  hidden: ReadonlySet<string>;
  lang: UiLang;
  s: Strings;
  onToggle: (id: string) => void;
  onClose: () => void;
}

/** Bottom sheet listing every outlet with an on/off switch. */
export function SourcesSheet({ sources, hidden, lang, s, onToggle, onClose }: Props) {
  const closeBtn = useRef<HTMLButtonElement>(null);

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

  const groups = [
    { key: "ne", title: s.groupNe, list: sources.filter((x) => x.region === "nepal" && x.lang === "ne") },
    { key: "en", title: s.groupEn, list: sources.filter((x) => x.region === "nepal" && x.lang !== "ne") },
    { key: "world", title: s.groupWorld, list: sources.filter((x) => x.region === "world") },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={s.sourcesTitle}>
      <div className="sheet__panel">
        <div className="sheet__top">
          <h2 className="section-title">{s.sourcesTitle}</h2>
          <button ref={closeBtn} type="button" className="icon-btn" aria-label={s.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="sheet__hint">{s.sourcesHint}</p>
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <h3 className="sheet__group">{g.title}</h3>
            <ul className="sheet__list">
              {g.list.map((x) => {
                const name = lang === "ne" && x.nameNe ? x.nameNe : x.name;
                const label = x.topic === "general" ? name : `${name} (${s.tabs[x.topic]})`;
                return (
                  <li key={x.id}>
                    <label className="sheet__row">
                      <span>{label}</span>
                      <input type="checkbox" role="switch" checked={!hidden.has(x.id)} onChange={() => onToggle(x.id)} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
