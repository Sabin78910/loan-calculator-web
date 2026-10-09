import { breakdown, calculateEmi, extraSavings, groupByYear, schedule, toCsv } from "./emi";

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
  const csv = toCsv([{ month: 1, principal: 1000.456, interest: 50, extra: 10, balance: 99000 }]);
  expect(csv).toBe("Month,Principal,Interest,Extra,Balance\n1,1000.46,50.00,10.00,99000.00\n");
});
test("toCsv with no rows is header only", () => {
  expect(toCsv([])).toBe("Month,Principal,Interest,Extra,Balance\n");
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

test("groupByYear sums principal and interest per 12 months", () => {
  const rows = schedule(500000, 12, 30);
  const years = groupByYear(rows);
  expect(years.map((y) => y.year)).toEqual([1, 2, 3]);
  expect(years[0].principal).toBeCloseTo(rows.slice(0, 12).reduce((s, r) => s + r.principal, 0), 6);
  expect(years[2].interest).toBeCloseTo(rows.slice(24).reduce((s, r) => s + r.interest, 0), 6);
  expect(years[0].balance).toBe(rows[11].balance);
  expect(years[2].balance).toBeCloseTo(0, 2);
  expect(groupByYear([])).toEqual([]);
});

describe("extra payments", () => {
  it("monthly extra shortens the loan and still ends at zero", () => {
    const base = schedule(500000, 12, 60);
    const rows = schedule(500000, 12, 60, { monthly: 5000 });
    expect(rows.length).toBeLessThan(base.length);
    expect(rows[rows.length - 1].balance).toBe(0);
    expect(rows[0].extra).toBe(5000);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBeCloseTo(500000, 2);
  });
  it("lump sum applies only in its month", () => {
    const rows = schedule(500000, 12, 60, { lumpSum: 100000, lumpMonth: 3 });
    expect(rows.map((r) => r.extra).filter((e) => e > 0)).toEqual([100000]);
    expect(rows[2].extra).toBe(100000);
    expect(rows.length).toBeLessThan(60);
  });
  it("lump sum larger than balance is capped", () => {
    const rows = schedule(10000, 12, 12, { lumpSum: 1e9, lumpMonth: 2 });
    expect(rows).toHaveLength(2);
    expect(rows[1].balance).toBe(0);
    expect(rows[1].extra).toBeLessThan(10000);
  });
  it("no extras matches the plain schedule", () => {
    expect(schedule(1000, 10, 6, { monthly: 0, lumpSum: 0 })).toEqual(schedule(1000, 10, 6));
  });
  it("extraSavings reports interest saved and months early", () => {
    const s = extraSavings(500000, 12, 60, { monthly: 5000 });
    expect(s.interestSaved).toBeGreaterThan(0);
    expect(s.monthsSaved).toBe(60 - schedule(500000, 12, 60, { monthly: 5000 }).length);
    expect(extraSavings(500000, 12, 60)).toEqual({ interestSaved: 0, monthsSaved: 0 });
  });
  it("validates extras", () => {
    expect(() => schedule(1000, 10, 6, { monthly: -1 })).toThrow("Extra");
    expect(() => schedule(1000, 10, 6, { lumpSum: 5, lumpMonth: 0 })).toThrow("Extra");
    expect(() => schedule(1000, 10, 6, { lumpSum: 5, lumpMonth: 1.5 })).toThrow("Extra");
  });
});
