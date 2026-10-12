import { useState } from "react";
import type { Strings } from "../lib/i18n.ts";
import type { SyncStatus } from "../lib/useSync.ts";

interface Props {
  s: Strings;
  code: string | null;
  status: SyncStatus;
  onTurnOn: () => void;
  onUseCode: (text: string) => boolean;
  onSyncNow: () => void;
  onTurnOff: () => void;
  onClose: () => void;
}

/** Settings sheet for cross-device sync. Never renders the code anywhere but the field the user opened. */
export function SyncSheet({ s, code, status, onTurnOn, onUseCode, onSyncNow, onTurnOff, onClose }: Props) {
  const [paste, setPaste] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code ?? "");
      setCopied(true);
    } catch {
      // Clipboard blocked: the code is selectable in the field.
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={s.syncOpen} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>{s.syncOpen}</h2>
          <button type="button" className="icon-btn" aria-label={s.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <p>{s.syncIntro}</p>

        {code ? (
          <>
            <label className="sheet__label" htmlFor="sync-code">
              {s.syncYourCode}
            </label>
            <div className="sheet__row">
              <input id="sync-code" readOnly value={code} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn" onClick={() => void copy()}>
                {copied ? s.syncCopied : s.syncCopy}
              </button>
            </div>
            <p className="sheet__hint">{s.syncKeepSafe}</p>
            <div className="sheet__row">
              <button type="button" className="btn btn--primary" onClick={onSyncNow} disabled={status === "syncing"}>
                {s.syncNow}
              </button>
              <button type="button" className="btn" onClick={onTurnOff}>
                {s.syncTurnOff}
              </button>
            </div>
            <p className="sheet__hint">{s.syncTurnOffHint}</p>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary" onClick={onTurnOn}>
              {s.syncTurnOn}
            </button>
            <h3>{s.syncUseCode}</h3>
            <form
              className="sheet__row"
              onSubmit={(e) => {
                e.preventDefault();
                setInvalid(!onUseCode(paste));
              }}
            >
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={s.syncPaste} aria-label={s.syncPaste} autoComplete="off" spellCheck={false} />
              <button type="submit" className="btn">
                {s.syncUse}
              </button>
            </form>
            {invalid && <p role="alert" className="sheet__error">{s.syncInvalid}</p>}
          </>
        )}
      </div>
    </div>
  );
}
