import { decodeChanges, encodeChanges } from "./shareUrl";
import type { Inputs } from "./shareUrl";

export const STORAGE_KEY = "loan-calculator:inputs";
const VERSION = 1;
const FIELDS = ["principal", "rate", "months", "extra", "lump", "lumpMonth", "biweekly"] as const;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadInputs(store: Store, defaults: Inputs): Inputs {
  try {
    const data = JSON.parse(store.getItem(STORAGE_KEY) ?? "null");
    if (!data || data.v !== VERSION || typeof data.inputs !== "object" || !data.inputs) return defaults;
    const out = { ...defaults };
    for (const k of FIELDS) {
      const v = data.inputs[k];
      if (typeof v === "string" && (v.trim() === "" ? k !== "principal" && k !== "rate" && k !== "months" : Number.isFinite(Number(v)))) out[k] = v.trim();
    }
    if (typeof data.inputs.changes === "string") {
      const changes = encodeChanges(decodeChanges(data.inputs.changes));
      if (changes) out.changes = changes;
    }
    return out;
  } catch {
    return defaults;
  }
}

export function saveInputs(store: Store, inputs: Inputs): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, inputs }));
  } catch { /* storage unavailable or full: ignore */ }
}

export function clearInputs(store: Store): void {
  try {
    store.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
