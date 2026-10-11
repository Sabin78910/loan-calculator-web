import type { CSSProperties, ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { formatDate, formatLakh, formatMoney, formatNumber, translate } from "./i18n";
import type { Currency, Key, Lang } from "./i18n";

export const LangContext = createContext<Lang>("en");
export const CurrencyContext = createContext<Currency>("NPR");

/** Translations are written with NPR/रु; swap them for the chosen currency (amounts carry their own symbol). */
function localizeCurrency(text: string, currency: Currency): string {
  if (currency === "NPR") return text;
  return text.replace(/ ?\((NPR|रु)\)/g, currency === "none" ? "" : ` (${currency})`).replace(/(NPR|रु) (?=\S)/g, "");
}

export function useI18n() {
  const lang = useContext(LangContext);
  const currency = useContext(CurrencyContext);
  const t = (key: Key, params?: Record<string, string | number>) => localizeCurrency(translate(lang, key, params), currency);
  const money = (n: number) => formatMoney(lang, n, currency === "NPR" ? undefined : currency);
  const southAsian = currency === "NPR" || currency === "INR" || currency === "none";
  return {
    lang,
    currency,
    t,
    money,
    /** Amount with its currency, e.g. "NPR 5,000.00" or "$5,000.00". */
    cash: (n: number) => t("amountOnly", { amount: money(n) }),
    /** Short amount for tight spaces: lakh/crore for South Asian currencies, K/M otherwise. */
    compact: (n: number) => southAsian
      ? formatLakh(lang, n)
      : n.toLocaleString(lang === "ne" ? "ne-NP" : "en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }),
    lakh: (n: number) => formatLakh(lang, n),
    num: (n: number, digits = 0, fixed = true) => formatNumber(lang, n, digits, fixed),
    date: (d: Date) => formatDate(lang, d),
    err: (msg: string) => translate(lang, `err.${msg}` as Key) === `err.${msg}` ? msg : translate(lang, `err.${msg}` as Key),
  };
}

export const canAnimate = () =>
  typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tweens toward `target` (from 0 on first mount, then from the last shown value); jumps there when motion is reduced. */
export function useCountUp(target: number, ms = 800) {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));
  const shown = useRef(value);
  useEffect(() => {
    if (!canAnimate()) { shown.current = target; setValue(target); return; }
    const from = shown.current;
    const start = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      const v = from + (target - from) * (1 - (1 - p) ** 3);
      shown.current = v;
      setValue(v);
      if (p < 1) id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return value;
}

/** Element width via ResizeObserver; `fallback` until measured (and in tests). */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setW(Math.round(e.contentRect.width)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const ICONS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
  car: ["M5 17H3.8a.8.8 0 0 1-.8-.8V13l2-5.2A1.8 1.8 0 0 1 6.7 6.6h10.6a1.8 1.8 0 0 1 1.7 1.2L21 13v3.2a.8.8 0 0 1-.8.8H19", "M9 17h6", "M3 13h18", "M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"],
  personal: ["M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-3", "M3 6v13a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3"],
  education: ["M22 9 12 4 2 9l10 5z", "M6 11.2V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.8", "M22 9v5"],
  calc: ["M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8.5 7h7", "M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"],
  gauge: ["M12 14l4-4", "M3.3 19a10 10 0 1 1 17.4 0"],
  bars: ["M5 20v-9", "M12 20V4", "M19 20v-6"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  link: ["M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"],
  sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 15l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"],
  flag: ["M5 21V4", "M5 4h12l-2 4 2 4H5"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
  print: ["M7 9V3h10v6", "M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M7 14h10v7H7z"],
  chevron: ["M6 9l6 6 6-6"],
  plus: ["M12 5v14M5 12h14"],
  x: ["M6 6l12 12M18 6 6 18"],
  reset: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"],
  trophy: ["M8 21h8M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0z", "M17 5h3v1a4 4 0 0 1-3 4M7 5H4v1a4 4 0 0 0 3 4"],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export type Term = "EMI" | "interest rate" | "tenure" | "amortization" | "prepayment";

export function InfoButton({ term }: { term: Term }) {
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

/** CSS custom property for a range's filled track. */
export const fillStyle = (value: number, min: number, max: number) =>
  ({ "--fill": `${Math.min(100, Math.max(0, ((value - min) / (max - min || 1)) * 100))}%` }) as CSSProperties;

export function SliderField({ id, label, sliderLabel, value, onChange, min, max, step, inputMode, info, inputValue, onInputChange, head, hint, scale, ...aria }: {
  id: string; label: string; sliderLabel: string; value: string; onChange: (v: string) => void;
  min: number; max: number; step: number; inputMode: "decimal" | "numeric"; info?: Term;
  inputValue?: string; onInputChange?: (v: string) => void; head?: ReactNode; hint?: ReactNode; scale?: [string, string];
  "aria-invalid"?: boolean; "aria-describedby"?: string;
}) {
  const n = Number(value);
  const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id} className="field-label">{label}</label>
        {info && <InfoButton term={info} />}
        {head}
      </div>
      <div className="field-box">
        <input id={id} className="field-input" inputMode={inputMode} autoComplete="off" value={inputValue ?? value} {...aria} onChange={(e) => (onInputChange ?? onChange)(e.target.value)} />
        {hint}
      </div>
      <input
        type="range" className="slider" aria-label={sliderLabel} min={min} max={max} step={step}
        value={clamped} style={fillStyle(clamped, min, max)} onChange={(e) => onChange(e.target.value)}
      />
      {scale && <div className="scale" aria-hidden="true"><span>{scale[0]}</span><span>{scale[1]}</span></div>}
    </div>
  );
}
