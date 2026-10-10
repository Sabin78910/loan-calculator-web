import { isCurrency } from "./i18n";
export type Inputs = { principal: string; rate: string; months: string; extra: string; lump: string; lumpMonth: string; biweekly?: string; changes?: string; currency?: string };

export const MAX_RATE_CHANGES = 5;
export type RateChangeInput = { month: string; rate: string };

/** Encodes rate changes as "month:rate,month:rate"; incomplete rows are dropped. */
export function encodeChanges(list: RateChangeInput[]): string {
  return list.filter((c) => c.month.trim() !== "" && c.rate.trim() !== "").slice(0, MAX_RATE_CHANGES).map((c) => `${c.month.trim()}:${c.rate.trim()}`).join(",");
}

export function decodeChanges(s: string | undefined): RateChangeInput[] {
  const out: RateChangeInput[] = [];
  for (const part of (s ?? "").split(",")) {
    const [month, rate, ...rest] = part.split(":");
    if (rest.length === 0 && month?.trim() && rate?.trim() && Number.isFinite(Number(month)) && Number.isFinite(Number(rate))) out.push({ month: month.trim(), rate: rate.trim() });
  }
  return out.slice(0, MAX_RATE_CHANGES);
}

const KEYS = ["principal", "rate", "months"] as const;
const OPTIONAL_KEYS = ["extra", "lump", "lumpMonth", "biweekly"] as const;

export function serializeInputs(inputs: Inputs): string {
  const params = new URLSearchParams();
  for (const k of KEYS) params.set(k, inputs[k]);
  for (const k of OPTIONAL_KEYS) {
    const value = inputs[k] ?? "";
    const unused = k === "lumpMonth" ? Number(inputs.lump) === 0 : Number(value) === 0;
    if (value.trim() !== "" && !unused) params.set(k, value);
  }
  const changes = encodeChanges(decodeChanges(inputs.changes));
  if (changes) params.set("changes", changes);
  if (isCurrency(inputs.currency) && inputs.currency !== "NPR") params.set("currency", inputs.currency);
  return `?${params.toString()}`;
}

export function parseInputs(search: string, defaults: Inputs): Inputs {
  const params = new URLSearchParams(search);
  const out = { ...defaults };
  for (const k of [...KEYS, ...OPTIONAL_KEYS]) {
    const v = params.get(k)?.trim();
    if (v && Number.isFinite(Number(v))) out[k] = v;
  }
  const changes = encodeChanges(decodeChanges(params.get("changes") ?? undefined));
  if (changes) out.changes = changes;
  const currency = params.get("currency");
  if (isCurrency(currency)) out.currency = currency;
  return out;
}
