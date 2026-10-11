import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import { donutArcs } from "./emi";
import type { ChartPoint } from "./emi";
import { useI18n, useWidth } from "./ui";

export function Donut({ principalPct, interestPct, total }: { principalPct: number; interestPct: number; total: number }) {
  const { t, num, compact } = useI18n();
  const R = 54;
  const arcs = donutArcs(principalPct, interestPct, R);
  const circle = (key: "principal" | "interest") => (
    <circle
      data-arc={key} className={`donut-${key}`} cx="70" cy="70" r={R} fill="none" strokeWidth="16" strokeLinecap="butt"
      strokeDasharray={`${arcs[key].length} ${arcs.circumference - arcs[key].length}`}
      strokeDashoffset={arcs[key].offset} transform="rotate(-90 70 70)"
    />
  );
  return (
    <div className="donut">
      <div className="donut-ring">
        <svg viewBox="0 0 140 140" width="152" height="152" role="img" aria-label={t("donutAria", { principal: num(principalPct, 1), interest: num(interestPct, 1) })}>
          <circle className="donut-track" cx="70" cy="70" r={R} fill="none" strokeWidth="16" />
          {circle("principal")}
          {circle("interest")}
        </svg>
        <div className="donut-center" aria-hidden="true">
          <span>{t("donutCenter")}</span>
          <strong>{compact(total)}</strong>
        </div>
      </div>
      <ul className="legend">
        <li><span className="swatch swatch-principal" aria-hidden="true" /><span>{t("principalPct", { pct: num(principalPct, 1) })}</span></li>
        <li><span className="swatch swatch-interest" aria-hidden="true" /><span>{t("interestPct", { pct: num(interestPct, 1) })}</span></li>
      </ul>
    </div>
  );
}

/** Balance-over-time area chart; `baseline` (no prepayment) adds a dashed line and a gold "paid off sooner" band. */
export function BalanceChart({ points, baseline }: { points: ChartPoint[]; baseline: ChartPoint[] | null }) {
  const { t, money, num, compact } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap, 640), H = 300, L = 68, R = 18, T = 14, B = 30;
  const all = baseline ? [...points, ...baseline] : points;
  const maxY = Math.max(1, ...all.map((p) => Math.max(p.balance, p.interestPaid)));
  const lastYear = Math.max(1, ...all.map((p) => p.year));
  const x = (year: number) => L + (year / lastYear) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);
  const line = (list: ChartPoint[], f: (p: ChartPoint) => number) => list.map((p) => `${x(p.year).toFixed(1)},${y(f(p)).toFixed(1)}`).join(" ");
  const area = (list: ChartPoint[], f: (p: ChartPoint) => number) => `${line(list, f)} ${x(list[list.length - 1].year)},${y(0)} ${x(0)},${y(0)}`;
  const [active, setActive] = useState<number | null>(null);
  const first = points[0], last = points[points.length - 1];
  const tip = active === null ? null : points[active];
  const summary = t("chartSummary", { start: money(first.balance), end: money(last.balance), years: num(last.year), principal: money(last.principalPaid), interest: money(last.interestPaid) });

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).getAttribute("data-testid") === "chart-point") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.year) - vx) < Math.abs(x(points[best].year) - vx)) best = i; });
    setActive(best);
  };

  return (
    <section className="card chart-card" aria-label={t("balanceOverTime")}>
      <h2 className="card-title">{t("balanceOverTime")}</h2>
      <div className="chart" ref={wrap}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={summary} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="stop-emerald" stopOpacity="0.45" />
              <stop offset="100%" className="stop-emerald" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="gridline" x1={L} x2={W - R} y1={y(maxY * f)} y2={y(maxY * f)} />)}
          {[0, 0.5, 1].map((f) => <text key={f} className="axis" x={L - 10} y={y(maxY * f) + 4} textAnchor="end">{f === 0 ? "0" : compact(maxY * f)}</text>)}
          {baseline && <polygon className="saved-band" points={`${line(baseline, (p) => p.balance)} ${line([...points].reverse(), (p) => p.balance)}`} />}
          <polygon points={area(points, (p) => p.balance)} fill="url(#balance-fill)" />
          <polygon className="interest-area" points={area(points, (p) => p.interestPaid)} />
          {baseline && <polyline className="baseline-line" points={line(baseline, (p) => p.balance)} fill="none" />}
          <polyline className="interest-line" points={line(points, (p) => p.interestPaid)} fill="none" />
          <polyline className="balance-line" points={line(points, (p) => p.balance)} fill="none" />
          {tip && <line className="crosshair" x1={x(tip.year)} x2={x(tip.year)} y1={T} y2={y(0)} />}
          {points.map((p, i) => (
            <circle
              key={p.year} data-testid="chart-point" className="chart-point" cx={x(p.year)} cy={y(p.balance)} r={active === i ? 7 : 4.5} tabIndex={0}
              aria-label={t("chartPoint", { year: num(p.year), balance: money(p.balance), interest: money(p.interestPaid) })}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
            />
          ))}
          <text className="axis" x={L} y={H - 8}>{t("year0")}</text>
          <text className="axis" x={W - R} y={H - 8} textAnchor="end">{t("yearN", { year: num(lastYear) })}</text>
        </svg>
        {tip && (
          <div role="tooltip" className="chart-tip" style={{ left: `${Math.min(80, Math.max(20, (x(tip.year) / W) * 100))}%` }}>
            {t("chartTip", { year: num(tip.year), balance: money(tip.balance), interest: money(tip.interestPaid) })}
          </div>
        )}
      </div>
      <ul className="legend legend-row">
        <li><span className="swatch swatch-principal" aria-hidden="true" />{t("legendBalance")}</li>
        <li><span className="swatch swatch-interest" aria-hidden="true" />{t("legendInterest")}</li>
        {baseline && <li><span className="swatch swatch-baseline" aria-hidden="true" />{t("legendBaseline")}</li>}
        {baseline && <li><span className="swatch swatch-saved" aria-hidden="true" />{t("legendSaved")}</li>}
      </ul>
    </section>
  );
}
