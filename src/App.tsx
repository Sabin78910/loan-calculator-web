import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loanProgress, normalizeRateChanges, refinance, apr, balanceChartData, breakdown, biweeklyExtras, calculateEmi, extraSavings, groupByYear, lumpOutcome, maxEmiForIncome, maxLoan, milestones, monthlyCost, payoffDate, rateSensitivity, schedule, tenureSensitivity, toCsv } from "./emi";
import type { LumpMode } from "./emi";
import { CURRENCIES, isCurrency, loadLang, saveLang } from "./i18n";
import type { Currency, Lang } from "./i18n";
import { decodeChanges, decodeCompare, encodeChanges, encodeCompare, MAX_RATE_CHANGES, parseInputs, serializeInputs } from "./shareUrl";
import type { Inputs, RateChangeInput } from "./shareUrl";
import { clearInputs, loadInputs, saveInputs } from "./savedInputs";
import { monthsToYears, yearsToMonths, type TenureUnit } from "./tenure";
import { activePreset, PRESETS, presetInputs } from "./presets";
import { loadTheme, saveTheme, THEME_COLOR, type Theme } from "./theme";
import { canAnimate, CurrencyContext, fillStyle, Icon, InfoButton, LangContext, SliderField, useCountUp, useI18n } from "./ui";
import type { IconName } from "./ui";
import { BalanceChart, Donut } from "./charts";
import { Compare, MAX_LOANS } from "./Compare";
import type { LoanInput } from "./Compare";
import { SyncPanel } from "./SyncPanel";
import { useSync } from "./useSync";
import type { SyncDoc } from "./syncData";

const DEFAULTS = { principal: "500000", rate: "12", months: "60", extra: "", lump: "", lumpMonth: "1", biweekly: "", interestOnly: "", monthsPaid: "", lumpMode: "", changes: "", currency: "NPR" };
const TABS = [["emi", "tabCalc", "calc"], ["afford", "tabAfford", "gauge"], ["compare", "tabCompare", "bars"]] as const;
type Tab = (typeof TABS)[number][0];

function ProgressPanel({ pct, balance, principalRepaid, interestPaid, interestRemaining, fullyRepaid }: { pct: number; balance: number; principalRepaid: number; interestPaid: number; interestRemaining: number; fullyRepaid: boolean }) {
  const { t, money, num } = useI18n();
  const shown = useCountUp(pct, 900);
  const text = t("progressPct", { pct: num(Math.floor(pct + 1e-9)) });
  return (
    <div className="progress-panel" role="group" aria-label={t("progressResult")}>
      <p className="progress-pct">{t("progressPct", { pct: num(Math.floor(shown + 1e-9)) })}</p>
      <div className="progress-track" role="progressbar" aria-label={t("progressTitle")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(pct.toFixed(1))} aria-valuetext={text}>
        <span className="progress-fill" style={{ width: `${Math.min(100, shown)}%` }} />
      </div>
      {fullyRepaid && <p className="progress-done">{t("progressDone")}</p>}
      <dl className="progress-stats">
        <div><dt>{t("progressBalance")}</dt><dd>{money(balance)}</dd></div>
        <div><dt>{t("progressRepaid")}</dt><dd>{money(principalRepaid)}</dd></div>
        <div><dt>{t("progressInterestPaid")}</dt><dd>{money(interestPaid)}</dd></div>
        <div><dt>{t("progressInterestLeft")}</dt><dd>{money(interestRemaining)}</dd></div>
      </dl>
    </div>
  );
}

