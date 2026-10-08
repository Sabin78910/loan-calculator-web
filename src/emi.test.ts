import { breakdown, calculateEmi, schedule } from "./emi";

test("known EMI value", () => {
  expect(calculateEmi(100000, 10, 12).emi).toBeCloseTo(8791.59, 2);
});
test("zero interest", () => {
  expect(calculateEmi(12000, 0, 12).emi).toBe(1000);
});
test("schedule pays off the loan", () => {
  const rows = schedule(500000, 12, 60);
  expect(rows).toHaveLength(60);
  expect(rows[59].balance).toBeCloseTo(0, 2);
});
test("validates input", () => {
  expect(() => calculateEmi(0, 10, 12)).toThrow();
  expect(() => calculateEmi(1000, 10, 0)).toThrow();
  expect(() => calculateEmi(1000, -1, 12)).toThrow();
});

test("breakdown percentages", () => {
  expect(breakdown(1000, 0, 10)).toEqual({ principalPct: 100, interestPct: 0 });
  const b = breakdown(500000, 12, 60);
  expect(b.principalPct + b.interestPct).toBeCloseTo(100);
  expect(b.interestPct).toBeCloseTo(( (calculateEmi(500000, 12, 60).totalInterest) / calculateEmi(500000, 12, 60).totalPayment) * 100);
  expect(b.interestPct).toBeGreaterThan(25);
  expect(b.interestPct).toBeLessThan(25.1);
});
