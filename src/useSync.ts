import { useCallback, useEffect, useRef, useState } from "react";
import { newSyncCode, parseSyncCode, SyncClient } from "./sync";
import { APP_ID, readCode, readMeta, stampDoc, syncOnce, writeCode, writeMeta } from "./syncData";
import type { SyncDoc } from "./syncData";

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

/**
 * Keeps the given items in sync across devices with an end-to-end encrypted sync code.
 * `current` maps item ids to values; `apply` receives the merged doc when remote data won.
 */
export function useSync(current: Record<string, unknown>, apply: (doc: SyncDoc) => void) {
  const [code, setCode] = useState<string | null>(() => readCode());
  const [status, setStatus] = useState<SyncStatus>(code ? "syncing" : "off");
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const doc = useRef<SyncDoc>(readMeta());
  const running = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const key = JSON.stringify(current);
  const latest = useRef(current);
  latest.current = current;

  // Stamp local edits with the time they were made.
  useEffect(() => {
    doc.current = stampDoc(doc.current, latest.current, Date.now());
    writeMeta(doc.current);
  }, [key]);

  const run = useCallback(async () => {
    if (!code || running.current) return;
    running.current = true;
    setStatus("syncing");
    try {
      doc.current = stampDoc(doc.current, latest.current, Date.now());
      const { merged, changedLocal } = await syncOnce(new SyncClient(code, APP_ID), doc.current);
      doc.current = merged;
      writeMeta(merged);
      if (changedLocal) applyRef.current(merged);
      setStatus("synced");
      setLastSynced(Date.now());
    } catch {
      setStatus(navigator.onLine === false ? "offline" : "error");
    } finally {
      running.current = false;
    }
  }, [code]);

  // Sync 2 s after a change, when the page is visible again, and when back online.
  useEffect(() => {
    if (!code) return;
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }, [code, key, run]);

  useEffect(() => {
    if (!code) return;
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [code, run]);

  const turnOn = () => { const c = newSyncCode(); writeCode(c); setCode(c); };
  /** Connects to a code from another device; returns false when the code is not valid. */
  const useCode = (text: string): boolean => {
    const c = text.trim();
    if (!parseSyncCode(c)) return false;
    writeCode(c);
    setCode(c);
    return true;
  };
  const turnOff = () => { writeCode(null); setCode(null); setStatus("off"); };

  return { code, status, lastSynced, turnOn, useCode, turnOff, syncNow: run };
}