function SavingsBadge({ interestSaved, monthsSaved }: { interestSaved: number; monthsSaved: number }) {
  const { t, money, num } = useI18n();
  const shown = useCountUp(interestSaved);
  const ref = useRef<HTMLParagraphElement>(null);
  const best = useRef(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    // Celebrate the first saving and each new whole year saved, never every slider tick.
    const levelUp = best.current === 0 || Math.floor(monthsSaved / 12) > Math.floor(best.current / 12);
    if (monthsSaved <= best.current) return;
    best.current = monthsSaved;
    if (!levelUp || !canAnimate()) return;
    setBurst((b) => b + 1);
    ref.current?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 480, easing: "cubic-bezier(.34,1.56,.64,1)" });
  }, [monthsSaved]);
  return (
    <div className="savings">
      <p ref={ref} className="badge" role="status" aria-label={t("badge", { amount: money(interestSaved), months: num(monthsSaved) })}>
        {t("badge", { amount: money(shown), months: num(monthsSaved) })}
      </p>
      {burst > 0 && <span key={burst} className="confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>}
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

const systemPrefersLight = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;

function Calculator({ lang, chooseLang, initial, currency, setCurrency }: { lang: Lang; chooseLang: (l: Lang) => void; initial: Inputs; currency: Currency; setCurrency: (c: Currency) => void }) {
  const { t, money, cash, lakh, num, date, err } = useI18n();
  const signed = (n: number) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + money(Math.abs(n));
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const [theme, setTheme] = useState<Theme>(() => loadTheme(systemPrefersLight()));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
  }, [theme]);
  const toggleTheme = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); saveTheme(next); };

  const [principal, setPrincipal] = useState(initial.principal);
  const [rate, setRate] = useState(initial.rate);
  const [months, setMonths] = useState(initial.months);
  const [refiPaid, setRefiPaid] = useState("0");
  const [monthsPaid, setMonthsPaid] = useState(initial.monthsPaid ?? "");
  const [refiRate, setRefiRate] = useState("");
  const [refiFee, setRefiFee] = useState("");
  const [income, setIncome] = useState("");
  const [existingEmis, setExistingEmis] = useState("");
  const [unit, setUnit] = useState<TenureUnit>("months");
  const [yearsText, setYearsText] = useState("");
  const chooseUnit = (u: TenureUnit) => { if (u === "years") setYearsText(monthsToYears(Number(months))); setUnit(u); };
  const changeYears = (text: string) => {
    setYearsText(text);
    const m = yearsToMonths(text);
    setMonths(m === null ? text : String(m));
  };
  const setMonthsSynced = (v: string) => { setMonths(v); if (unit === "years") setYearsText(monthsToYears(Number(v))); };
  const [extra, setExtra] = useState(initial.extra);
  const [lump, setLump] = useState(initial.lump);
  const [lumpMonth, setLumpMonth] = useState(initial.lumpMonth);
  const [lumpMode, setLumpMode] = useState<LumpMode>(initial.lumpMode === "emi" ? "emi" : "tenure");
  const [biweekly, setBiweekly] = useState(initial.biweekly === "1");
  const [interestOnly, setInterestOnly] = useState(initial.interestOnly ?? "");
  const [changeList, setChangeList] = useState<RateChangeInput[]>(() => decodeChanges(initial.changes));
  const changes = encodeChanges(changeList);
  const updateChange = (i: number, patch: Partial<RateChangeInput>) => setChangeList(changeList.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const [initialCompare] = useState(() => decodeCompare(new URLSearchParams(window.location.search).get("compare")));
  const [tab, setTab] = useState<Tab>(initialCompare.length ? "compare" : "emi");
  const [compareLoans, setCompareLoans] = useState<LoanInput[]>(initialCompare);
  const [compareSeed, setCompareSeed] = useState<LoanInput[]>(initialCompare);
  const [compareKey, setCompareKey] = useState(0);
  const [payment, setPayment] = useState("");
  const [tax, setTax] = useState("");
  const [insurance, setInsurance] = useState("");
  const [fee, setFee] = useState("");
  const [upfront, setUpfront] = useState("");
  const [upfrontType, setUpfrontType] = useState<"percent" | "amount">("percent");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState("");
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    let search = serializeInputs({ principal, rate, months, extra, lump, lumpMonth, biweekly: biweekly ? "1" : "", interestOnly, monthsPaid, lumpMode: lumpMode === "emi" ? "emi" : "", changes, currency });
    const compare = tab === "compare" ? encodeCompare(compareLoans) : "";
    if (compare) search += `&compare=${encodeURIComponent(compare)}`;
    window.history.replaceState(null, "", search);
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, interestOnly, monthsPaid, changes, currency, tab, compareLoans]);

  useEffect(() => {
    const cur = { principal, rate, months, extra, lump, lumpMonth, biweekly: biweekly ? "1" : "", interestOnly, monthsPaid, lumpMode: lumpMode === "emi" ? "emi" : "", changes, currency };
    if ((Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).every((k) => cur[k] === DEFAULTS[k])) clearInputs(window.localStorage);
    else saveInputs(window.localStorage, cur);
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, interestOnly, monthsPaid, changes, currency]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const clearSaved = () => {
    clearInputs(window.localStorage);
    setPrincipal(DEFAULTS.principal); setRate(DEFAULTS.rate); setMonths(DEFAULTS.months);
    setExtra(DEFAULTS.extra); setLump(DEFAULTS.lump); setLumpMonth(DEFAULTS.lumpMonth); setLumpMode("tenure"); setBiweekly(false); setInterestOnly(DEFAULTS.interestOnly); setMonthsPaid(DEFAULTS.monthsPaid); setChangeList([]); setCurrency("NPR");
  };

  const inputsNow = { principal, rate, months, extra, lump, lumpMonth, biweekly: biweekly ? "1" : "", interestOnly, lumpMode: lumpMode === "emi" ? "emi" : "", changes };
  const syncItems: Record<string, unknown> = { inputs: inputsNow, currency, theme };
  if (compareLoans.length) for (let i = 0; i < MAX_LOANS; i++) syncItems[`slot-${i}`] = compareLoans[i] ?? null;
  const applySynced = (doc: SyncDoc) => {
    const saved = doc.inputs?.v as Partial<Inputs> | undefined;
    if (saved && typeof saved === "object") {
      const d = { ...DEFAULTS, ...loadInputs({ getItem: () => JSON.stringify({ v: 1, inputs: saved }), setItem: () => {}, removeItem: () => {} }, DEFAULTS) };
      setPrincipal(d.principal); setRate(d.rate); setMonths(d.months); setExtra(d.extra); setLump(d.lump); setLumpMonth(d.lumpMonth);
      setLumpMode(d.lumpMode === "emi" ? "emi" : "tenure"); setBiweekly(d.biweekly === "1"); setInterestOnly(d.interestOnly ?? ""); setChangeList(decodeChanges(d.changes));
    }
    const cur = doc.currency?.v;
    if (isCurrency(cur)) setCurrency(cur);
    const th = doc.theme?.v;
    if (th === "dark" || th === "light") { setTheme(th); saveTheme(th); }
    const slots: LoanInput[] = [];
    for (let i = 0; i < MAX_LOANS; i++) {
      const v = doc[`slot-${i}`]?.v as Partial<LoanInput> | null | undefined;
      if (v && typeof v.principal === "string" && typeof v.rate === "string" && typeof v.months === "string") slots.push({ principal: v.principal, rate: v.rate, months: v.months });
      else break;
    }
    if (slots.length && JSON.stringify(slots) !== JSON.stringify(compareLoans)) { setCompareSeed(slots); setCompareLoans(slots); setCompareKey((k) => k + 1); }
  };
  const sync = useSync(syncItems, applySynced);

  const share = async () => {
    const url = window.location.href;
    try {
      const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.share) { await navigator.share({ title: t("title"), url }); return; }
      await navigator.clipboard.writeText(url);
      setToast(t("linkCopied"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setToast(t("shareFailed"));
    }
  };

  const { result, rows, baseRows, savings, lump: lumpResult, error } = useMemo(() => {
    try {
      const p = Number(principal), r = Number(rate), n = Number(months);
      const base = { monthly: Number(extra || 0), lumpSum: Number(lump || 0), lumpMonth: Number(lumpMonth || 1), lumpMode };
      const rc = decodeChanges(changes).map((c) => ({ fromMonth: Number(c.month), annualRate: Number(c.rate) }));
      const io = Number(interestOnly || 0);
      let res = calculateEmi(p, r, n, io);
      const plain = { ...base, interestOnlyMonths: io };
      const x = biweekly ? biweeklyExtras(res.emi, plain) : plain;
      const rows = schedule(p, r, n, x, rc);
      const noExtras = { interestOnlyMonths: io };
      if (normalizeRateChanges(rc, n).length > 0) {
        const totalInterest = schedule(p, r, n, noExtras, rc).reduce((s, row) => s + row.interest, 0);
        res = { emi: res.emi, totalInterest, totalPayment: p + totalInterest };
      }
      return { result: res, rows, baseRows: schedule(p, r, n, noExtras, rc), savings: extraSavings(p, r, n, x, rc), lump: lumpOutcome(p, r, n, plain, rc), error: null };
    } catch (e) {
      return { result: null, rows: [], baseRows: [], savings: null, lump: null, error: (e as Error).message };
    }
  }, [principal, rate, months, extra, lump, lumpMonth, lumpMode, biweekly, interestOnly, changes]);

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

  const refi = useMemo(() => {
    if (refiRate === "") return { value: null, error: null };
    try {
      return { value: refinance(Number(principal), Number(rate), Number(months), Number(refiPaid || 0), Number(refiRate), Number(refiFee || 0)), error: null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [principal, rate, months, refiPaid, refiRate, refiFee]);

  const progress = useMemo(() => {
    if (monthsPaid.trim() === "" || rows.length === 0) return { value: null, error: null };
    try {
      if (Number(monthsPaid) > Number(months)) throw new Error("Months paid cannot be more than the tenure");
      return { value: loanProgress(rows, Number(monthsPaid)), error: null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [rows, months, monthsPaid]);

  const incomeCheck = useMemo(() => {
    if (income === "") return { emi: null, loan: null, error: null };
    try {
      const emi = maxEmiForIncome(Number(income), Number(existingEmis || 0));
      return { emi, loan: emi > 0 ? maxLoan(emi, Number(rate), Number(months)) : 0, error: null };
    } catch (e) {
      return { emi: null, loan: null, error: (e as Error).message };
    }
  }, [income, existingEmis, rate, months]);

  const hasResult = result !== null;
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => { io.disconnect(); setShowBar(false); };
  }, [tab, hasResult]);

  const errorField = error?.startsWith("Principal") ? "principal" : error?.startsWith("Rate") ? "rate" : error?.startsWith("Extra") ? (error.includes("month") ? "lumpMonth" : "extra") : error ? "months" : null;
  const fieldProps = (name: string) =>
    errorField === name ? { "aria-invalid": true, "aria-describedby": "calc-error" } : {};

  const split = result ? breakdown(result, Number(principal)) : null;
  const shownEmi = useCountUp(result?.emi ?? 0, 900);
  const payoff = payoffDate(new Date(), rows.length);
  const preset = activePreset(principal, rate, months);
  const unitLabel = currency === "NPR" ? (lang === "ne" ? "रु" : "NPR") : "";
  const extraMax = Math.max(5000, Math.ceil((result?.emi ?? 0) / 1000) * 1000);
  const lumpStep = Number(principal) >= 200000 ? 10000 : 1000;
  const lumpMax = Math.max(lumpStep, Math.floor(Number(principal) / lumpStep) * lumpStep || lumpStep);
  const yearRows = groupByYear(rows);
  const rowCount = view === "monthly" ? rows.length : yearRows.length;

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "loan-schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fineTune = () => {
    const d = advancedRef.current;
    if (!d) return;
    d.open = true;
    d.scrollIntoView?.({ behavior: canAnimate() ? "smooth" : "auto", block: "start" });
    document.getElementById("extra-input")?.focus({ preventScroll: true });
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.findIndex(([id]) => id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const applyPreset = (v: { principal: string; rate: string; months: string }) => {
    setPrincipal(v.principal); setRate(v.rate); setMonthsSynced(v.months);
  };

  return (
    <>
      {result && (
        <div className={`minibar no-print${showBar ? " is-visible" : ""}`} aria-hidden="true">
          <span className="minibar-label">{t("emiShort")}</span>
          <strong>{cash(result.emi)}</strong>
          <span className="minibar-date"><Icon name="flag" size={14} />{date(payoff)}</span>
        </div>
      )}
      <header className="topbar no-print">
        <div className="topbar-inner">
          <span className="brand" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34"><rect width="32" height="32" rx="10" className="logo-bg" /><path d="M8.5 21 14 15.5l3.5 3.5L23.5 12" className="logo-line" /><circle cx="23.5" cy="12" r="2.4" className="logo-dot" /></svg>
          </span>
          <div className="toolbar">
            <div className="seg-sm" role="group" aria-label={t("language")}>
              <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>EN</button>
              <button type="button" lang="ne" aria-pressed={lang === "ne"} onClick={() => chooseLang("ne")}>नेपाली</button>
            </div>
            <label className="currency"><span className="sr-only">{t("currency")}</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c === "none" ? t("currencyNone") : c}</option>)}
              </select>
            </label>
            <button type="button" className="icon-btn" aria-label={t(theme === "dark" ? "themeToLight" : "themeToDark")} onClick={toggleTheme}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button type="button" className="btn btn-primary share-btn" aria-label={t("shareLabel")} onClick={share}>
              <Icon name="link" size={18} /><span className="share-text" aria-hidden="true">{t("share")}</span>
            </button>
          </div>
        </div>
      </header>
      <main>
        <div className="intro">
          <h1>{t("title")}</h1>
          <p className="lead">{t("tagline")}</p>
        </div>
        {toast && <p className="toast" role="status">{toast}</p>}
        <div className="segmented no-print" role="tablist" onKeyDown={onTabKey}>
          {TABS.map(([id, key, icon]) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>
              <Icon name={icon} size={18} />{t(key)}
            </button>
          ))}
        </div>

        {tab === "compare" && <Compare key={compareKey} initial={{ principal, rate, months }} initialLoans={compareSeed} onLoansChange={setCompareLoans} />}

        {tab === "afford" && (
          <div className="layout">
            <section className="card">
              <p className="lead">{t("affordIntro")}</p>
              <label className="stack">{t("maxPayment")}<input className="field-input" inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} /></label>
              <label className="stack">{t("ratePerYear")}<input className="field-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
              <label className="stack">{t("tenureMonths")}<input className="field-input" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
              {afford.error && <p className="error" role="alert">{err(afford.error)}</p>}
              <label className="stack">{t("monthlyIncome")}<input className="field-input" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} /></label>
              <label className="stack">{t("existingEmis")}<input className="field-input" inputMode="decimal" value={existingEmis} onChange={(e) => setExistingEmis(e.target.value)} /></label>
              {incomeCheck.error && <p className="error" role="alert">{err(incomeCheck.error)}</p>}
            </section>
            {incomeCheck.emi !== null && incomeCheck.loan !== null && (
              <section className="card" aria-label={t("incomeCheckResult")} aria-live="polite">
                <h2 className="afford-amount">{t("maxEmiIncome", { amount: money(incomeCheck.emi) })}</h2>
                <p>{t("maxLoan", { amount: money(incomeCheck.loan) })}</p>
                <p className="lead">{t("incomeGuideline")}</p>
              </section>
            )}
            {afford.loan !== null ? (
              <section className="card hero afford-hero" aria-label={t("affordResult")} aria-live="polite">
                <h2 className="afford-amount">{t("maxLoan", { amount: money(afford.loan) })}</h2>
                <p className="debt-free"><Icon name="sparkle" size={16} />{lakh(afford.loan)}</p>
                <button type="button" className="btn btn-primary" onClick={() => { setPrincipal(String(Math.floor((afford.loan ?? 0) / 1000) * 1000)); setTab("emi"); }}>{t("useThisAmount")}</button>
              </section>
            ) : (
              <section className="card hero afford-hero"><p className="lead">{t("affordEmpty")}</p></section>
            )}
          </div>
        )}

        {tab === "emi" && <>
          <div className="layout">
            <div className="inputs no-print">
              <section className="card">
                <h2 className="card-title">{t("loanType")}</h2>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <button key={p.id} type="button" className="preset" aria-pressed={preset === p.id} onClick={() => applyPreset(presetInputs(p))}>
                      <Icon name={p.id as IconName} size={22} />
                      <span className="preset-name">{t(`preset.${p.id}`)}</span>
                      <span className="preset-detail">{t("presetDetail", { rate: num(p.rate, 2, false), years: num(p.years) })}</span>
                    </button>
                  ))}
                </div>
                <p className="note">{t("presetNote")}</p>
                <SliderField id="principal-input" label={t("loanAmount")} sliderLabel={t("loanAmountSlider")} inputMode="decimal" value={principal} onChange={setPrincipal} min={10000} max={20000000} step={10000}
                  hint={Number(principal) > 0 && <span className="field-hint">{lakh(Number(principal))}</span>} scale={[lakh(10000), lakh(20000000)]} {...fieldProps("principal")} />
                <SliderField id="rate-input" label={t("ratePerYear")} info="interest rate" sliderLabel={t("rateSlider")} inputMode="decimal" value={rate} onChange={setRate} min={0} max={30} step={0.1}
                  hint={<span className="field-hint">%</span>} scale={["0%", "30%"]} {...fieldProps("rate")} />
                <SliderField id="tenure-input" label={t(unit === "years" ? "tenureYears" : "tenureMonths")} info="tenure" inputValue={unit === "years" ? yearsText : undefined} onInputChange={unit === "years" ? changeYears : undefined}
                  head={
                    <div role="group" aria-label={t("tenureUnit")} className="unit-toggle">
                      {(["years", "months"] as const).map((u) => (
                        <label className="unit" key={u}><input type="radio" name="tenureUnit" value={u} checked={unit === u} onChange={() => chooseUnit(u)} /><span>{t(u === "years" ? "unitYears" : "unitMonths")}</span></label>
                      ))}
                    </div>
                  }
                  hint={unit === "years"
                    ? Number.isFinite(Number(months)) && months !== "" && <span className="field-hint" aria-live="polite">{t("tenureEquivalent", { months: num(Number(months)) })}</span>
                    : Number(months) >= 12 && <span className="field-hint">{t("scaleYears", { n: num(Number(months) / 12, 1, false) })}</span>}
                  sliderLabel={t("tenureSlider")} inputMode="numeric" value={months} onChange={setMonthsSynced} min={1} max={360} step={1}
                  scale={[t("scaleOneMonth"), t("scaleYears", { n: num(30) })]} {...fieldProps("months")} />
              </section>

              {result && (
                <section className="card whatif" aria-labelledby="whatif-title">
                  <h2 id="whatif-title" className="card-title"><Icon name="sparkle" />{t("whatIfTitle")}</h2>
                  <p className="muted">{t("whatIfIntro")}</p>
                  <div className="range-row">
                    <div className="range-head"><label htmlFor="whatif-extra">{t("whatIfExtra")}</label><span className="range-value">{cash(Number(extra) || 0)}</span></div>
                    <input id="whatif-extra" type="range" className="slider slider-gold" min={0} max={extraMax} step={500} value={Math.min(extraMax, Math.max(0, Number(extra) || 0))}
                      aria-valuetext={cash(Number(extra) || 0)} style={fillStyle(Number(extra) || 0, 0, extraMax)} onChange={(e) => setExtra(e.target.value === "0" ? "" : e.target.value)} />
                  </div>
                  <div className="range-row">
                    <div className="range-head"><label htmlFor="whatif-lump">{t("whatIfLump")}</label><span className="range-value">{cash(Number(lump) || 0)}</span></div>
                    <input id="whatif-lump" type="range" className="slider slider-gold" min={0} max={lumpMax} step={lumpStep} value={Math.min(lumpMax, Math.max(0, Number(lump) || 0))}
                      aria-valuetext={cash(Number(lump) || 0)} style={fillStyle(Number(lump) || 0, 0, lumpMax)} onChange={(e) => setLump(e.target.value === "0" ? "" : e.target.value)} />
                    {Number(lump) > 0 && <p className="note">{t("whatIfLumpMonth", { month: num(Number(lumpMonth) || 1) })}</p>}
                  </div>
                  {savings && savings.monthsSaved > 0
                    ? <SavingsBadge interestSaved={savings.interestSaved} monthsSaved={savings.monthsSaved} />
                    : <p className="whatif-empty">{t("whatIfEmpty")}</p>}
                  {lumpResult && (
                    <div className="whatif-lines">
                      <p>{t("newEmiLine", { amount: money(lumpResult.newEmi) })}</p>
                      <p>{t("interestSavedLine", { amount: money(lumpResult.interestSaved) })}</p>
                    </div>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={fineTune}>{t("fineTune")}<Icon name="chevron" size={18} /></button>
                </section>
              )}

              <details className="card advanced" ref={advancedRef}>
                <summary><span className="advanced-text"><span className="advanced-title">{t("advanced")}</span><span className="advanced-hint">{t("advancedHint")}</span></span><Icon name="chevron" /></summary>
                <div className="advanced-body">
                  <label className="stack">{t("interestOnly")}<input className="field-input" inputMode="numeric" value={interestOnly} onChange={(e) => setInterestOnly(e.target.value)} /></label>
                  <p className="note">{t("interestOnlyNote")}</p>
                  <h3 className="group-title">{t("extraPayments")} <InfoButton term="prepayment" /></h3>
                  <div className="grid-2">
                    <label className="stack">{t("monthlyExtra")}<input id="extra-input" className="field-input" inputMode="decimal" value={extra} {...fieldProps("extra")} onChange={(e) => setExtra(e.target.value)} /></label>
                    <label className="stack">{t("lumpSum")}<input className="field-input" inputMode="decimal" value={lump} {...fieldProps("extra")} onChange={(e) => setLump(e.target.value)} /></label>
                    <label className="stack">{t("lumpMonth")}<input className="field-input" inputMode="numeric" value={lumpMonth} {...fieldProps("lumpMonth")} onChange={(e) => setLumpMonth(e.target.value)} /></label>
                  </div>
                  {Number(lump) > 0 && (
                    <fieldset role="radiogroup" aria-label={t("lumpModeLabel")} className="choice">
                      <legend>{t("lumpModeLabel")}</legend>
                      {(["tenure", "emi"] as const).map((m) => (
                        <label className="check" key={m}><input type="radio" name="lumpMode" value={m} checked={lumpMode === m} onChange={() => setLumpMode(m)} />{t(m === "emi" ? "lumpModeEmi" : "lumpModeTenure")}</label>
                      ))}
                    </fieldset>
                  )}
                  <label className="check"><input type="checkbox" checked={biweekly} onChange={(e) => setBiweekly(e.target.checked)} />{t("biweekly")}</label>
                  <p className="note">{t("biweeklyNote")}</p>
                  <fieldset className="rate-changes">
                    <legend className="group-title">{t("rateChanges")}</legend>
                    <p className="note">{t("rateChangesNote")}</p>
                    {changeList.map((c, i) => (
                      <div className="rate-change" key={i}>
                        <label className="stack">{t("rateChangeMonth", { n: i + 1 })}<input className="field-input" inputMode="numeric" value={c.month} onChange={(e) => updateChange(i, { month: e.target.value })} /></label>
                        <label className="stack">{t("rateChangeRate", { n: i + 1 })}<input className="field-input" inputMode="decimal" value={c.rate} onChange={(e) => updateChange(i, { rate: e.target.value })} /></label>
                        <button type="button" className="btn btn-ghost" onClick={() => setChangeList(changeList.filter((_, j) => j !== i))}>{t("removeRateChange", { n: i + 1 })}</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost" disabled={changeList.length >= MAX_RATE_CHANGES} onClick={() => setChangeList([...changeList, { month: "", rate: "" }])}><Icon name="plus" size={18} />{t("addRateChange")}</button>
                  </fieldset>
                  <h3 className="group-title">{t("groupCosts")}</h3>
                  <div className="grid-2">
                    <label className="stack">{t("yearlyTax")}<input className="field-input" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
                    <label className="stack">{t("yearlyInsurance")}<input className="field-input" inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} /></label>
                    <label className="stack">{t("monthlyFees")}<input className="field-input" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
                    <label className="stack">{t("upfrontFee")}<input className="field-input" inputMode="decimal" value={upfront} onChange={(e) => setUpfront(e.target.value)} /></label>
                    <label className="stack">{t("feeType")}<select className="field-input" value={upfrontType} onChange={(e) => setUpfrontType(e.target.value as "percent" | "amount")}><option value="percent">{t("feePercent")}</option><option value="amount">{t("feeAmount")}</option></select></label>
                  </div>
                </div>
              </details>
              {aprResult?.error && <p className="error" role="alert">{err(aprResult.error)}</p>}
              {error && <p id="calc-error" className="error" role="alert">{err(error)}</p>}
              <SyncPanel {...sync} connectCode={sync.useCode} onCopied={() => setToast(t("syncCopied"))} />
            </div>

            <aside className="results">
              {result && split && (
                <section ref={heroRef} className="card hero" aria-label={t("summary")} aria-live="polite">
                  <p className="eyebrow">{t("monthlyPayment")} <InfoButton term="EMI" /></p>
                  <h2 className="sr-only">{t("monthlyEmi", { amount: money(result.emi) })}</h2>
                  <p className="emi" aria-hidden="true">
                    {unitLabel && <span className="emi-unit">{unitLabel}</span>}
                    <span className="emi-num">{money(shownEmi)}</span>
                    <span className="emi-per">{t("perMonth")}</span>
                  </p>
                  <p className="debt-free">
                    <Icon name="flag" size={16} />
                    <span className="sr-only">{t("payoffDate", { date: date(payoff) })}</span>
                    <span aria-hidden="true">{t("debtFreeBy", { date: date(payoff) })}</span>
                    {savings && savings.monthsSaved > 0 && <span className="sooner">{t("monthsSooner", { months: num(savings.monthsSaved) })}</span>}
                  </p>
                  <div className="hero-body">
                    <Donut principalPct={split.principalPct} interestPct={split.interestPct} total={result.totalPayment} />
                    <dl className="stats">
                      <div className="stat"><dt>{t("totalInterest")}<span className="sr-only">: </span></dt><dd className="stat-interest">{cash(result.totalInterest)}</dd></div>
                      <div className="stat"><dt>{t("totalPayment")}<span className="sr-only">: </span></dt><dd>{cash(result.totalPayment)}</dd></div>
                    </dl>
                  </div>
                  {aprResult?.value != null && (
                    <div className="apr">
                      <p>{t("aprLine", { apr: num(aprResult.value, 2, false), rate: num(Number(rate), 2, false) })}</p>
                      <p className="note">{t("aprExplain")}</p>
                    </div>
                  )}
                </section>
              )}
            </aside>
          </div>

          {result && split && (
            <div className="bento">
              <BalanceChart points={balanceChartData(rows, Number(principal))} baseline={savings && savings.interestSaved > 0.5 ? balanceChartData(baseRows, Number(principal)) : null} />
              <section className="card no-print progress-card" aria-labelledby="progress-title">
                <h2 className="card-title" id="progress-title">{t("progressTitle")}</h2>
                <p className="lead">{t("progressIntro")}</p>
                <label className="stack">{t("progressInput")}<input className="field-input" inputMode="numeric" placeholder="0" value={monthsPaid} onChange={(e) => setMonthsPaid(e.target.value)} aria-invalid={progress.error ? true : undefined} aria-describedby={progress.error ? "progress-error" : undefined} /></label>
                {progress.error && <p id="progress-error" className="error" role="alert">{err(progress.error)}</p>}
                {progress.value && <ProgressPanel pct={progress.value.percentRepaid} balance={progress.value.balance} principalRepaid={progress.value.principalRepaid} interestPaid={progress.value.interestPaid} interestRemaining={progress.value.interestRemaining} fullyRepaid={progress.value.fullyRepaid} />}
              </section>
              <section className="card no-print milestones" aria-label={t("milestonesAria")}>
                <h2 className="card-title">{t("milestones")}</h2>
                <p className="muted">{t("milestonesIntro")} ({t("term.amortization")}) <InfoButton term="amortization" /></p>
                <ol className="timeline">
                  {milestones(rows, Number(principal), new Date(), baseRows).map((m) => (
                    <li key={m.label} className={m.monthsEarlier > 0 ? "highlight" : undefined}>
                      <span className="dot" aria-hidden="true" />
                      <strong>{m.label === "Debt-free" ? t("debtFree") : t("pctPaid", { pct: num(parseInt(m.label, 10)) })}</strong>
                      <span>{date(m.date)} <span className="muted">({t("colMonth")} {num(m.month)})</span></span>
                      {m.monthsEarlier > 0 && <span className="earlier">{t("monthsEarlier", { months: num(m.monthsEarlier) })}</span>}
                    </li>
                  ))}
                </ol>
              </section>
              {cost?.error && <p className="error span-all" role="alert">{err(cost.error)}</p>}
              {cost?.value && (tax || insurance || fee) && (
                <section className="card cost-card" aria-label={t("fullMonthlyCost")} aria-live="polite">
                  <h2 className="card-title">{t("totalMonthlyCost", { amount: money(cost.value.total) })}</h2>
                  <div className="stack-bar" aria-hidden="true">
                    {(["emi", "tax", "insurance", "fee"] as const).map((k) => <span key={k} className={`seg-${k}`} style={{ width: `${(cost.value[k] / cost.value.total) * 100}%` }} />)}
                  </div>
                  <ul className="legend">
                    <li><span className="swatch seg-emi" aria-hidden="true" />{t("loanEmi", { amount: money(cost.value.emi) })}</li>
                    <li><span className="swatch seg-tax" aria-hidden="true" />{t("propertyTax", { amount: money(cost.value.tax) })}</li>
                    <li><span className="swatch seg-insurance" aria-hidden="true" />{t("insurance", { amount: money(cost.value.insurance) })}</li>
                    <li><span className="swatch seg-fee" aria-hidden="true" />{t("fees", { amount: money(cost.value.fee) })}</li>
                  </ul>
                </section>
              )}
              <section className="card no-print refi-card" aria-labelledby="refi-title">
                <h2 className="card-title" id="refi-title">{t("refiTitle")}</h2>
                <p className="lead">{t("refiIntro")}</p>
                <label className="stack">{t("refiMonthsPaid")}<input className="field-input" inputMode="numeric" value={refiPaid} onChange={(e) => setRefiPaid(e.target.value)} /></label>
                <div className="stack"><label htmlFor="refi-rate">{t("refiNewRate")}</label><span className="input-suffix"><input id="refi-rate" className="field-input" inputMode="decimal" placeholder="9" value={refiRate} onChange={(e) => setRefiRate(e.target.value)} /><span className="suffix" aria-hidden="true">%</span></span></div>
                <div className="stack"><label htmlFor="refi-fee">{t("refiFee")}</label><span className="input-suffix"><input id="refi-fee" className="field-input" inputMode="decimal" placeholder="0" value={refiFee} onChange={(e) => setRefiFee(e.target.value)} /><span className="suffix" aria-hidden="true">NPR</span></span></div>
                {refi.error && <p className="error" role="alert">{err(refi.error)}</p>}
                {refi.value && (
                  <div aria-label={t("refiResult")} role="group" aria-live="polite">
                    <p>{t("refiNewEmi", { amount: money(refi.value.newEmi), current: money(refi.value.currentEmi) })}</p>
                    {refi.value.worthIt ? <p>{t("refiSaved", { amount: money(refi.value.netSaving) })}</p> : <p>{t("refiCostsMore", { amount: money(-refi.value.netSaving) })}</p>}
                    {refi.value.breakEvenMonth !== null && refi.value.breakEvenMonth <= refi.value.remainingMonths && <p>{t("refiBreakEven", { month: num(refi.value.breakEvenMonth) })}</p>}
                    {refi.value.worthIt && <p>{t("refiWorth")}</p>}
                  </div>
                )}
              </section>
              <section className="card no-print table-card">
                <div className="table-scroll" role="region" tabIndex={0} aria-label={t("whatIfRate")}>
                <table>
                  <caption>{t("whatIfRate")}</caption>
                  <thead><tr><th scope="col">{t("colRateChange")}</th><th scope="col">{t("colRate")}</th><th scope="col">{t("colEmi")}</th><th scope="col">{t("colTotalInterest")}</th><th scope="col">{t("colEmiDiff")}</th><th scope="col">{t("colInterestDiff")}</th></tr></thead>
                  <tbody>
                    {rateSensitivity(Number(principal), Number(rate), Number(months), [-1, -0.5, 0, 0.5, 1]).map((s) => (
                      <tr key={s.delta} className={s.delta === 0 ? "current" : s.delta < 0 ? "down" : "up"}>
                        <th scope="row">{s.delta === 0 ? t("currentRate") : `${s.delta > 0 ? "+" : "−"}${num(Math.abs(s.delta), 1)}%`}</th>
                        <td>{num(s.rate, 2, false)}%</td><td>{money(s.emi)}</td><td>{money(s.totalInterest)}</td>
                        <td className="diff">{signed(s.emiDiff)}</td><td className="diff">{signed(s.interestDiff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </section>
              <section className="card no-print table-card">
                <div className="table-scroll" role="region" tabIndex={0} aria-label={t("whatIfTenure")}>
                <table>
                  <caption>{t("whatIfTenure")}</caption>
                  <thead><tr><th scope="col">{t("colTenure")}</th><th scope="col">{t("colEmi")}</th><th scope="col">{t("colTotalInterest")}</th><th scope="col">{t("colEmiDiff")}</th><th scope="col">{t("colInterestDiff")}</th><th scope="col"><span className="sr-only">{t("useTenure")}</span></th></tr></thead>
                  <tbody>
                    {tenureSensitivity(Number(principal), Number(rate), Number(months), [-24, -12, 0, 12, 24]).map((s) => {
                      const label = unit === "years" ? t("tenureShortYears", { n: num(Math.round((s.months / 12) * 100) / 100, 2, false) }) : t("tenureShortMonths", { n: num(s.months) });
                      return (
                        <tr key={s.delta} className={s.delta === 0 ? "current" : s.interestDiff < 0 ? "down" : "up"}>
                          <th scope="row">{label}{s.delta === 0 && <>{" · "}<span className="tag">{t("tenureCurrent")}</span></>}</th>
                          <td>{money(s.emi)}</td><td>{money(s.totalInterest)}</td>
                          <td className="diff">{signed(s.emiDiff)}</td>
                          <td className="diff">{signed(s.interestDiff)}{s.delta !== 0 && <>{" · "}<span className="tag">{s.interestDiff < 0 ? t("tenureCheaper") : t("tenureCostlier")}</span></>}</td>
                          <td>{s.delta !== 0 && <button type="button" className="btn btn-ghost" aria-label={t("useTenureFor", { tenure: label })} onClick={() => setMonthsSynced(String(s.months))}>{t("useTenure")}</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <p className="note">{t("tenureNote")}</p>
              </section>
              <section className="card schedule-card no-print" aria-label={t("amortization")}>
                <div className="schedule-head">
                  <h2 className="card-title">{t("amortization")}</h2>
                  <div className="seg-sm">
                    <button type="button" aria-pressed={view === "monthly"} onClick={() => setView("monthly")}>{t("monthly")}</button>
                    <button type="button" aria-pressed={view === "yearly"} onClick={() => setView("yearly")}>{t("yearly")}</button>
                  </div>
                  <div className="actions">
                    <button type="button" className="btn btn-ghost" onClick={downloadCsv}><Icon name="download" size={18} />{t("downloadCsv")}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="print" size={18} />{t("print")}</button>
                  </div>
                </div>
                <div id="schedule-body" className={`schedule${scheduleOpen ? " is-open" : ""}`}>
                  <div className="table-scroll" role="region" tabIndex={0} aria-label={t(view === "monthly" ? "monthlySchedule" : "yearlySchedule")}>
                  {view === "monthly" ? (
                    <table>
                      <caption>{t("monthlySchedule")}</caption>
                      <thead><tr><th scope="col">{t("colMonth")}</th><th scope="col">{t("colPrincipal")}</th><th scope="col">{t("colInterest")}</th><th scope="col">{t("colExtra")}</th><th scope="col">{t("colBalance")}</th></tr></thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.month}><td>{num(r.month)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.extra)}</td><td>{money(r.balance)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <caption>{t("yearlySchedule")}</caption>
                      <thead><tr><th scope="col">{t("colYear")}</th><th scope="col">{t("colPrincipal")}</th><th scope="col">{t("colInterest")}</th><th scope="col">{t("colBalance")}</th></tr></thead>
                      <tbody>
                        {yearRows.map((y) => (
                          <tr key={y.year}><td>{num(y.year)}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  </div>
                </div>
                {rowCount > 6 && (
                  <button type="button" className="btn btn-ghost show-all" aria-expanded={scheduleOpen} aria-controls="schedule-body" onClick={() => setScheduleOpen(!scheduleOpen)}>
                    {scheduleOpen ? t("showFewerRows") : t("showAllRows", { n: num(rowCount) })}<Icon name="chevron" size={18} />
                  </button>
                )}
              </section>
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
                    {yearRows.map((y) => (
                      <tr key={y.year}><td>{num(y.year)}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </>}
        <footer className="page-footer no-print" aria-label={t("settings")}>
          <button type="button" className="btn btn-ghost" onClick={clearSaved}><Icon name="reset" size={18} />{t("clearSaved")}</button>
        </footer>
      </main>
    </>
  );
}
