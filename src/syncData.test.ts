import { mergeDocs, readCode, readMeta, stampDoc, syncOnce, writeCode, writeMeta, SHARED_CODE_KEY } from "./syncData";
import type { SyncDoc, SyncTransport } from "./syncData";
import { newSyncCode } from "./sync";

const e = (v: unknown, at: number) => ({ v, at });

beforeEach(() => localStorage.clear());

test("merge keeps the newest entry per id and the union of ids", () => {
  const local: SyncDoc = { "slot-A": e("old", 1), theme: e("dark", 5) };
  const remote: SyncDoc = { "slot-A": e("new", 2), "slot-B": e("b", 1), theme: e("light", 3) };
  expect(mergeDocs(local, remote)).toEqual({ "slot-A": e("new", 2), "slot-B": e("b", 1), theme: e("dark", 5) });
});

test("merge is local-first on ties, and a newer tombstone removes a slot", () => {
  expect(mergeDocs({ x: e(1, 2) }, { x: e(2, 2) }).x.v).toBe(1);
  expect(mergeDocs({ "slot-C": e({ a: 1 }, 1) }, { "slot-C": e(null, 2) })["slot-C"].v).toBeNull();
});

test("merge ignores malformed remote entries", () => {
  const remote = { a: "junk", b: { v: 1 } } as unknown as SyncDoc;
  expect(mergeDocs({}, remote)).toEqual({});
});

test("stamp bumps only changed items", () => {
  const prev: SyncDoc = { currency: e("NPR", 1), theme: e("dark", 1) };
  expect(stampDoc(prev, { currency: "NPR", theme: "light", inputs: { a: 1 } }, 9)).toEqual({
    currency: e("NPR", 1), theme: e("light", 9), inputs: e({ a: 1 }, 9),
  });
});

function fake(remote: { version: number; value: SyncDoc } | null, conflicts = 0) {
  const pushes: SyncDoc[] = [];
  let left = conflicts;
  const t: SyncTransport = {
    pull: async <T,>() => remote as { version: number; value: T } | null,
    push: async (value) => {
      if (left-- > 0) return { ok: false, conflict: true, version: 9 };
      pushes.push(value as SyncDoc);
      return { ok: true, version: 2 };
    },
  };
  return { t, pushes };
}

test("syncOnce pushes local when nothing is on the server", async () => {
  const { t, pushes } = fake(null);
  const r = await syncOnce(t, { theme: e("dark", 1) });
  expect(r).toMatchObject({ pushed: true, changedLocal: false });
  expect(pushes).toHaveLength(1);
});

test("syncOnce does not push when the merge adds nothing", async () => {
  const doc = { theme: e("dark", 2) };
  const { t, pushes } = fake({ version: 1, value: doc });
  const r = await syncOnce(t, { theme: e("light", 1) });
  expect(r.pushed).toBe(false);
  expect(r.changedLocal).toBe(true);
  expect(r.merged).toEqual(doc);
  expect(pushes).toHaveLength(0);
});

test("syncOnce pushes the union and retries on conflict", async () => {
  const { t, pushes } = fake({ version: 1, value: { a: e(1, 1) } }, 1);
  const r = await syncOnce(t, { b: e(2, 1) });
  expect(r.pushed).toBe(true);
  expect(pushes[0]).toEqual({ a: e(1, 1), b: e(2, 1) });
});

test("syncOnce gives up after repeated conflicts", async () => {
  const { t } = fake({ version: 1, value: {} }, 5);
  await expect(syncOnce(t, { a: e(1, 1) })).rejects.toThrow("conflicting");
});

test("code uses the shared Sabin Labs key and rejects invalid codes", () => {
  expect(readCode()).toBeNull();
  const c = newSyncCode();
  writeCode(c);
  expect(localStorage.getItem(SHARED_CODE_KEY)).toBe(c);
  expect(readCode()).toBe(c);
  localStorage.setItem(SHARED_CODE_KEY, "nope");
  expect(readCode()).toBeNull();
  writeCode(null);
  expect(localStorage.getItem(SHARED_CODE_KEY)).toBeNull();
});

test("meta round-trips and tolerates corrupt storage", () => {
  writeMeta({ a: e(1, 1) });
  expect(readMeta()).toEqual({ a: e(1, 1) });
  localStorage.setItem("loan-calculator:sync-meta", "{bad");
  expect(readMeta()).toEqual({});
});
