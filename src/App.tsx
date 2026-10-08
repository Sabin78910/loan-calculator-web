import { useMemo, useState } from "react";
import { calculateEmi, money, schedule, toCsv } from "./emi";

export default function App() {
  const [principal, setPrincipal] = useState("500000");
  const [rate, setRate] = useState("12");
  const [months, setMonths] = useState("60");

  const { result, rows, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      return { result: calculateEmi(p, r, n), rows: schedule(p, r, n), error: null };
    } catch (e) {
      return { result: null, rows: [], error: (e as Error).message };
    }
  }, [principal, rate, months]);

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
        <label>Loan amount (NPR)<input inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></label>
        <label>Interest rate (% per year)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <label>Tenure (months)<input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <>
          <section className="card" aria-label="Summary">
            <h2 style={{ marginTop: 0 }}>Monthly EMI: NPR {money(result.emi)}</h2>
            <p>Total interest: NPR {money(result.totalInterest)}</p>
            <p>Total payment: NPR {money(result.totalPayment)}</p>
          </section>
          <button type="button" onClick={downloadCsv}>Download CSV</button>
          <table className="card">
            <thead><tr><th>Month</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}><td>{r.month}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
