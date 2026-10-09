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

export function maxLoan(payment: number, annualRate: number, months: number): number {
  if (!(payment > 0)) throw new Error("Payment must be positive");
  if (!(annualRate >= 0)) throw new Error("Rate cannot be negative");
  if (!Number.isInteger(months) || months < 1) throw new Error("Tenure must be at least 1 month");
  const r = annualRate / 12 / 100;
  return r === 0 ? payment * months : (payment * ((1 + r) ** months - 1)) / (r * (1 + r) ** months);
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

export interface ChartPoint { year: number; balance: number; principalPaid: number; interestPaid: number; }

export function balanceChartData(rows: Row[], principal: number): ChartPoint[] {
  const pts: ChartPoint[] = [{ year: 0, balance: principal, principalPaid: 0, interestPaid: 0 }];
  let principalPaid = 0, interestPaid = 0;
  for (const y of groupByYear(rows)) {
    principalPaid += y.principal;
    interestPaid += y.interest;
    pts.push({ year: y.year, balance: y.balance, principalPaid, interestPaid });
  }
  return pts;
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

export interface LoanTerms { principal: number; rate: number; months: number; }

export function compareLoans(a: LoanTerms, b: LoanTerms): { a: EmiResult; b: EmiResult; cheaper: "A" | "B" | "tie" } {
  const ra = calculateEmi(a.principal, a.rate, a.months);
  const rb = calculateEmi(b.principal, b.rate, b.months);
  const diff = Math.round((ra.totalPayment - rb.totalPayment) * 100);
  return { a: ra, b: rb, cheaper: diff < 0 ? "A" : diff > 0 ? "B" : "tie" };
}

export interface MonthlyCostExtras { yearlyTax?: number; yearlyInsurance?: number; monthlyFee?: number; }
export interface MonthlyCost { emi: number; tax: number; insurance: number; fee: number; total: number; }

export function monthlyCost(emi: number, extras: MonthlyCostExtras = {}): MonthlyCost {
  const { yearlyTax = 0, yearlyInsurance = 0, monthlyFee = 0 } = extras;
  if (![yearlyTax, yearlyInsurance, monthlyFee].every((v) => v >= 0)) throw new Error("Extra costs cannot be negative");
  const tax = yearlyTax / 12, insurance = yearlyInsurance / 12;
  return { emi, tax, insurance, fee: monthlyFee, total: emi + tax + insurance + monthlyFee };
}

/** Date of the final payment: `months` whole months after `start` (clamped to month end). */
export function payoffDate(start: Date, months: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(start.getDate(), last));
  return d;
}
