import { useEffect, useMemo, useState } from "react";
import { compareMany } from "./emi";
import { Icon, useI18n } from "./ui";

export type LoanInput = { principal: string; rate: string; months: string };
const NAMES = ["A", "B", "C"] as const;
export const MAX_LOANS = NAMES.length;

/** Side-by-side comparison of up to three offers; the cheapest by total cost is highlighted. */
export function Compare({ initial, initialLoans, onLoansChange }: { initial: LoanInput; initialLoans?: LoanInput[]; onLoansChange?: (loans: LoanInput[]) => void }) {
  const { t, money, cash, lakh, err } = useI18n();
  const [loans, setLoans] = useState<LoanInput[]>(() => {
    const seed = initialLoans?.length ? initialLoans : [initial];
    return seed.length > 1 ? seed : [seed[0], { ...seed[0], rate: "10" }];
  });
  useEffect(() => { onLoansChange?.(loans); }, [loans, onLoansChange]);
  const update = (i: number, patch: Partial<LoanInput>) => setLoans(loans.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const { cmp, error } = useMemo(() => {
    try {
      return { cmp: compareMany(loans.map((l) => ({ principal: Number(l.principal), rate: Number(l.rate), months: Number(l.months) }))), error: null };
    } catch (e) {
      return { cmp: null, error: (e as Error).message };
    }
  }, [loans]);
  const worst = cmp ? Math.max(...cmp.results.map((r) => r.totalPayment)) : 0;
  const best = cmp?.cheapest ?? null;

  return (
    <div className="compare">
      <p className="lead">{t("compareIntro")}</p>
      <div className="compare-grid">
        {loans.map((l, i) => {
          const name = NAMES[i];
          const r = cmp?.results[i];
          const amount = Number(l.principal);
          return (
            <section key={name} className={`card loan-card${best === i ? " is-best" : ""}`} aria-labelledby={`loan-${name}`}>
              <div className="loan-head">
                <h2 id={`loan-${name}`}>{t("loanX", { name })}</h2>
                {best === i && <span className="best-chip"><Icon name="trophy" size={16} />{t("cheapest")}</span>}
                {i === MAX_LOANS - 1 && (
                  <button type="button" className="icon-btn" aria-label={t("removeLoan", { name })} onClick={() => setLoans(loans.slice(0, i))}><Icon name="x" /></button>
                )}
              </div>
              <label className="stack">{t("loanXAmount", { name })}<input className="field-input" inputMode="decimal" value={l.principal} onChange={(e) => update(i, { principal: e.target.value })} /></label>
              {amount > 0 && <p className="hint">= {lakh(amount)}</p>}
              <label className="stack">{t("loanXRate", { name })}<input className="field-input" inputMode="decimal" value={l.rate} onChange={(e) => update(i, { rate: e.target.value })} /></label>
              <label className="stack">{t("loanXTenure", { name })}<input className="field-input" inputMode="numeric" value={l.months} onChange={(e) => update(i, { months: e.target.value })} /></label>
              {r && (
                <div className="loan-result">
                  <span className="eyebrow">{t("monthlyPayment")}</span>
                  <strong className="loan-emi">{cash(r.emi)}</strong>
                  <div className="cost-bar" aria-hidden="true"><span style={{ width: `${(r.totalPayment / worst) * 100}%` }} /></div>
                </div>
              )}
            </section>
          );
        })}
        {loans.length < MAX_LOANS && (
          <button type="button" className="add-loan" onClick={() => setLoans([...loans, { ...loans[loans.length - 1] }])}>
            <Icon name="plus" size={28} />{t("addLoan", { name: NAMES[loans.length] })}
          </button>
        )}
      </div>
      {error && <p className="error" role="alert">{err(error)}</p>}
      {cmp && (
        <>
          {best !== null
            ? <p className="gold-note"><Icon name="sparkle" />{t("cheapestSaves", { name: NAMES[best], amount: money(worst - cmp.results[best].totalPayment) })}</p>
            : <p className="muted">{t("compareTie")}</p>}
          <div className="card table-card">
            <table aria-live="polite">
              <caption>{t("loanComparison")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("measure")}</th>
                  {loans.map((_, i) => <th scope="col" key={i}>{t("loanX", { name: NAMES[i] })}{best === i ? t("cheaper") : ""}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">{t("monthlyPayment")}</th>{cmp.results.map((r, i) => <td key={i}>{money(r.emi)}</td>)}</tr>
                <tr><th scope="row">{t("totalInterest")}</th>{cmp.results.map((r, i) => <td key={i}>{money(r.totalInterest)}</td>)}</tr>
                <tr><th scope="row">{t("totalCost")}</th>{cmp.results.map((r, i) => <td key={i} className={best === i ? "highlight" : undefined}>{money(r.totalPayment)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
