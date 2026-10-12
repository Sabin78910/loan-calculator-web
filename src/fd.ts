import type { Row } from "./emi";

export interface FdComparison { interestSaved: number; fdEarnings: number; difference: number; /* how much the winner is ahead */ winner: "prepay" | "fd" | "tie"; breakEvenRate: number | null; }

/** After-tax interest earned by `deposits` (one per month, made at month end) compounded monthly until `horizon` months. */
export function fdValue(deposits: number[], annualRate: number, taxPct: number, horizon: number): number {
  const r = (annualRate * (1 - taxPct / 100)) / 1200;
  let total = 0, paid = 0;
  deposits.slice(0, horizon).forEach((d, i) => { total += d * (1 + r) ** (horizon - i - 1); paid += d; });
  return total - paid;
}

/**
 * Prepaying `rows` (schedule with extras) versus putting the same extra payments, month by month, into an FD.
 * `baseRows` is the schedule without extras. Only interest saved within `horizon` months counts.
 * The break-even rate is the gross FD rate (before tax) at which the two are equal.
 */
export function prepayVsFd(rows: Row[], baseRows: Row[], fdRate: number, taxPct: number, horizon: number): FdComparison {
  if (!(fdRate >= 0)) throw new Error("FD rate cannot be negative");
  if (!(taxPct >= 0 && taxPct <= 100)) throw new Error("Tax must be between 0 and 100");
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error("Horizon must be at least 1 month");
  const interest = (rs: Row[]) => rs.slice(0, horizon).reduce((s, r) => s + r.interest, 0);
  const interestSaved = Math.max(0, interest(baseRows) - interest(rows));
  const deposits = rows.map((r) => r.extra);
  const fdEarnings = fdValue(deposits, fdRate, taxPct, horizon);
  const signed = interestSaved - fdEarnings, difference = Math.abs(signed);
  const winner = difference < 0.005 ? "tie" : signed > 0 ? "prepay" : "fd";
  let breakEvenRate: number | null = null;
  if (interestSaved > 0.005 && taxPct < 100) {
    let lo = 0, hi = 1000;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (fdValue(deposits, mid, taxPct, horizon) < interestSaved) lo = mid; else hi = mid;
    }
    breakEvenRate = (lo + hi) / 2;
  }
  return { interestSaved, fdEarnings, difference, winner, breakEvenRate };
}
