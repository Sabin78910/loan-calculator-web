export type Inputs = { principal: string; rate: string; months: string };

const KEYS = ["principal", "rate", "months"] as const;

export function serializeInputs(inputs: Inputs): string {
  const params = new URLSearchParams();
  for (const k of KEYS) params.set(k, inputs[k]);
  return `?${params.toString()}`;
}

export function parseInputs(search: string, defaults: Inputs): Inputs {
  const params = new URLSearchParams(search);
  const out = { ...defaults };
  for (const k of KEYS) {
    const v = params.get(k)?.trim();
    if (v && Number.isFinite(Number(v))) out[k] = v;
  }
  return out;
}
