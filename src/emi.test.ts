import { balanceChartData, donutArcs, compareLoans, breakdown, calculateEmi, maxLoan, extraSavings, groupByYear, schedule, toCsv, monthlyCost, payoffDate, milestones, rateSensitivity } from "./emi";

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

test("maxLoan: forward EMI equals the payment", () => {
  const loan = maxLoan(25000, 10, 120);
  expect(calculateEmi(loan, 10, 120).emi).toBeCloseTo(25000, 6);
});
test("maxLoan handles 0% interest", () => {
  expect(maxLoan(1000, 0, 12)).toBe(12000);
});
test("maxLoan validates input", () => {
  expect(() => maxLoan(0, 10, 12)).toThrow("Payment must be positive");
  expect(() => maxLoan(1000, -1, 12)).toThrow("Rate cannot be negative");
  expect(() => maxLoan(1000, 10, 0)).toThrow("Tenure must be at least 1 month");
});

describe("balanceChartData", () => {
  it("starts at the full principal in year 0 and ends at zero balance", () => {
    const pts = balanceChartData(schedule(500000, 12, 60), 500000);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ year: 0, balance: 500000, principalPaid: 0, interestPaid: 0 });
    expect(pts[5].year).toBe(5);
    expect(pts[5].balance).toBeCloseTo(0, 2);
  });
  it("accumulates principal and interest paid", () => {
    const rows = schedule(500000, 12, 60);
    const last = balanceChartData(rows, 500000).at(-1)!;
    expect(last.principalPaid).toBeCloseTo(500000, 2);
    expect(last.interestPaid).toBeCloseTo(rows.reduce((s, r) => s + r.interest, 0), 2);
  });
  it("returns only the origin for no rows", () => {
    expect(balanceChartData([], 1000)).toHaveLength(1);
  });
});

describe("compareLoans", () => {
  it("picks the loan with the lower total cost", () => {
    const c = compareLoans({ principal: 100000, rate: 10, months: 12 }, { principal: 100000, rate: 12, months: 12 });
    expect(c.cheaper).toBe("A");
    expect(c.a.totalInterest).toBeLessThan(c.b.totalInterest);
  });
  it("reports a tie for identical loans", () => {
    const l = { principal: 100000, rate: 10, months: 12 };
    expect(compareLoans(l, l).cheaper).toBe("tie");
  });
  it("throws on invalid input", () => {
    expect(() => compareLoans({ principal: 0, rate: 10, months: 12 }, { principal: 1, rate: 10, months: 12 })).toThrow();
  });
});

describe("monthlyCost", () => {
  it("adds yearly tax and insurance (per month) and monthly fees to the EMI", () => {
    const c = monthlyCost(1000, { yearlyTax: 1200, yearlyInsurance: 600, monthlyFee: 25 });
    expect(c).toEqual({ emi: 1000, tax: 100, insurance: 50, fee: 25, total: 1175 });
  });
  it("defaults extras to zero", () => {
    expect(monthlyCost(1000).total).toBe(1000);
  });
  it("throws on negative amounts", () => {
    expect(() => monthlyCost(1000, { yearlyTax: -1 })).toThrow("Extra costs cannot be negative");
    expect(() => monthlyCost(1000, { monthlyFee: NaN })).toThrow("Extra costs cannot be negative");
  });
});

test("payoffDate adds whole months to the start date", () => {
  expect(payoffDate(new Date(2026, 0, 15), 60)).toEqual(new Date(2031, 0, 15));
  expect(payoffDate(new Date(2026, 10, 15), 3)).toEqual(new Date(2027, 1, 15));
  expect(payoffDate(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
});

describe("donutArcs", () => {
  it("splits the circumference by percentage", () => {
    const c = 2 * Math.PI * 40;
    const a = donutArcs(75, 25, 40);
    expect(a.circumference).toBeCloseTo(c);
    expect(a.principal.length).toBeCloseTo(c * 0.75);
    expect(a.interest.length).toBeCloseTo(c * 0.25);
    expect(a.principal.offset).toBe(0);
    expect(a.interest.offset).toBeCloseTo(-c * 0.75);
  });
  it("handles a zero-interest loan", () => {
    const a = donutArcs(100, 0, 40);
    expect(a.interest.length).toBe(0);
    expect(a.principal.length).toBeCloseTo(a.circumference);
  });
});

describe("milestones", () => {
  const start = new Date(2026, 0, 15);
  it("returns 25/50/75% and debt-free with months and dates", () => {
    const rows = schedule(120000, 0, 12);
    const m = milestones(rows, 120000, start);
    expect(m.map((x) => x.label)).toEqual(["25% paid", "50% paid", "75% paid", "Debt-free"]);
    expect(m.map((x) => x.month)).toEqual([3, 6, 9, 12]);
    expect(m[3].date).toEqual(payoffDate(start, 12));
    expect(m.every((x) => x.monthsEarlier === 0)).toBe(true);
  });
  it("moves milestones earlier with extra payments", () => {
    const base = schedule(500000, 12, 60);
    const rows = schedule(500000, 12, 60, { monthly: 10000 });
    const m = milestones(rows, 500000, start, base);
    expect(m[3].month).toBe(rows.length);
    expect(m[3].monthsEarlier).toBe(base.length - rows.length);
    expect(m.every((x) => x.monthsEarlier > 0)).toBe(true);
  });
  it("is empty for no rows", () => {
    expect(milestones([], 1000, start)).toEqual([]);
  });
});

test("rateSensitivity: delta 0 equals base and diffs are zero", () => {
  const base = calculateEmi(500000, 10, 60);
  const row = rateSensitivity(500000, 10, 60, [-1, 0, 1]).find((r) => r.delta === 0)!;
  expect(row.rate).toBe(10);
  expect(row.emi).toBeCloseTo(base.emi, 6);
  expect(row.totalInterest).toBeCloseTo(base.totalInterest, 6);
  expect(row.emiDiff).toBeCloseTo(0, 6);
  expect(row.interestDiff).toBeCloseTo(0, 6);
});
test("rateSensitivity: higher rate gives higher EMI and interest", () => {
  const [lo, mid, hi] = rateSensitivity(500000, 10, 60, [-0.5, 0, 0.5]);
  expect(lo.emi).toBeLessThan(mid.emi);
  expect(hi.emi).toBeGreaterThan(mid.emi);
  expect(hi.emiDiff).toBeGreaterThan(0);
  expect(lo.interestDiff).toBeLessThan(0);
  expect(hi.emiDiff).toBeCloseTo(calculateEmi(500000, 10.5, 60).emi - mid.emi, 6);
});
test("rateSensitivity: rate never goes below 0", () => {
  const rows = rateSensitivity(12000, 0.3, 12, [-1, -0.5, 0]);
  expect(rows[0].rate).toBe(0);
  expect(rows[0].emi).toBe(1000);
  expect(rows[0].totalInterest).toBeCloseTo(0, 6);
  expect(rows[1].rate).toBe(0);
});
test("rateSensitivity: validates inputs like calculateEmi", () => {
  expect(() => rateSensitivity(0, 10, 12, [0])).toThrow("Principal must be positive");
});
