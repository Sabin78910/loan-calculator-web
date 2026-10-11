import { activePreset, PRESETS, presetInputs } from "./presets";

test("every preset is a plausible Nepali bank loan", () => {
  expect(PRESETS.map((p) => p.id)).toEqual(["home", "car", "personal", "education"]);
  for (const p of PRESETS) {
    expect(p.rate).toBeGreaterThanOrEqual(7);
    expect(p.rate).toBeLessThanOrEqual(14);
    expect(p.principal % 100000).toBe(0);
  }
});

test("presetInputs converts years to months as strings", () => {
  expect(presetInputs(PRESETS[0])).toEqual({ principal: "5000000", rate: "9.5", months: "240" });
});

test("activePreset matches exact values only", () => {
  expect(activePreset("2500000", "9.5", "84")).toBe("car");
  expect(activePreset("2500000", "9.50", "84")).toBe("car");
  expect(activePreset("2500000", "9.6", "84")).toBeNull();
  expect(activePreset("", "", "")).toBeNull();
});
