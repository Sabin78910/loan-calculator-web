export interface EmiResult { emi: number; totalPayment: number; totalInterest: number; }
export interface Row { month: number; principal: number; interest: number; balance: number; }

export function calculateEmi(principal: number, annualRate: number, months: number): EmiResult {
  if (!(principal > 0)) throw new Error("Principal must be positive");
  if (!(annualRate >= 0)) throw new Error("Rate cannot be negative");
  if (!Number.isInteger(months) || months < 1) throw new Error("Tenure must be at least 1 month");
  const r = annualRate / 12 / 100;
  const emi = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const totalPayment = emi * months;
  return { emi, totalPayment, totalInterest: totalPayment - principal };
}

export function schedule(principal: number, annualRate: number, months: number): Row[] {
  const { emi } = calculateEmi(principal, annualRate, months);
  const r = annualRate / 12 / 100;
  let balance = principal;
  return Array.from({ length: months }, (_, i) => {
    const interest = balance * r;
    const p = emi - interest;
    balance = Math.max(0, balance - p);
    return { month: i + 1, principal: p, interest, balance };
  });
}

export const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function toCsv(rows: Row[]): string {
  const lines = rows.map((r) => [r.month, r.principal.toFixed(2), r.interest.toFixed(2), r.balance.toFixed(2)].join(","));
  return ["Month,Principal,Interest,Balance", ...lines].join("\n") + "\n";
}
