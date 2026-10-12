import { useCallback, useEffect, useRef, useState } from "react";
import { newSyncCode, parseSyncCode, SyncClient } from "../sync.ts";
import { mergeDocs, parseSyncDoc, type SyncDoc } from "./syncMerge.ts";

export const SYNC_APP = "khabar-pulse";
export const SYNC_CODE_KEY = "sabin-labs-sync-code";
export const SYNC_DEBOUNCE_MS = 2000;

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

function loadCode(): string | null {
  try {
    const c = globalThis.localStorage?.getItem(SYNC_CODE_KEY);
    return c && parseSyncCode(c) ? c : null;
  } catch {
    return null;
  }
}

function saveCode(code: string | null): void {
  try {
    if (code) globalThis.localStorage?.setItem(SYNC_CODE_KEY, code);
    else globalThis.localStorage?.removeItem(SYNC_CODE_KEY);
  } catch {
    // Storage blocked: sync stays on for this session only.
  }
}

/**
 * Keeps `doc` in step with the other devices. Local state is always the source of truth for the UI:
 * every network step happens after the user's action, and failures only change the status chip.
 * The sync code is never logged.
 */
export function useSync(doc: SyncDoc, onMerged: (merged: SyncDoc) => void) {
  const [code, setCode] = useState<string | null>(loadCode);
  const [status, setStatus] = useState<SyncStatus>(() => (loadCode() ? "syncing" : "off"));
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const onMergedRef = useRef(onMerged);
  onMergedRef.current = onMerged;
  const lastSynced = useRef<string>("");
  const running = useRef(false);
  const again = useRef(false);

  const syncNow = useCallback(async () => {
    if (!code) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");
    try {
      const client = new SyncClient(code, SYNC_APP);
      const { value } = await client.sync<SyncDoc>(docRef.current, 0, (local, remote) => mergeDocs(local, parseSyncDoc(remote)));
      lastSynced.current = JSON.stringify(value);
      onMergedRef.current(value);
      setSyncedAt(Date.now());
      setStatus("synced");
    } catch {
      setStatus(navigator.onLine === false ? "offline" : "error");
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void syncNow();
      }
    }
  }, [code]);

  // On start / when a code is set.
  useEffect(() => {
    if (code) void syncNow();
  }, [code, syncNow]);

  // On change, debounced.
  const json = JSON.stringify(doc);
  useEffect(() => {
    if (!code || json === lastSynced.current) return;
    const id = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [json, code, syncNow]);

  // When the tab becomes visible, and when the network returns.
  useEffect(() => {
    if (!code) return;
    const onVisible = () => document.visibilityState === "visible" && void syncNow();
    const onOnline = () => void syncNow();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [code, syncNow]);

  const turnOn = useCallback((): string => {
    const c = newSyncCode();
    saveCode(c);
    setCode(c);
    return c;
  }, []);

  /** Returns false when the pasted text is not a valid code. */
  const useCode = useCallback((text: string): boolean => {
    const c = text.trim();
    if (!parseSyncCode(c)) return false;
    saveCode(c);
    setCode(c);
    return true;
  }, []);

  const turnOff = useCallback(() => {
    saveCode(null);
    setCode(null);
    setStatus("off");
    setSyncedAt(null);
    lastSynced.current = "";
  }, []);

  return { code, status, syncedAt, turnOn, useCode, turnOff, syncNow };
}
