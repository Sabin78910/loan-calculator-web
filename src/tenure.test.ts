import { monthsToYears, yearsToMonths } from "./tenure";

test("converts whole years to months", () => {
  expect(yearsToMonths("5")).toBe(60);
  expect(yearsToMonths("20")).toBe(240);
});

test("rounds fractional years to whole months", () => {
  expect(yearsToMonths("1.5")).toBe(18);
  expect(yearsToMonths("2.04")).toBe(24);
  expect(yearsToMonths("2.05")).toBe(25);
});

test("returns null for invalid input and 0 for zero", () => {
  expect(yearsToMonths("")).toBeNull();
  expect(yearsToMonths("abc")).toBeNull();
  expect(yearsToMonths("-1")).toBeNull();
  expect(yearsToMonths("0")).toBe(0);
});

test("converts months to years text without trailing zeros", () => {
  expect(monthsToYears(60)).toBe("5");
  expect(monthsToYears(18)).toBe("1.5");
  expect(monthsToYears(62)).toBe("5.17");
  expect(monthsToYears(Number.NaN)).toBe("");
});
