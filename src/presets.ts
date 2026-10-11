export type PresetId = "home" | "car" | "personal" | "education";
export interface Preset { id: PresetId; principal: number; rate: number; years: number; }

/**
 * Example loans with typical Nepali bank rates, rounded from 2026 published rate sheets
 * (home ~8.5–10.5%, personal vehicle ~9–10%, personal ~9.25–12%). Shown in the UI as "example rates".
 */
export const PRESETS: readonly Preset[] = [
  { id: "home", principal: 5_000_000, rate: 9.5, years: 20 },
  { id: "car", principal: 2_500_000, rate: 9.5, years: 7 },
  { id: "personal", principal: 500_000, rate: 11, years: 5 },
  { id: "education", principal: 1_500_000, rate: 10, years: 7 },
];

/** Calculator field values (strings, months) for a preset. */
export function presetInputs(p: Preset): { principal: string; rate: string; months: string } {
  return { principal: String(p.principal), rate: String(p.rate), months: String(p.years * 12) };
}

/** The preset whose values match the current inputs exactly, if any. */
export function activePreset(principal: string, rate: string, months: string): PresetId | null {
  const hit = PRESETS.find((p) => p.principal === Number(principal) && p.rate === Number(rate) && p.years * 12 === Number(months));
  return hit ? hit.id : null;
}
