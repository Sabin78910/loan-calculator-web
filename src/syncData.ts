import { parseSyncCode, type PushResult } from "./sync";

export const APP_ID = "loan-calculator-web";
/** Shared by every Sabin Labs web app on this origin: sign in once on the hub, synced everywhere. */
export const SHARED_CODE_KEY = "sabin-labs-sync-code";
export const META_KEY = "loan-calculator:sync-meta";

/** One synced item (a compare slot, the saved inputs, currency or theme). `v: null` marks a removed item. */
export type Entry = { v: unknown; at: number };
export type SyncDoc = Record<string, Entry>;

/** The part of SyncClient that syncing needs, so tests can use a fake. */
export interface SyncTransport {
  pull<T>(): Promise<{ version: number; value: T } | null>;
  push(value: unknown, baseVersion: number): Promise<PushResult>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function isEntry(e: unknown): e is Entry {
  return !!e && typeof e === "object" && typeof (e as Entry).at === "number" && "v" in (e as object);
}

/** Merge by id, keeping the entry with the newest updatedAt; ties keep the local one. */
export function mergeDocs(local: SyncDoc, remote: SyncDoc): SyncDoc {
  const out: SyncDoc = { ...local };
  for (const [id, e] of Object.entries(remote ?? {})) {
    if (!isEntry(e)) continue;
    const mine = out[id];
    if (!mine || e.at > mine.at) out[id] = e;
  }
  return out;
}

/** Re-stamps with `now` only the items whose value differs from what the doc already holds. */
export function stampDoc(prev: SyncDoc, current: Record<string, unknown>, now: number): SyncDoc {
  const out: SyncDoc = { ...prev };
  for (const [id, v] of Object.entries(current)) {
    if (!out[id] || !same(out[id].v, v)) out[id] = { v, at: now };
  }
  return out;
}

/**
 * One sync round: pull, merge, and push only when the merge adds something the server lacks.
 * Retries on a version conflict. Returns the merged doc and whether local data changed.
 */
export async function syncOnce(
  client: SyncTransport,
  local: SyncDoc,
): Promise<{ merged: SyncDoc; changedLocal: boolean; pushed: boolean }> {
  const original = local;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await client.pull<SyncDoc>();
    const merged = remote ? mergeDocs(local, remote.value) : local;
    const changedLocal = !same(merged, original);
    if (remote && same(merged, remote.value)) return { merged, changedLocal, pushed: false };
    const res = await client.push(merged, remote?.version ?? 0);
    if (res.ok) return { merged, changedLocal, pushed: true };
    if (!res.conflict) throw new Error(res.error);
    local = merged;
  }
  throw new Error("Sync kept conflicting");
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readCode(s: KV = localStorage): string | null {
  try {
    const code = s.getItem(SHARED_CODE_KEY);
    return code && parseSyncCode(code) ? code : null;
  } catch {
    return null;
  }
}

export function writeCode(code: string | null, s: KV = localStorage): void {
  try {
    if (code) s.setItem(SHARED_CODE_KEY, code);
    else s.removeItem(SHARED_CODE_KEY);
  } catch { /* storage blocked: sync stays on for this session only */ }
}

export function readMeta(s: KV = localStorage): SyncDoc {
  try {
    const data = JSON.parse(s.getItem(META_KEY) ?? "{}");
    return Object.fromEntries(Object.entries(data).filter(([, e]) => isEntry(e))) as SyncDoc;
  } catch {
    return {};
  }
}

export function writeMeta(doc: SyncDoc, s: KV = localStorage): void {
  try { s.setItem(META_KEY, JSON.stringify(doc)); } catch { /* ignore */ }
}
