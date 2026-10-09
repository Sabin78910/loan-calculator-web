import { useEffect, useId, useMemo, useState } from "react";
import { balanceChartData, breakdown, calculateEmi, compareLoans, donutArcs, extraSavings, groupByYear, maxLoan, money, milestones, monthlyCost, payoffDate, schedule, toCsv } from "./emi";
import type { ChartPoint } from "./emi";
import { parseInputs, serializeInputs } from "./shareUrl";

function useCountUp(target: number, ms = 800) {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canAnimate = typeof window.matchMedia === "function" && !reduced;
  const [value, setValue] = useState(canAnimate ? 0 : target);
  useEffect(() => {
    if (!canAnimate) { setValue(target); return; }
    const start = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      setValue(target * t);
      if (t < 1) id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [target, canAnimate, ms]);
  return value;
}

const EXPLAINERS: Record<string, string> = {
  EMI: "EMI (equated monthly instalment) is the fixed amount you pay the lender every month. It covers part of the interest and part of the loan itself.",
  "interest rate": "The interest rate is the yearly cost of borrowing, as a percentage of the balance you still owe. A lower rate means less total interest.",
  tenure: "Tenure is how long you have to repay the loan, in months. A longer tenure lowers the EMI but increases the total interest you pay.",
  amortization: "Amortization is how each payment is split between interest and principal over time. Early payments are mostly interest; later ones mostly reduce the loan.",
  prepayment: "A prepayment is any extra money paid beyond your EMI, monthly or as a lump sum. It cuts the balance sooner, so you pay less interest and finish earlier.",
};

function InfoButton({ term }: { term: keyof typeof EXPLAINERS }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info" onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); e.stopPropagation(); } }}>
      <button type="button" className="info-btn" aria-label={`What is ${term}?`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>i</button>
      {open && <span id={id} role="note" className="tooltip">{EXPLAINERS[term]}</span>}
    </span>
  );
}

function SavingsBadge({ interestSaved, monthsSaved }: { interestSaved: number; monthsSaved: number }) {
  const shown = useCountUp(interestSaved);
  return (
    <p className="badge" role="status" aria-label={`You save NPR ${money(interestSaved)} and finish ${monthsSaved} months early`}>
      You save NPR {money(shown)} and finish {monthsSaved} months early
    </p>
  );
}

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
  const [active, setActive] = useState<number | null>(null);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const tip = active === null ? null : points[active];
  const summary = `Loan balance over time: falls from NPR ${money(first.balance)} to NPR ${money(last.balance)} over ${last.year} years, paying NPR ${money(last.principalPaid)} principal and NPR ${money(last.interestPaid)} interest.`;
  return (
    <section className="card" aria-label="Balance over time">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary}>
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => <line key={t} className="gridline" x1={PAD} x2={W - PAD} y1={y(maxY * t)} y2={y(maxY * t)} stroke="currentColor" strokeOpacity="0.15" />)}
        <polygon points={area((p) => p.balance)} fill="url(#balance-fill)" />
        <polygon points={area((p) => p.interestPaid)} fill="#dc2626" fillOpacity="0.25" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2" />
        <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="currentColor" />
        {points.map((p, i) => (
          <circle
            key={p.year} data-testid="chart-point" cx={x(p.year)} cy={y(p.balance)} r={active === i ? 6 : 4} fill="#2563eb" tabIndex={0}
            aria-label={`Year ${p.year}: balance NPR ${money(p.balance)}, interest paid NPR ${money(p.interestPaid)}`}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
          />
        ))}
        <text x={PAD} y={H - 6} fontSize="10" fill="currentColor">Year 0</text>
        <text x={W - PAD} y={H - 6} fontSize="10" fill="currentColor" textAnchor="end">Year {last.year}</text>
      </svg>
      <div className="tooltip-slot">
        {tip && <div role="tooltip" className="tooltip">Year {tip.year}: balance NPR {money(tip.balance)}, interest NPR {money(tip.interestPaid)}</div>}
      </div>
      <p className="row" style={{ justifyContent: "space-between", marginBottom: 0 }}>
        <span>Remaining principal (blue)</span>
        <span>Cumulative interest (red)</span>
      </p>
    </section>
  );
}

function Donut({ principalPct, interestPct }: { principalPct: number; interestPct: number }) {
  const R = 40;
  const arcs = donutArcs(principalPct, interestPct, R);
  const circle = (key: "principal" | "interest", cls: string) => (
    <circle
      data-arc={key} className={cls} cx="60" cy="60" r={R} fill="none" strokeWidth="16"
      strokeDasharray={`${arcs[key].length} ${arcs.circumference - arcs[key].length}`}
      strokeDashoffset={arcs[key].offset} transform="rotate(-90 60 60)"
    />
  );
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label={`Principal ${principalPct.toFixed(1)}% and interest ${interestPct.toFixed(1)}% of total payment`}>
        {circle("principal", "donut-principal")}
        {circle("interest", "donut-interest")}
      </svg>
      <ul className="legend">
        <li><span className="swatch donut-principal-bg" aria-hidden="true" /><span>Principal {principalPct.toFixed(1)}%</span></li>
        <li><span className="swatch donut-interest-bg" aria-hidden="true" /><span>Interest {interestPct.toFixed(1)}%</span></li>
      </ul>
    </div>
  );
}

