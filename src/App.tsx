import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { normalizeRateChanges, apr, balanceChartData, breakdown, biweeklyExtras, calculateEmi, compareLoans, donutArcs, extraSavings, groupByYear, lumpOutcome, maxLoan, milestones, monthlyCost, payoffDate, rateSensitivity, schedule, toCsv } from "./emi";
import type { ChartPoint, LumpMode } from "./emi";
import { createContext, useContext } from "react";
import { CURRENCIES, formatDate, formatMoney, formatNumber, isCurrency, loadLang, saveLang } from "./i18n";
import type { Currency, Key, Lang } from "./i18n";
import { translate } from "./i18n";
import { decodeChanges, encodeChanges, MAX_RATE_CHANGES, parseInputs, serializeInputs } from "./shareUrl";
import type { Inputs, RateChangeInput } from "./shareUrl";
import { clearInputs, loadInputs, saveInputs } from "./savedInputs";

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

import { monthsToYears, yearsToMonths, type TenureUnit } from "./tenure";

const LangContext = createContext<Lang>("en");
const CurrencyContext = createContext<Currency>("NPR");

/** Translations are written with NPR/रु; swap them for the chosen currency (amounts carry their own symbol). */
function localizeCurrency(text: string, currency: Currency): string {
  if (currency === "NPR") return text;
  return text.replace(/ ?\((NPR|रु)\)/g, currency === "none" ? "" : ` (${currency})`).replace(/(NPR|रु) (?=\S)/g, "");
}

function useI18n() {
  const lang = useContext(LangContext);
  const currency = useContext(CurrencyContext);
  return {
    lang,
    t: (key: Key, params?: Record<string, string | number>) => localizeCurrency(translate(lang, key, params), currency),
    money: (n: number) => formatMoney(lang, n, currency === "NPR" ? undefined : currency),
    num: (n: number, digits = 0, fixed = true) => formatNumber(lang, n, digits, fixed),
    date: (d: Date) => formatDate(lang, d),
    err: (msg: string) => translate(lang, `err.${msg}` as Key) === `err.${msg}` ? msg : translate(lang, `err.${msg}` as Key),
  };
}

function InfoButton({ term }: { term: "EMI" | "interest rate" | "tenure" | "amortization" | "prepayment" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info" onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); e.stopPropagation(); } }}>
      <button type="button" className="info-btn" aria-label={t("whatIs", { term: t(`term.${term}`) })} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>i</button>
      {open && <span id={id} role="note" className="tooltip">{t(`exp.${term}`)}</span>}
    </span>
  );
}

function SavingsBadge({ interestSaved, monthsSaved }: { interestSaved: number; monthsSaved: number }) {
  const { t, money, num } = useI18n();
  const shown = useCountUp(interestSaved);
  return (
    <p className="badge" role="status" aria-label={t("badge", { amount: money(interestSaved), months: num(monthsSaved) })}>
      {t("badge", { amount: money(shown), months: num(monthsSaved) })}
    </p>
  );
}

const DEFAULTS = { principal: "500000", rate: "12", months: "60", extra: "", lump: "", lumpMonth: "1", biweekly: "", lumpMode: "", changes: "", currency: "NPR" };

function BalanceChart({ points }: { points: ChartPoint[] }) {
  const { t, money, num } = useI18n();
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
  const summary = t("chartSummary", { start: money(first.balance), end: money(last.balance), years: num(last.year), principal: money(last.principalPaid), interest: money(last.interestPaid) });
  return (
    <section className="card" aria-label={t("balanceOverTime")}>
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
            aria-label={t("chartPoint", { year: num(p.year), balance: money(p.balance), interest: money(p.interestPaid) })}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
          />
        ))}
        <text x={PAD} y={H - 6} fontSize="10" fill="currentColor">{t("year0")}</text>
        <text x={W - PAD} y={H - 6} fontSize="10" fill="currentColor" textAnchor="end">{t("yearN", { year: num(last.year) })}</text>
      </svg>
      <div className="tooltip-slot">
        {tip && <div role="tooltip" className="tooltip">{t("chartTip", { year: num(tip.year), balance: money(tip.balance), interest: money(tip.interestPaid) })}</div>}
      </div>
      <p className="row" style={{ justifyContent: "space-between", marginBottom: 0 }}>
        <span>{t("legendBalance")}</span>
        <span>{t("legendInterest")}</span>
      </p>
    </section>
  );
}

