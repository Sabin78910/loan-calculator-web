import { useState } from "react";
import type { SyncStatus } from "./useSync";
import { useI18n } from "./ui";

type Props = {
  code: string | null;
  status: SyncStatus;
  turnOn: () => void;
  connectCode: (text: string) => boolean;
  turnOff: () => void;
  syncNow: () => void;
  onCopied: () => void;
};

const STATUS_KEY = { off: "syncStatusOff", syncing: "syncStatusSyncing", synced: "syncStatusSynced", offline: "syncStatusOffline", error: "syncStatusError" } as const;

export function SyncPanel({ code, status, turnOn, connectCode, turnOff, syncNow, onCopied }: Props) {
  const { t } = useI18n();
  const [entering, setEntering] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code ?? ""); onCopied(); } catch { /* clipboard unavailable */ }
  };
  const connect = () => {
    if (connectCode(text)) { setEntering(false); setText(""); setBad(false); } else setBad(true);
  };
  return (
    <section className="card sync-panel" aria-labelledby="sync-title">
      <h2 id="sync-title">{t("syncTitle")} <span className="best-chip" role="status">{t(STATUS_KEY[status])}</span></h2>
      <p className="muted">{t("syncIntro")}</p>
      {code ? (
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={copy}>{t("syncCopy")}</button>
          <button type="button" className="btn btn-ghost" onClick={syncNow}>{t("syncNow")}</button>
          <button type="button" className="btn btn-ghost" onClick={turnOff}>{t("syncTurnOff")}</button>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={turnOn}>{t("syncTurnOn")}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEntering(!entering)} aria-expanded={entering}>{t("syncUseCode")}</button>
        </div>
      )}
      {!code && entering && (
        <div className="stack">
          <label className="stack">{t("syncCodeLabel")}<input className="field-input" value={text} onChange={(e) => { setText(e.target.value); setBad(false); }} autoComplete="off" spellCheck={false} /></label>
          <button type="button" className="btn btn-ghost" onClick={connect}>{t("syncConnect")}</button>
          {bad && <p className="error" role="alert">{t("syncBadCode")}</p>}
        </div>
      )}
    </section>
  );
}
