import { useEffect, useMemo, useState } from "react";
import { balanceChartData, breakdown, calculateEmi, extraSavings, groupByYear, maxLoan, money, schedule, toCsv } from "./emi";
import type { ChartPoint } from "./emi";
import { parseInputs, serializeInputs } from "./shareUrl";

const DEFAULTS = { principal: "500000", rate: "12", months: "60", extra: "", lump: "", lumpMonth: "1" };

function BalanceChart({ points }: { points: ChartPoint[] }) {
  const W = 400, H = 200, PAD = 24;
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.balance, p.interestPaid)));
  const lastYear = Math.max(1, points[points.length - 1].year);
  const x = (year: number) => PAD + (year / lastYear) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / maxY) * (H - 2 * PAD);
  const area = (f: (p: ChartPoint) => number) =>
    `${points.map((p) => `${x(p.year)},${y(f(p))}`).join(" ")} ${x(lastYear)},${y(0)} ${x(0)},${y(0)}`;
  const line = points.map((p) => `${x(p.year)},${y(p.balance)}`).join(" ");
  const first = points[0], last = points[points.length - 1];
  const summary = `Loan balance over time: falls from NPR ${money(first.balance)} to NPR ${money(last.balance)} over ${last.year} years, paying NPR ${money(last.principalPaid)} principal and NPR ${money(last.interestPaid)} interest.`;
  return (
    <section className="card" aria-label="Balance over time">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary}>
        <polygon points={area((p) => p.balance)} fill="#2563eb" fillOpacity="0.25" />
        <polygon points={area((p) => p.interestPaid)} fill="#dc2626" fillOpacity="0.25" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2" />
        <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="currentColor" />
        <text x={PAD} y={H - 6} fontSize="10" fill="currentColor">Year 0</text>
        <text x={W - PAD} y={H - 6} fontSize="10" fill="currentColor" textAnchor="end">Year {last.year}</text>
      </svg>
      <p className="row" style={{ justifyContent: "space-between", marginBottom: 0 }}>
        <span>Remaining principal (blue)</span>
        <span>Cumulative interest (red)</span>
      </p>
    </section>
  );
}

