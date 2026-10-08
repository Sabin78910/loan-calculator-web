import { breakdown, calculateEmi, schedule, toCsv } from "./emi";

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
test("toCsv outputs header and plain rounded rows", () => {
  const csv = toCsv([{ month: 1, principal: 1000.456, interest: 50, balance: 99000 }]);
  expect(csv).toBe("Month,Principal,Interest,Balance\n1,1000.46,50.00,99000.00\n");
});
test("toCsv with no rows is header only", () => {
  expect(toCsv([])).toBe("Month,Principal,Interest,Balance\n");
});

describe("breakdown", () => {
  it("splits total payment into principal and interest percentages", () => {
    const b = breakdown(calculateEmi(100000, 12, 12), 100000);
    expect(b.principalPct + b.interestPct).toBeCloseTo(100, 10);
    expect(b.interestPct).toBeCloseTo(6.21, 2);
  });
  it("is 100% principal at zero rate", () => {
    expect(breakdown(calculateEmi(1000, 0, 10), 1000)).toEqual({ principalPct: 100, interestPct: 0 });
  });
});
