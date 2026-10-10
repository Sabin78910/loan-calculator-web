import { parseInputs, serializeInputs } from "./shareUrl";

const defaults = { principal: "500000", rate: "12", months: "60", extra: "0", lump: "0", lumpMonth: "1" };

test("serializes inputs to a query string", () => {
  expect(serializeInputs({ ...defaults, principal: "100000", rate: "9.5", months: "24" })).toBe("?principal=100000&rate=9.5&months=24");
});
test("parses inputs from a query string", () => {
  expect(parseInputs("?principal=100000&rate=9.5&months=24", defaults)).toEqual({ ...defaults, principal: "100000", rate: "9.5", months: "24" });
});
test("round-trips", () => {
  const v = { principal: "1234", rate: "7", months: "12", extra: "500", lump: "20000", lumpMonth: "6" };
  expect(parseInputs(serializeInputs(v), defaults)).toEqual(v);
});
test("falls back to defaults for missing or non-numeric values", () => {
  expect(parseInputs("", defaults)).toEqual(defaults);
  expect(parseInputs("?principal=abc&rate=5", defaults)).toEqual({ ...defaults, rate: "5" });
});
test("includes extras in the link only when set", () => {
  expect(serializeInputs({ ...defaults, extra: "500", lump: "20000", lumpMonth: "6" })).toBe(
    "?principal=500000&rate=12&months=60&extra=500&lump=20000&lumpMonth=6",
  );
});
test("bi-weekly flag is in the link only when on and round-trips", () => {
  expect(serializeInputs({ ...defaults, biweekly: "" })).not.toContain("biweekly");
  const v = { ...defaults, biweekly: "1" };
  expect(serializeInputs(v)).toContain("biweekly=1");
  expect(parseInputs(serializeInputs(v), defaults).biweekly).toBe("1");
});

test("rate changes are in the link only when set, round-trip, and bad entries are dropped", () => {
  expect(serializeInputs(defaults)).not.toContain("changes");
  const v = { ...defaults, changes: "24:9.5,36:10" };
  expect(serializeInputs(v)).toContain("changes=24%3A9.5%2C36%3A10");
  expect(parseInputs(serializeInputs(v), defaults).changes).toBe("24:9.5,36:10");
  expect(parseInputs("?changes=24:abc,x:5,30:8", defaults).changes).toBe("30:8");
  expect(parseInputs("?changes=1:1,2:2,3:3,4:4,5:5,6:6", defaults).changes).toBe("1:1,2:2,3:3,4:4,5:5");
});
