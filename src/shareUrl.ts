import { isCurrency } from "./i18n";
export type Inputs = { principal: string; rate: string; months: string; extra: string; lump: string; lumpMonth: string; biweekly?: string; interestOnly?: string; lumpMode?: string; changes?: string; currency?: string; monthsPaid?: string };

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
const OPTIONAL_KEYS = ["extra", "lump", "lumpMonth", "biweekly", "interestOnly"] as const;

export function serializeInputs(inputs: Inputs): string {
  const params = new URLSearchParams();
  for (const k of KEYS) params.set(k, inputs[k]);
  for (const k of OPTIONAL_KEYS) {
    const value = inputs[k] ?? "";
    const unused = k === "lumpMonth" ? Number(inputs.lump) === 0 : Number(value) === 0;
    if (value.trim() !== "" && !unused) params.set(k, value);
  }
  if (inputs.monthsPaid?.trim()) params.set("monthsPaid", inputs.monthsPaid.trim());
  if (inputs.lumpMode === "emi" && Number(inputs.lump) > 0) params.set("lumpMode", "emi");
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
  const paid = params.get("monthsPaid")?.trim();
  if (paid && Number.isFinite(Number(paid))) out.monthsPaid = paid;
  if (params.get("lumpMode") === "emi") out.lumpMode = "emi";
  const changes = encodeChanges(decodeChanges(params.get("changes") ?? undefined));
  if (changes) out.changes = changes;
  const currency = params.get("currency");
  if (isCurrency(currency)) out.currency = currency;
  return out;
}

export const MAX_COMPARE = 3;
export type CompareLoan = { principal: string; rate: string; months: string };

/** Encodes offers as "principal:rate:months,..." (max 3). */
export function encodeCompare(loans: CompareLoan[]): string {
  return loans.slice(0, MAX_COMPARE).map((l) => `${l.principal.trim()}:${l.rate.trim()}:${l.months.trim()}`).join(",");
}

/** Decodes the compare param; invalid entries are dropped and at most 3 are kept. */
export function decodeCompare(s: string | null | undefined): CompareLoan[] {
  const out: CompareLoan[] = [];
  for (const part of (s ?? "").split(",")) {
    const fields = part.split(":").map((f) => f.trim());
    if (fields.length !== 3 || fields.some((f) => f === "" || !Number.isFinite(Number(f)))) continue;
    const [principal, rate, months] = fields;
    if (Number(principal) > 0 && Number(rate) >= 0 && Number(months) > 0) out.push({ principal, rate, months });
  }
  return out.slice(0, MAX_COMPARE);
}
