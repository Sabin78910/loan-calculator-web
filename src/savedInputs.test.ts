import { clearInputs, loadInputs, saveInputs, STORAGE_KEY } from "./savedInputs";

const defaults = { principal: "500000", rate: "12", months: "60", extra: "", lump: "", lumpMonth: "1", biweekly: "" };
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test("round-trips saved inputs", () => {
  const s = mem();
  const v = { ...defaults, principal: "1234", rate: "7.5", extra: "500", biweekly: "1" };
  saveInputs(s, v);
  expect(loadInputs(s, defaults)).toEqual(v);
});
test("returns defaults when nothing is stored", () => {
  expect(loadInputs(mem(), defaults)).toEqual(defaults);
});
test("ignores corrupt data", () => {
  const s = mem();
  s.setItem(STORAGE_KEY, "{not json");
  expect(loadInputs(s, defaults)).toEqual(defaults);
  s.setItem(STORAGE_KEY, "null");
  expect(loadInputs(s, defaults)).toEqual(defaults);
});
test("ignores version mismatch", () => {
  const s = mem();
  s.setItem(STORAGE_KEY, JSON.stringify({ v: 99, inputs: { ...defaults, principal: "1" } }));
  expect(loadInputs(s, defaults)).toEqual(defaults);
});
test("ignores invalid field values but keeps valid ones", () => {
  const s = mem();
  s.setItem(STORAGE_KEY, JSON.stringify({ v: 1, inputs: { principal: "abc", rate: "5", months: 3 } }));
  expect(loadInputs(s, defaults)).toEqual({ ...defaults, rate: "5" });
});
test("clear removes stored data", () => {
  const s = mem();
  saveInputs(s, defaults);
  clearInputs(s);
  expect(s.getItem(STORAGE_KEY)).toBeNull();
});
test("survives storage that throws", () => {
  const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
  expect(loadInputs(bad, defaults)).toEqual(defaults);
  expect(() => saveInputs(bad, defaults)).not.toThrow();
  expect(() => clearInputs(bad)).not.toThrow();
});

test("round-trips rate changes and drops invalid ones", () => {
  const s = mem();
  saveInputs(s, { ...defaults, changes: "24:9.5" });
  expect(loadInputs(s, defaults).changes).toBe("24:9.5");
  s.setItem(STORAGE_KEY, JSON.stringify({ v: 1, inputs: { changes: "x:y" } }));
  expect(loadInputs(s, defaults).changes).toBeUndefined();
});

test("round-trips currency and ignores unknown codes", () => {
  const s = mem();
  saveInputs(s, { ...defaults, currency: "GBP" });
  expect(loadInputs(s, { ...defaults, currency: "NPR" }).currency).toBe("GBP");
  s.setItem(STORAGE_KEY, JSON.stringify({ v: 1, inputs: { ...defaults, currency: "XYZ" } }));
  expect(loadInputs(s, { ...defaults, currency: "NPR" }).currency).toBe("NPR");
});