function Donut({ principalPct, interestPct }: { principalPct: number; interestPct: number }) {
  const { t, num } = useI18n();
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
      <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label={t("donutAria", { principal: num(principalPct, 1), interest: num(interestPct, 1) })}>
        {circle("principal", "donut-principal")}
        {circle("interest", "donut-interest")}
      </svg>
      <ul className="legend">
        <li><span className="swatch donut-principal-bg" aria-hidden="true" /><span>{t("principalPct", { pct: num(principalPct, 1) })}</span></li>
        <li><span className="swatch donut-interest-bg" aria-hidden="true" /><span>{t("interestPct", { pct: num(interestPct, 1) })}</span></li>
      </ul>
    </div>
  );
}

function Compare() {
  const { t, money, err } = useI18n();
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
      <h2 style={{ marginTop: 0 }}>{t("loanX", { name })}</h2>
      <label>{t("loanXAmount", { name })}<input inputMode="decimal" value={state.principal} onChange={(e) => set({ ...state, principal: e.target.value })} /></label>
      <label>{t("loanXRate", { name })}<input inputMode="decimal" value={state.rate} onChange={(e) => set({ ...state, rate: e.target.value })} /></label>
      <label>{t("loanXTenure", { name })}<input inputMode="numeric" value={state.months} onChange={(e) => set({ ...state, months: e.target.value })} /></label>
    </div>
  );
  const cell = (who: "A" | "B", v: string) => <td className={cmp?.cheaper === who ? "highlight" : undefined}>{v}</td>;
  return (
    <>
      {field("A", a, setA)}
      {field("B", b, setB)}
      {error && <p className="error" role="alert">{err(error)}</p>}
      {cmp && (
        <table className="card" aria-live="polite">
          <caption>{t("loanComparison")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("measure")}</th>
              <th scope="col">{t("loanX", { name: "A" })}{cmp.cheaper === "A" ? t("cheaper") : ""}</th>
              <th scope="col">{t("loanX", { name: "B" })}{cmp.cheaper === "B" ? t("cheaper") : ""}</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">{t("monthlyPayment")}</th><td>{money(cmp.a.emi)}</td><td>{money(cmp.b.emi)}</td></tr>
            <tr><th scope="row">{t("totalInterest")}</th><td>{money(cmp.a.totalInterest)}</td><td>{money(cmp.b.totalInterest)}</td></tr>
            <tr><th scope="row">{t("totalCost")}</th>{cell("A", money(cmp.a.totalPayment))}{cell("B", money(cmp.b.totalPayment))}</tr>
          </tbody>
        </table>
      )}
    </>
  );
}

