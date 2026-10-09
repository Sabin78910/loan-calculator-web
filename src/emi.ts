export interface EmiResult { emi: number; totalPayment: number; totalInterest: number; }
export interface Row { month: number; principal: number; interest: number; extra: number; balance: number; }

export function calculateEmi(principal: number, annualRate: number, months: number): EmiResult {
  if (!(principal > 0)) throw new Error("Principal must be positive");
  if (!(annualRate >= 0)) throw new Error("Rate cannot be negative");
  if (!Number.isInteger(months) || months < 1) throw new Error("Tenure must be at least 1 month");
  const r = annualRate / 12 / 100;
  const emi = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const totalPayment = emi * months;
  return { emi, totalPayment, totalInterest: totalPayment - principal };
}

export interface YearRow { year: number; principal: number; interest: number; balance: number; }

export function groupByYear(rows: Row[]): YearRow[] {
  const years: YearRow[] = [];
  for (const r of rows) {
    const year = Math.ceil(r.month / 12);
    const y = years[year - 1] ?? (years[year - 1] = { year, principal: 0, interest: 0, balance: 0 });
    y.principal += r.principal;
    y.interest += r.interest;
    y.balance = r.balance;
  }
  return years;
}

export interface Extras { monthly?: number; lumpSum?: number; lumpMonth?: number; }

export function schedule(principal: number, annualRate: number, months: number, extras: Extras = {}): Row[] {
  const { emi } = calculateEmi(principal, annualRate, months);
  const { monthly = 0, lumpSum = 0, lumpMonth = 1 } = extras;
  if (!(monthly >= 0) || !(lumpSum >= 0)) throw new Error("Extra payments cannot be negative");
  if (lumpSum > 0 && (!Number.isInteger(lumpMonth) || lumpMonth < 1)) throw new Error("Extra lump sum month must be at least 1");
  const r = annualRate / 12 / 100;
  let balance = principal;
  const rows: Row[] = [];
  for (let month = 1; month <= months && balance > 0.005; month++) {
    const interest = balance * r;
    const wanted = month === lumpMonth ? monthly + lumpSum : monthly;
    const extra = Math.min(wanted, Math.max(0, balance - (emi - interest)));
    const p = month === months ? balance : Math.min(balance, emi - interest + extra);
    balance = Math.max(0, balance - p);
    rows.push({ month, principal: p, interest, extra, balance: balance < 0.005 ? 0 : balance });
    if (balance < 0.005) break;
  }
  return rows;
}

export function extraSavings(principal: number, annualRate: number, months: number, extras: Extras = {}): { interestSaved: number; monthsSaved: number } {
  const sum = (rows: Row[]) => rows.reduce((s, r) => s + r.interest, 0);
  const withExtras = schedule(principal, annualRate, months, extras);
  const base = schedule(principal, annualRate, months);
  return { interestSaved: Math.max(0, sum(base) - sum(withExtras)), monthsSaved: base.length - withExtras.length };
}

export const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function toCsv(rows: Row[]): string {
  const lines = rows.map((r) => [r.month, r.principal.toFixed(2), r.interest.toFixed(2), r.extra.toFixed(2), r.balance.toFixed(2)].join(","));
  return ["Month,Principal,Interest,Extra,Balance", ...lines].join("\n") + "\n";
}

export function breakdown(result: EmiResult, principal: number): { principalPct: number; interestPct: number } {
  const principalPct = (principal / result.totalPayment) * 100;
  return { principalPct, interestPct: 100 - principalPct };
}