export default function App() {
  const [initial] = useState(() => parseInputs(window.location.search, DEFAULTS));
  const [principal, setPrincipal] = useState(initial.principal);
  const [rate, setRate] = useState(initial.rate);
  const [months, setMonths] = useState(initial.months);
  const [extra, setExtra] = useState(initial.extra);
  const [lump, setLump] = useState(initial.lump);
  const [lumpMonth, setLumpMonth] = useState(initial.lumpMonth);
  const [tab, setTab] = useState<"emi" | "afford">("emi");
  const [payment, setPayment] = useState("");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    window.history.replaceState(null, "", serializeInputs({ principal, rate, months, extra, lump, lumpMonth }));
  }, [principal, rate, months, extra, lump, lumpMonth]);

  const { result, rows, savings, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      const x = { monthly: Number(extra || 0), lumpSum: Number(lump || 0), lumpMonth: Number(lumpMonth || 1) };
      return { result: calculateEmi(p, r, n), rows: schedule(p, r, n, x), savings: extraSavings(p, r, n, x), error: null };
    } catch (e) {
      return { result: null, rows: [], savings: null, error: (e as Error).message };
    }
  }, [principal, rate, months, extra, lump, lumpMonth]);

  const afford = useMemo(() => {
    if (payment === "") return { loan: null, error: null };
    try {
      return { loan: maxLoan(Number(payment), Number(rate), Number(months)), error: null };
    } catch (e) {
      return { loan: null, error: (e as Error).message };
    }
  }, [payment, rate, months]);

  const errorField = error?.startsWith("Principal") ? "principal" : error?.startsWith("Rate") ? "rate" : error?.startsWith("Extra") ? (error.includes("month") ? "lumpMonth" : "extra") : error ? "months" : null;
  const fieldProps = (name: string) =>
    errorField === name ? { "aria-invalid": true, "aria-describedby": "calc-error" } : {};

  const split = result ? breakdown(result, Number(principal)) : null;

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "loan-schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <h1>Loan Calculator</h1>
      <div className="row" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "emi"} onClick={() => setTab("emi")}>EMI</button>
        <button type="button" role="tab" aria-selected={tab === "afford"} onClick={() => setTab("afford")}>Affordability</button>
      </div>
      {tab === "afford" && (
        <>
          <div className="card">
            <label>Maximum monthly payment (NPR)<input inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} /></label>
            <label>Interest rate (% per year)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
            <label>Tenure (months)<input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
          </div>
          {afford.error && <p className="error" role="alert">{afford.error}</p>}
          {afford.loan !== null && (
            <section className="card" aria-label="Affordability result" aria-live="polite">
              <h2 style={{ marginTop: 0 }}>Maximum loan: NPR {money(afford.loan)}</h2>
            </section>
          )}
        </>
      )}
      {tab === "emi" && <>
      <div className="card">
        <label>Loan amount (NPR)<input inputMode="decimal" value={principal} {...fieldProps("principal")} onChange={(e) => setPrincipal(e.target.value)} /></label>
        <label>Interest rate (% per year)<input inputMode="decimal" value={rate} {...fieldProps("rate")} onChange={(e) => setRate(e.target.value)} /></label>
        <label>Tenure (months)<input inputMode="numeric" value={months} {...fieldProps("months")} onChange={(e) => setMonths(e.target.value)} /></label>
        <label>Monthly extra payment (NPR)<input inputMode="decimal" value={extra} {...fieldProps("extra")} onChange={(e) => setExtra(e.target.value)} /></label>
        <label>One-time lump sum (NPR)<input inputMode="decimal" value={lump} {...fieldProps("extra")} onChange={(e) => setLump(e.target.value)} /></label>
        <label>Lump sum month<input inputMode="numeric" value={lumpMonth} {...fieldProps("lumpMonth")} onChange={(e) => setLumpMonth(e.target.value)} /></label>
      </div>
      {error && <p id="calc-error" className="error" role="alert">{error}</p>}
      {result && split && (
        <>
          <section className="card" aria-label="Summary" aria-live="polite">
            <h2 style={{ marginTop: 0 }}>Monthly EMI: NPR {money(result.emi)}</h2>
            <p>Total interest: NPR {money(result.totalInterest)}</p>
            <p>Total payment: NPR {money(result.totalPayment)}</p>
            {savings && savings.monthsSaved > 0 && (
              <p className="highlight"><strong>You save NPR {money(savings.interestSaved)} interest and finish {savings.monthsSaved} months early</strong></p>
            )}
          </section>
          <section className="card" aria-label="Payment breakdown">
            <div
              className="breakdown"
              role="img"
              aria-label={`Principal ${split.principalPct.toFixed(1)}% and interest ${split.interestPct.toFixed(1)}% of total payment`}
            >
              <span className="breakdown-principal" style={{ width: `${split.principalPct}%` }} />
              <span className="breakdown-interest" style={{ width: `${split.interestPct}%` }} />
            </div>
            <p className="row" style={{ justifyContent: "space-between", marginBottom: 0 }}>
              <span>Principal {split.principalPct.toFixed(1)}%</span>
              <span>Interest {split.interestPct.toFixed(1)}%</span>
            </p>
          </section>
          <BalanceChart points={balanceChartData(rows, Number(principal))} />
          <button type="button" onClick={downloadCsv}>Download CSV</button>
          <div className="row">
            <button type="button" aria-pressed={view === "monthly"} onClick={() => setView("monthly")}>Monthly</button>
            <button type="button" aria-pressed={view === "yearly"} onClick={() => setView("yearly")}>Yearly</button>
          </div>
          {view === "monthly" ? (
            <table className="card">
              <caption>Monthly payment schedule</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Extra</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}><td>{r.month}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.extra)}</td><td>{money(r.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="card">
              <caption>Yearly payment schedule</caption>
              <thead><tr><th scope="col">Year</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {groupByYear(rows).map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      </>}
    </main>
  );
}