function Compare() {
  const [a, setA] = useState({ principal: "500000", rate: "12", months: "60" });
  const [b, setB] = useState({ principal: "500000", rate: "10", months: "60" });
  const { cmp, error } = useMemo(() => {
    try {
      const t = (v: typeof a) => ({ principal: Number(v.principal), rate: Number(v.rate), months: Number(v.months) });
      return { cmp: compareLoans(t(a), t(b)), error: null };
    } catch (e) {
      return { cmp: null, error: (e as Error).message };
    }
  }, [a, b]);
  const field = (name: "A" | "B", state: typeof a, set: (v: typeof a) => void) => (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Loan {name}</h2>
      <label>Loan {name} amount (NPR)<input inputMode="decimal" value={state.principal} onChange={(e) => set({ ...state, principal: e.target.value })} /></label>
      <label>Loan {name} interest rate (% per year)<input inputMode="decimal" value={state.rate} onChange={(e) => set({ ...state, rate: e.target.value })} /></label>
      <label>Loan {name} tenure (months)<input inputMode="numeric" value={state.months} onChange={(e) => set({ ...state, months: e.target.value })} /></label>
    </div>
  );
  const cell = (who: "A" | "B", v: string) => <td className={cmp?.cheaper === who ? "highlight" : undefined}>{v}</td>;
  return (
    <>
      {field("A", a, setA)}
      {field("B", b, setB)}
      {error && <p className="error" role="alert">{error}</p>}
      {cmp && (
        <table className="card" aria-live="polite">
          <caption>Loan comparison</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Loan A{cmp.cheaper === "A" ? " (cheaper)" : ""}</th>
              <th scope="col">Loan B{cmp.cheaper === "B" ? " (cheaper)" : ""}</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">Monthly payment</th><td>{money(cmp.a.emi)}</td><td>{money(cmp.b.emi)}</td></tr>
            <tr><th scope="row">Total interest</th><td>{money(cmp.a.totalInterest)}</td><td>{money(cmp.b.totalInterest)}</td></tr>
            <tr><th scope="row">Total cost</th>{cell("A", money(cmp.a.totalPayment))}{cell("B", money(cmp.b.totalPayment))}</tr>
          </tbody>
        </table>
      )}
    </>
  );
}

