export type Inputs = { principal: string; rate: string; months: string; extra: string; lump: string; lumpMonth: string };

const KEYS = ["principal", "rate", "months"] as const;
const OPTIONAL_KEYS = ["extra", "lump", "lumpMonth"] as const;

export function serializeInputs(inputs: Inputs): string {
  const params = new URLSearchParams();
  for (const k of KEYS) params.set(k, inputs[k]);
  for (const k of OPTIONAL_KEYS) {
    const unused = k === "lumpMonth" ? Number(inputs.lump) === 0 : Number(inputs[k]) === 0;
    if (inputs[k].trim() !== "" && !unused) params.set(k, inputs[k]);
  }
  return `?${params.toString()}`;
}

export function parseInputs(search: string, defaults: Inputs): Inputs {
  const params = new URLSearchParams(search);
  const out = { ...defaults };
  for (const k of [...KEYS, ...OPTIONAL_KEYS]) {
    const v = params.get(k)?.trim();
    if (v && Number.isFinite(Number(v))) out[k] = v;
  }
  return out;
}
