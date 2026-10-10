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

test("currency is in the link when not the default, round-trips, and invalid codes are ignored", () => {
  expect(serializeInputs({ ...defaults, currency: "NPR" })).not.toContain("currency");
  expect(serializeInputs({ ...defaults, currency: "USD" })).toContain("currency=USD");
  expect(parseInputs("?currency=EUR", defaults).currency).toBe("EUR");
  expect(parseInputs("?currency=none", defaults).currency).toBe("none");
  expect(parseInputs("?currency=XYZ", { ...defaults, currency: "NPR" }).currency).toBe("NPR");
});
test("lump mode is in the link only for emi, round-trips, and old links default", () => {
  const v = { ...defaults, lump: "20000", lumpMode: "emi" };
  expect(serializeInputs({ ...defaults, lump: "20000", lumpMode: "tenure" })).not.toContain("lumpMode");
  expect(serializeInputs({ ...defaults, lumpMode: "emi" })).not.toContain("lumpMode");
  expect(serializeInputs(v)).toContain("lumpMode=emi");
  expect(parseInputs(serializeInputs(v), defaults).lumpMode).toBe("emi");
  expect(parseInputs("?principal=1000", defaults).lumpMode).toBeUndefined();
  expect(parseInputs("?lumpMode=bogus", defaults).lumpMode).toBeUndefined();
});

test("interestOnly round-trips through the URL", () => {
  const d = { principal: "1", rate: "1", months: "12", extra: "", lump: "", lumpMonth: "1" };
  expect(parseInputs(serializeInputs({ ...d, interestOnly: "3" }), d).interestOnly).toBe("3");
  expect(serializeInputs({ ...d, interestOnly: "0" })).not.toContain("interestOnly");
});