function SliderField({ label, sliderLabel, value, onChange, min, max, step, inputMode, info, ...aria }: {
  info?: string; label: string; sliderLabel: string; value: string; onChange: (v: string) => void;
  min: number; max: number; step: number; inputMode: "decimal" | "numeric";
  "aria-invalid"?: boolean; "aria-describedby"?: string;
}) {
  const n = Number(value);
  return (
    <div className="field">
      <label>{label}<input inputMode={inputMode} value={value} {...aria} onChange={(e) => onChange(e.target.value)} /></label>
      {info && <InfoButton term={info} />}
      <input
        type="range" className="slider" aria-label={sliderLabel} min={min} max={max} step={step}
        value={Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
  const [tab, setTab] = useState<"emi" | "afford" | "compare">("emi");
  const [payment, setPayment] = useState("");
  const [tax, setTax] = useState("");
  const [insurance, setInsurance] = useState("");
  const [fee, setFee] = useState("");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    window.history.replaceState(null, "", serializeInputs({ principal, rate, months, extra, lump, lumpMonth }));
  }, [principal, rate, months, extra, lump, lumpMonth]);

  const { result, rows, baseRows, savings, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      const x = { monthly: Number(extra || 0), lumpSum: Number(lump || 0), lumpMonth: Number(lumpMonth || 1) };
      return { result: calculateEmi(p, r, n), rows: schedule(p, r, n, x), baseRows: schedule(p, r, n), savings: extraSavings(p, r, n, x), error: null };
    } catch (e) {
      return { result: null, rows: [], baseRows: [], savings: null, error: (e as Error).message };
    }
  }, [principal, rate, months, extra, lump, lumpMonth]);

  const cost = useMemo(() => {
    if (!result) return null;
    try {
      return { value: monthlyCost(result.emi, { yearlyTax: Number(tax || 0), yearlyInsurance: Number(insurance || 0), monthlyFee: Number(fee || 0) }), error: null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [result, tax, insurance, fee]);

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
      <div className="row segmented no-print" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "emi"} onClick={() => setTab("emi")}>Calculator</button>
        <button type="button" role="tab" aria-selected={tab === "afford"} onClick={() => setTab("afford")}>Affordability</button>
        <button type="button" role="tab" aria-selected={tab === "compare"} onClick={() => setTab("compare")}>Compare</button>
      </div>
      {tab === "compare" && <Compare />}
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
      <div className="layout">
      <div className="inputs no-print">
      <div className="card">
        <SliderField label="Loan amount (NPR)" sliderLabel="Loan amount slider" inputMode="decimal" value={principal} onChange={setPrincipal} min={10000} max={10000000} step={10000} {...fieldProps("principal")} />
        <SliderField label="Interest rate (% per year)" info="interest rate" sliderLabel="Interest rate slider" inputMode="decimal" value={rate} onChange={setRate} min={0} max={30} step={0.1} {...fieldProps("rate")} />
        <SliderField label="Tenure (months)" info="tenure" sliderLabel="Tenure slider" inputMode="numeric" value={months} onChange={setMonths} min={1} max={360} step={1} {...fieldProps("months")} />
        <details className="advanced">
          <summary>Advanced</summary>
          <p className="muted">Extra payments <InfoButton term="prepayment" /></p>
          <label>Monthly extra payment (NPR)<input inputMode="decimal" value={extra} {...fieldProps("extra")} onChange={(e) => setExtra(e.target.value)} /></label>
          <label>One-time lump sum (NPR)<input inputMode="decimal" value={lump} {...fieldProps("extra")} onChange={(e) => setLump(e.target.value)} /></label>
          <label>Lump sum month<input inputMode="numeric" value={lumpMonth} {...fieldProps("lumpMonth")} onChange={(e) => setLumpMonth(e.target.value)} /></label>
          <label>Yearly property tax (NPR)<input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
          <label>Yearly insurance (NPR)<input inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} /></label>
          <label>Monthly fees (NPR)<input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        </details>
      </div>
      {error && <p id="calc-error" className="error" role="alert">{error}</p>}
      </div>
      <aside className="results">
      {result && (
          <section className="card results-card" aria-label="Summary" aria-live="polite">
            <p className="muted" style={{ margin: 0 }}>Monthly payment <InfoButton term="EMI" /></p>
            <h2 className="big">Monthly EMI: NPR {money(result.emi)}</h2>
            <p>Total interest: NPR {money(result.totalInterest)}</p>
            <p>Total payment: NPR {money(result.totalPayment)}</p>
            <p>Payoff date: {payoffDate(new Date(), rows.length).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            {savings && savings.monthsSaved > 0 && (
              <SavingsBadge interestSaved={savings.interestSaved} monthsSaved={savings.monthsSaved} />
            )}
            {split && <Donut principalPct={split.principalPct} interestPct={split.interestPct} />}
          </section>
      )}
      </aside>
      </div>
      {result && split && (
        <>
          {cost?.error && <p className="error" role="alert">{cost.error}</p>}
          {cost?.value && (tax || insurance || fee) && (
            <section className="card" aria-label="Full monthly cost" aria-live="polite">
              <h2 style={{ marginTop: 0 }}>Total monthly cost: NPR {money(cost.value.total)}</h2>
              <p>Loan EMI: NPR {money(cost.value.emi)}</p>
              <p>Property tax: NPR {money(cost.value.tax)}</p>
              <p>Insurance: NPR {money(cost.value.insurance)}</p>
              <p>Fees: NPR {money(cost.value.fee)}</p>
            </section>
          )}
          <section className="card no-print" aria-label="Debt-free milestones">
            <h2 style={{ marginTop: 0 }}>Milestones</h2>
            <p className="muted">How your payments shift over time (amortization) <InfoButton term="amortization" /></p>
            <ol>
              {milestones(rows, Number(principal), new Date(), baseRows).map((m) => (
                <li key={m.label} className={m.monthsEarlier > 0 ? "highlight" : undefined}>
                  {m.label}: {m.date.toLocaleDateString("en-US", { month: "long", year: "numeric" })} (month {m.month})
                  {m.monthsEarlier > 0 && ` — ${m.monthsEarlier} months earlier`}
                </li>
              ))}
            </ol>
          </section>
          <BalanceChart points={balanceChartData(rows, Number(principal))} />
          <div className="row no-print">
            <button type="button" onClick={downloadCsv}>Download CSV</button>
            <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
          </div>
          <section className="print-only" aria-label="Printable summary" aria-hidden="true">
            <h2>Loan summary</h2>
            <ul>
              <li>Loan amount: NPR {money(Number(principal))}</li>
              <li>Interest rate: {Number(rate)}% per year</li>
              <li>Tenure: {Number(months)} months</li>
            </ul>
            <table>
              <caption>Yearly summary schedule</caption>
              <thead><tr><th scope="col">Year</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {groupByYear(rows).map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="row no-print">
            <button type="button" aria-pressed={view === "monthly"} onClick={() => setView("monthly")}>Monthly</button>
            <button type="button" aria-pressed={view === "yearly"} onClick={() => setView("yearly")}>Yearly</button>
          </div>
          {view === "monthly" ? (
            <div className="schedule card no-print">
            <table>
              <caption>Monthly payment schedule</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Extra</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}><td>{r.month}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.extra)}</td><td>{money(r.balance)}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="schedule card no-print">
            <table>
              <caption>Yearly payment schedule</caption>
              <thead><tr><th scope="col">Year</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>
              <tbody>
                {groupByYear(rows).map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
      </>}
    </main>
  );
}