function SliderField({ label, sliderLabel, value, onChange, min, max, step, inputMode, info, inputValue, onInputChange, extra, ...aria }: {
  inputValue?: string; onInputChange?: (v: string) => void; extra?: ReactNode;
  info?: string; label: string; sliderLabel: string; value: string; onChange: (v: string) => void;
  min: number; max: number; step: number; inputMode: "decimal" | "numeric";
  "aria-invalid"?: boolean; "aria-describedby"?: string;
}) {
  const n = Number(value);
  return (
    <div className="field">
      <label>{label}<input inputMode={inputMode} value={inputValue ?? value} {...aria} onChange={(e) => (onInputChange ?? onChange)(e.target.value)} /></label>
      {info && <InfoButton term={info as "EMI"} />}
      {extra}
      <input
        type="range" className="slider" aria-label={sliderLabel} min={min} max={max} step={step}
        value={Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadLang(navigator.language));
  const chooseLang = (l: Lang) => { setLang(l); saveLang(l); };
  const [initial] = useState(() => parseInputs(window.location.search, loadInputs(window.localStorage, DEFAULTS)));
  const [currency, setCurrency] = useState<Currency>(() => (isCurrency(initial.currency) ? initial.currency : "NPR"));
  return (
    <LangContext.Provider value={lang}>
      <CurrencyContext.Provider value={currency}>
        <Calculator lang={lang} chooseLang={chooseLang} initial={initial} currency={currency} setCurrency={setCurrency} />
      </CurrencyContext.Provider>
    </LangContext.Provider>
  );
}

function Calculator({ lang, chooseLang, initial, currency, setCurrency }: { lang: Lang; chooseLang: (l: Lang) => void; initial: Inputs; currency: Currency; setCurrency: (c: Currency) => void }) {
  const { t, money, num, date, err } = useI18n();
  const signed = (n: number) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + money(Math.abs(n));
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const [principal, setPrincipal] = useState(initial.principal);
  const [rate, setRate] = useState(initial.rate);
  const [months, setMonths] = useState(initial.months);
  const [unit, setUnit] = useState<TenureUnit>("months");
  const [yearsText, setYearsText] = useState("");
  const chooseUnit = (u: TenureUnit) => { if (u === "years") setYearsText(monthsToYears(Number(months))); setUnit(u); };
  const changeYears = (text: string) => {
    setYearsText(text);
    const m = yearsToMonths(text);
    setMonths(m === null ? text : String(m));
  };
  const [extra, setExtra] = useState(initial.extra);
  const [lump, setLump] = useState(initial.lump);
  const [lumpMonth, setLumpMonth] = useState(initial.lumpMonth);
  const [lumpMode, setLumpMode] = useState<LumpMode>(initial.lumpMode === "emi" ? "emi" : "tenure");
  const [biweekly, setBiweekly] = useState(initial.biweekly === "1");
  const [changeList, setChangeList] = useState<RateChangeInput[]>(() => decodeChanges(initial.changes));
  const changes = encodeChanges(changeList);
  const updateChange = (i: number, patch: Partial<RateChangeInput>) => setChangeList(changeList.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const [tab, setTab] = useState<"emi" | "afford" | "compare">("emi");
  const [payment, setPayment] = useState("");
  const [tax, setTax] = useState("");
  const [insurance, setInsurance] = useState("");
  const [fee, setFee] = useState("");
  const [upfront, setUpfront] = useState("");
  const [upfrontType, setUpfrontType] = useState<"percent" | "amount">("percent");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    window.history.replaceState(null, "", serializeInputs({ principal, rate, months, extra, lump, lumpMonth, biweekly: biweekly ? "1" : "", lumpMode: lumpMode === "emi" ? "emi" : "", changes, currency }));
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, changes, currency]);

  useEffect(() => {
    const cur = { principal, rate, months, extra, lump, lumpMonth, biweekly: biweekly ? "1" : "", lumpMode: lumpMode === "emi" ? "emi" : "", changes, currency };
    if ((Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).every((k) => cur[k] === DEFAULTS[k])) clearInputs(window.localStorage);
    else saveInputs(window.localStorage, cur);
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, changes, currency]);

  const clearSaved = () => {
    clearInputs(window.localStorage);
    setPrincipal(DEFAULTS.principal); setRate(DEFAULTS.rate); setMonths(DEFAULTS.months);
    setExtra(DEFAULTS.extra); setLump(DEFAULTS.lump); setLumpMonth(DEFAULTS.lumpMonth); setLumpMode("tenure"); setBiweekly(false); setChangeList([]); setCurrency("NPR");
  };

  const { result, rows, baseRows, savings, lump: lumpResult, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      const base = { monthly: Number(extra || 0), lumpSum: Number(lump || 0), lumpMonth: Number(lumpMonth || 1), lumpMode };
      const rc = decodeChanges(changes).map((c) => ({ fromMonth: Number(c.month), annualRate: Number(c.rate) }));
      let res = calculateEmi(p, r, n);
      const x = biweekly ? biweeklyExtras(res.emi, base) : base;
      const rows = schedule(p, r, n, x, rc);
      if (normalizeRateChanges(rc, n).length > 0) {
        const totalInterest = schedule(p, r, n, {}, rc).reduce((s, row) => s + row.interest, 0);
        res = { emi: res.emi, totalInterest, totalPayment: p + totalInterest };
      }
      return { result: res, rows, baseRows: schedule(p, r, n, {}, rc), savings: extraSavings(p, r, n, x, rc), lump: lumpOutcome(p, r, n, base, rc), error: null };
    } catch (e) {
      return { result: null, rows: [], baseRows: [], savings: null, lump: null, error: (e as Error).message };
    }
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, changes]);

  const aprResult = useMemo(() => {
    if (!result || upfront === "") return null;
    try {
      const p = Number(principal), u = Number(upfront);
      return { value: apr(p, upfrontType === "percent" ? (p * u) / 100 : u, Number(rate), Number(months)), error: null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [result, principal, rate, months, upfront, upfrontType]);

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
      <div className="row no-print" role="group" aria-label={t("language")}>
        <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>EN</button>
        <button type="button" lang="ne" aria-pressed={lang === "ne"} onClick={() => chooseLang("ne")}>नेपाली</button>
      </div>
      <label className="no-print">{t("currency")}
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c === "none" ? t("currencyNone") : c}</option>)}
        </select>
      </label>
      <h1>{t("title")}</h1>
      <div className="row segmented no-print" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "emi"} onClick={() => setTab("emi")}>{t("tabCalc")}</button>
        <button type="button" role="tab" aria-selected={tab === "afford"} onClick={() => setTab("afford")}>{t("tabAfford")}</button>
        <button type="button" role="tab" aria-selected={tab === "compare"} onClick={() => setTab("compare")}>{t("tabCompare")}</button>
      </div>
      {tab === "compare" && <Compare />}
      {tab === "afford" && (
        <>
          <div className="card">
            <label>{t("maxPayment")}<input inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} /></label>
            <label>{t("ratePerYear")}<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
            <label>{t("tenureMonths")}<input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
          </div>
          {afford.error && <p className="error" role="alert">{err(afford.error)}</p>}
          {afford.loan !== null && (
            <section className="card" aria-label={t("affordResult")} aria-live="polite">
              <h2 style={{ marginTop: 0 }}>{t("maxLoan", { amount: money(afford.loan) })}</h2>
            </section>
          )}
        </>
      )}
      {tab === "emi" && <>
      <div className="layout">
      <div className="inputs no-print">
      <div className="card">
        <SliderField label={t("loanAmount")} sliderLabel={t("loanAmountSlider")} inputMode="decimal" value={principal} onChange={setPrincipal} min={10000} max={10000000} step={10000} {...fieldProps("principal")} />
        <SliderField label={t("ratePerYear")} info="interest rate" sliderLabel={t("rateSlider")} inputMode="decimal" value={rate} onChange={setRate} min={0} max={30} step={0.1} {...fieldProps("rate")} />
        <SliderField label={t(unit === "years" ? "tenureYears" : "tenureMonths")} info="tenure" inputValue={unit === "years" ? yearsText : undefined} onInputChange={unit === "years" ? changeYears : undefined}
          extra={<>
            <div role="group" aria-label={t("tenureUnit")} className="unit-toggle">
              {(["years", "months"] as const).map((u) => (
                <label className="check" key={u}><input type="radio" name="tenureUnit" value={u} checked={unit === u} onChange={() => chooseUnit(u)} />{t(u === "years" ? "unitYears" : "unitMonths")}</label>
              ))}
            </div>
            {unit === "years" && Number.isFinite(Number(months)) && months !== "" && <p className="muted" aria-live="polite">{t("tenureEquivalent", { months: num(Number(months)) })}</p>}
          </>} sliderLabel={t("tenureSlider")} inputMode="numeric" value={months} onChange={setMonths} min={1} max={360} step={1} {...fieldProps("months")} />
        <details className="advanced">
          <summary>{t("advanced")}</summary>
          <p className="muted">{t("extraPayments")} <InfoButton term="prepayment" /></p>
          <label>{t("monthlyExtra")}<input inputMode="decimal" value={extra} {...fieldProps("extra")} onChange={(e) => setExtra(e.target.value)} /></label>
          <label>{t("lumpSum")}<input inputMode="decimal" value={lump} {...fieldProps("extra")} onChange={(e) => setLump(e.target.value)} /></label>
          <label>{t("lumpMonth")}<input inputMode="numeric" value={lumpMonth} {...fieldProps("lumpMonth")} onChange={(e) => setLumpMonth(e.target.value)} /></label>
          {Number(lump) > 0 && (
            <fieldset role="radiogroup" aria-label={t("lumpModeLabel")}>
              <legend>{t("lumpModeLabel")}</legend>
              {(["tenure", "emi"] as const).map((m) => (
                <label className="check" key={m}><input type="radio" name="lumpMode" value={m} checked={lumpMode === m} onChange={() => setLumpMode(m)} />{t(m === "emi" ? "lumpModeEmi" : "lumpModeTenure")}</label>
              ))}
            </fieldset>
          )}
          <label className="check"><input type="checkbox" checked={biweekly} onChange={(e) => setBiweekly(e.target.checked)} />{t("biweekly")}</label>
          <p className="muted">{t("biweeklyNote")}</p>
          <fieldset className="rate-changes">
            <legend>{t("rateChanges")}</legend>
            <p className="muted">{t("rateChangesNote")}</p>
            {changeList.map((c, i) => (
              <div className="row" key={i}>
                <label>{t("rateChangeMonth", { n: i + 1 })}<input inputMode="numeric" value={c.month} onChange={(e) => updateChange(i, { month: e.target.value })} /></label>
                <label>{t("rateChangeRate", { n: i + 1 })}<input inputMode="decimal" value={c.rate} onChange={(e) => updateChange(i, { rate: e.target.value })} /></label>
                <button type="button" onClick={() => setChangeList(changeList.filter((_, j) => j !== i))}>{t("removeRateChange", { n: i + 1 })}</button>
              </div>
            ))}
            <button type="button" disabled={changeList.length >= MAX_RATE_CHANGES} onClick={() => setChangeList([...changeList, { month: "", rate: "" }])}>{t("addRateChange")}</button>
          </fieldset>
          <label>{t("yearlyTax")}<input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
          <label>{t("yearlyInsurance")}<input inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} /></label>
          <label>{t("upfrontFee")}<input inputMode="decimal" value={upfront} onChange={(e) => setUpfront(e.target.value)} /></label>
          <label>{t("feeType")}<select value={upfrontType} onChange={(e) => setUpfrontType(e.target.value as "percent" | "amount")}><option value="percent">{t("feePercent")}</option><option value="amount">{t("feeAmount")}</option></select></label>
          <label>{t("monthlyFees")}<input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        </details>
      </div>
      {aprResult?.error && <p className="error" role="alert">{err(aprResult.error)}</p>}
      {error && <p id="calc-error" className="error" role="alert">{err(error)}</p>}
      <button type="button" onClick={clearSaved}>{t("clearSaved")}</button>
      </div>
      <aside className="results">
      {result && (
          <section className="card results-card" aria-label={t("summary")} aria-live="polite">
            <p className="muted" style={{ margin: 0 }}>{t("monthlyPayment")} <InfoButton term="EMI" /></p>
            <h2 className="big">{t("monthlyEmi", { amount: money(result.emi) })}</h2>
            <p>{t("totalInterestLine", { amount: money(result.totalInterest) })}</p>
            <p>{t("totalPaymentLine", { amount: money(result.totalPayment) })}</p>
            {aprResult?.value != null && (
              <>
                <p>{t("aprLine", { apr: num(aprResult.value, 2, false), rate: num(Number(rate), 2, false) })}</p>
                <p className="muted">{t("aprExplain")}</p>
              </>
            )}
            <p>{t("payoffDate", { date: date(payoffDate(new Date(), rows.length)) })}</p>
            {lumpResult && (
              <>
                <p>{t("newEmiLine", { amount: money(lumpResult.newEmi) })}</p>
                <p>{t("interestSavedLine", { amount: money(lumpResult.interestSaved) })}</p>
              </>
            )}
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
          {cost?.error && <p className="error" role="alert">{err(cost.error)}</p>}
          {cost?.value && (tax || insurance || fee) && (
            <section className="card" aria-label={t("fullMonthlyCost")} aria-live="polite">
              <h2 style={{ marginTop: 0 }}>{t("totalMonthlyCost", { amount: money(cost.value.total) })}</h2>
              <p>{t("loanEmi", { amount: money(cost.value.emi) })}</p>
              <p>{t("propertyTax", { amount: money(cost.value.tax) })}</p>
              <p>{t("insurance", { amount: money(cost.value.insurance) })}</p>
              <p>{t("fees", { amount: money(cost.value.fee) })}</p>
            </section>
          )}
          <section className="card no-print" aria-label={t("milestonesAria")}>
            <h2 style={{ marginTop: 0 }}>{t("milestones")}</h2>
            <p className="muted">{t("milestonesIntro")} ({t("term.amortization")}) <InfoButton term="amortization" /></p>
            <ol>
              {milestones(rows, Number(principal), new Date(), baseRows).map((m) => (
                <li key={m.label} className={m.monthsEarlier > 0 ? "highlight" : undefined}>
                  {t("milestoneLine", { label: m.label === "Debt-free" ? t("debtFree") : t("pctPaid", { pct: num(parseInt(m.label, 10)) }), date: date(m.date), month: num(m.month) })}
                  {m.monthsEarlier > 0 && t("monthsEarlier", { months: num(m.monthsEarlier) })}
                </li>
              ))}
            </ol>
          </section>
          <section className="card no-print" aria-label={t("whatIfRate")}>
            <table>
              <caption>{t("whatIfRate")}</caption>
              <thead><tr><th scope="col">{t("colRateChange")}</th><th scope="col">{t("colRate")}</th><th scope="col">{t("colEmi")}</th><th scope="col">{t("colTotalInterest")}</th><th scope="col">{t("colEmiDiff")}</th><th scope="col">{t("colInterestDiff")}</th></tr></thead>
              <tbody>
                {rateSensitivity(Number(principal), Number(rate), Number(months), [-1, -0.5, 0, 0.5, 1]).map((s) => (
                  <tr key={s.delta}>
                    <th scope="row">{s.delta === 0 ? t("currentRate") : `${s.delta > 0 ? "+" : "−"}${num(Math.abs(s.delta), 1)}%`}</th>
                    <td>{num(s.rate, 2, false)}%</td><td>{money(s.emi)}</td><td>{money(s.totalInterest)}</td>
                    <td>{signed(s.emiDiff)}</td><td>{signed(s.interestDiff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <BalanceChart points={balanceChartData(rows, Number(principal))} />
          <div className="row no-print">
            <button type="button" onClick={downloadCsv}>{t("downloadCsv")}</button>
            <button type="button" onClick={() => window.print()}>{t("print")}</button>
          </div>
          <section className="print-only" aria-label={t("printable")} aria-hidden="true">
            <h2>{t("loanSummary")}</h2>
            <ul>
              <li>{t("loanAmountLine", { amount: money(Number(principal)) })}</li>
              <li>{t("rateLine", { rate: num(Number(rate), 2, false) })}</li>
              <li>{t("tenureLine", { months: num(Number(months)) })}</li>
            </ul>
            <table>
              <caption>{t("yearlySummary")}</caption>
              <thead><tr><th scope="col">{t("colYear")}</th><th scope="col">{t("colPrincipal")}</th><th scope="col">{t("colInterest")}</th><th scope="col">{t("colBalance")}</th></tr></thead>
              <tbody>
                {groupByYear(rows).map((y) => (
                  <tr key={y.year}><td>{num(y.year)}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="row no-print">
            <button type="button" aria-pressed={view === "monthly"} onClick={() => setView("monthly")}>{t("monthly")}</button>
            <button type="button" aria-pressed={view === "yearly"} onClick={() => setView("yearly")}>{t("yearly")}</button>
          </div>
          {view === "monthly" ? (
            <div className="schedule card no-print">
            <table>
              <caption>{t("monthlySchedule")}</caption>
              <thead><tr><th scope="col">{t("colMonth")}</th><th scope="col">{t("colPrincipal")}</th><th scope="col">{t("colInterest")}</th><th scope="col">{t("colExtra")}</th><th scope="col">{t("colBalance")}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}><td>{num(r.month)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.extra)}</td><td>{money(r.balance)}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="schedule card no-print">
            <table>
              <caption>{t("yearlySchedule")}</caption>
              <thead><tr><th scope="col">{t("colYear")}</th><th scope="col">{t("colPrincipal")}</th><th scope="col">{t("colInterest")}</th><th scope="col">{t("colBalance")}</th></tr></thead>
              <tbody>
                {groupByYear(rows).map((y) => (
                  <tr key={y.year}><td>{num(y.year)}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
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
