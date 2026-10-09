import { parseInputs, serializeInputs } from "./shareUrl";

const defaults = { principal: "500000", rate: "12", months: "60" };

test("serializes inputs to a query string", () => {
  expect(serializeInputs({ principal: "100000", rate: "9.5", months: "24" })).toBe("?principal=100000&rate=9.5&months=24");
});
test("parses inputs from a query string", () => {
  expect(parseInputs("?principal=100000&rate=9.5&months=24", defaults)).toEqual({ principal: "100000", rate: "9.5", months: "24" });
});
test("round-trips", () => {
  const v = { principal: "1234", rate: "7", months: "12" };
  expect(parseInputs(serializeInputs(v), defaults)).toEqual(v);
});
test("falls back to defaults for missing or non-numeric values", () => {
  expect(parseInputs("", defaults)).toEqual(defaults);
  expect(parseInputs("?principal=abc&rate=5", defaults)).toEqual({ principal: "500000", rate: "5", months: "60" });
});
