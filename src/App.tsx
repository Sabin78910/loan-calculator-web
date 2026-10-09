import { useEffect, useMemo, useState } from "react";
import { breakdown, calculateEmi, groupByYear, money, schedule, toCsv } from "./emi";
import { parseInputs, serializeInputs } from "./shareUrl";

const DEFAULTS = { principal: "500000", rate: "12", months: "60" };

export default function App() {
  const [initial] = useState(() => parseInputs(window.location.search, DEFAULTS));
  const [principal, setPrincipal] = useState(initial.principal);
  const [rate, setRate] = useState(initial.rate);
  const [months, setMonths] = useState(initial.months);
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    window.history.replaceState(null, "", serializeInputs({ principal, rate, months }));
  }, [principal, rate, months]);

  const { result, rows, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      return { result: calculateEmi(p, r, n), rows: schedule(p, r, n), error: null };
    } catch (e) {
      return { result: null, rows: [], error: (e as Error).message };
    }
  }, [principal, rate, months]);

  const errorField = error?.startsWith("Principal") ? "principal" : error?.startsWith("Rate") ? "rate" : error ? "months" : null;
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
      <div className="card">
        <label>Loan amount (NPR)<input inputMode="decimal" value={principal} {...fieldProps("principal")} onChange={(e) => setPrincipal(e.target.value)} /></label>
        <label>Interest rate (% per year)<input inputMode="decimal" value={rate} {...fieldProps("rate")} onChange={(e) => setRate(e.target.value)} /></label>
        <label>Tenure (months)<input inputMode="numeric" value={months} {...fieldProps("months")} onChange={(e) => setMonths(e.target.value)} /></label>
      </div>
      {error && <p id="calc-error" className="error" role="alert">{error}</p>}
      {result && split && (
        <>
          <section className="card" aria-label="Summary" aria-live="polite">
            <h2 style={{ marginTop: 0 }}>Monthly EMI: NPR {money(result.emi)}</h2>
            <p>Total interest: NPR {money(result.totalInterest)}</p>
            <p>Total payment: NPR {money(result.totalPayment)}</p>
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
          <button type="button" onClick={downloadCsv}>Download CSV</button>
          <div className="row">
            <button type="button" aria-pressed={view === "monthly"} onClick={() => setView("monthly")}>Monthly</button>
            <button type="button" aria-pressed={view === "yearly"} onClick={() => setView("yearly")}>Yearly</button>
          </div>
          {view === "monthly" ? (
            <table className="card">
              <caption>Monthly payment schedule</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}><td>{r.month}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.balance)}</td></tr>
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
    </main>
  );
}
