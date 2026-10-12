import { fdValue, prepayVsFd } from "./fd";
import { schedule } from "./emi";

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

test("fdValue: lump deposited at the end of month 1 grows 11 months at 1% a month", () => {
  // 100000 * (1.01^11 - 1) = 11566.83
  expect(fdValue([100000], 12, 0, 12)).toBeCloseTo(11566.83, 2);
});
test("fdValue: tax of 6% cuts the rate to 94% of gross", () => {
  // monthly 0.94%: 100000 * (1.0094^11 - 1)
  expect(fdValue([100000], 12, 6, 12)).toBeCloseTo(100000 * (1.0094 ** 11 - 1), 6);
});
test("fdValue: monthly deposits at 12%, 3 months, no tax", () => {
  // 100*1.01^2 + 100*1.01 + 100 - 300 = 3.01
  expect(fdValue([100, 100, 100], 12, 0, 3)).toBeCloseTo(3.01, 6);
});
test("fdValue keeps growing past the deposits up to the horizon", () => {
  expect(fdValue([100], 12, 0, 3)).toBeCloseTo(100 * (1.01 ** 2 - 1), 6);
});

describe("prepayVsFd", () => {
  const rows = schedule(100000, 12, 12, { lumpSum: 50000, lumpMonth: 1 });
  const base = schedule(100000, 12, 12);
  const saved = sum(base.map((r) => r.interest)) - sum(rows.map((r) => r.interest));

  it("reports interest saved and after-tax FD earnings on the same money", () => {
    const r = prepayVsFd(rows, base, 8, 6, 12);
    expect(r.interestSaved).toBeCloseTo(saved, 6);
    expect(r.fdEarnings).toBeCloseTo(50000 * ((1 + (8 * 0.94) / 1200) ** 11 - 1), 4);
    expect(r.winner).toBe("prepay");
    expect(r.difference).toBeCloseTo(Math.abs(r.interestSaved - r.fdEarnings), 6);
  });
  it("FD wins when its rate is high enough", () => {
    const r = prepayVsFd(rows, base, 30, 0, 12);
    expect(r.winner).toBe("fd");
    expect(r.difference).toBeGreaterThan(0);
  });
  it("break-even gross rate makes the two equal", () => {
    const r = prepayVsFd(rows, base, 8, 6, 12);
    expect(r.breakEvenRate).not.toBeNull();
    expect(fdValue([50000], r.breakEvenRate!, 6, 12)).toBeCloseTo(saved, 3);
    // tax raises the gross rate needed
    expect(r.breakEvenRate!).toBeGreaterThan(prepayVsFd(rows, base, 8, 0, 12).breakEvenRate!);
  });
  it("hand-checked break-even without tax: ~11% a year on a 12% loan", () => {
    // single month-1 lump of 50000, interest saved is month 2..12 only; matches fdValue
    const r = prepayVsFd(rows, base, 8, 0, 12);
    expect(r.breakEvenRate!).toBeGreaterThan(8);
    expect(r.breakEvenRate!).toBeLessThan(13);
  });
  it("monthly extras are deposited month by month", () => {
    const x = schedule(100000, 12, 12, { monthly: 1000 });
    const r = prepayVsFd(x, base, 8, 6, 12);
    expect(r.fdEarnings).toBeCloseTo(fdValue(x.map((row) => row.extra), 8, 6, 12), 6);
  });
  it("a shorter horizon counts only interest saved inside it", () => {
    const short = prepayVsFd(rows, base, 8, 6, 6);
    expect(short.interestSaved).toBeLessThan(prepayVsFd(rows, base, 8, 6, 12).interestSaved);
  });
  it("no extras means a tie at zero and no break-even", () => {
    const r = prepayVsFd(base, base, 8, 6, 12);
    expect(r.interestSaved).toBe(0);
    expect(r.fdEarnings).toBe(0);
    expect(r.winner).toBe("tie");
    expect(r.breakEvenRate).toBeNull();
  });
  it("works with floating-rate schedules", () => {
    const rc = [{ fromMonth: 7, annualRate: 16 }];
    const a = schedule(100000, 12, 12, { lumpSum: 50000 }, rc), b = schedule(100000, 12, 12, {}, rc);
    const floating = prepayVsFd(a, b, 8, 6, 12), fixed = prepayVsFd(rows, base, 8, 6, 12);
    expect(floating.interestSaved).toBeGreaterThan(fixed.interestSaved);
  });
  it("validates input", () => {
    expect(() => prepayVsFd(rows, base, -1, 6, 12)).toThrow();
    expect(() => prepayVsFd(rows, base, 8, 101, 12)).toThrow();
    expect(() => prepayVsFd(rows, base, 8, 6, 0)).toThrow();
  });
});
