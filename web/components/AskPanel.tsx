"use client"; // typing, clicking and fetching happen in the browser
// Ask a question. LIVE mode (an AI key is set on the server): the agent answers anything.
// DEMO mode (no key): pick any of the 40 tested questions and see exactly what the agent did in the real test run.
import { useEffect, useState } from "react";
import ResultCard from "./ResultCard";
import { closest, fromRecord } from "@/lib/gallery";
import type { AgentResult, Report } from "@/lib/types";

const LIVE_EXAMPLES = ["What was revenue by category last month?", "Which 5 cities have the most customers?",
  "Show monthly orders paid by UPI in 2026", "Show me the best products"];
type Shown = { r: AgentResult; verdict?: boolean };

export default function AskPanel({ report }: { report: Report }) {
  const [live, setLive] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [level, setLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [shown, setShown] = useState<Shown[]>(() => {
    const first = report.records.find((r) => r.correct && r.fixed) ?? report.records.find((r) => r.correct && r.chart);
    return first ? [{ r: fromRecord(first, report.summary?.engine), verdict: first.correct }] : [];
  });

  useEffect(() => {
    fetch("/api/ask").then((r) => r.json()).then((d) => setLive(Boolean(d.live))).catch(() => setLive(false));
  }, []);

  const showRecord = (id: string) => {
    const rec = report.records.find((r) => r.id === id);
    if (rec) setShown((s) => [{ r: fromRecord(rec, report.summary?.engine), verdict: rec.correct }, ...s.filter((x) => x.r.question !== rec.question)].slice(0, 6));
    setNotice("");
  };

  async function submit(question: string) {
    const q = question.trim();
    if (q.length < 3) return;
    setNotice("");
    if (!live) {
      const rec = closest(report, q);
      if (rec) return showRecord(rec.id);
      return setNotice("Live AI is off on this site, so only the 40 tested questions below have answers. Or write the SQL yourself in the Playground.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const data = await res.json();
      if (!res.ok) setNotice(data.error ?? "Something went wrong.");
      else setShown((s) => [{ r: data as AgentResult }, ...s].slice(0, 6));
    } catch { setNotice("Network error. Try again."); }
    setBusy(false);
  }

  const levels: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  return (
    <div className="ask">
      <form className="ask-box" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <span className="prompt" aria-hidden="true">›</span>
        <label htmlFor="q" className="sr-only">Your question about the shop&apos;s data</label>
        <textarea id="q" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={400}
          placeholder={live ? "Ask anything about the shop's sales, customers or products…" : "e.g. What was revenue last month?"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }} />
        <div className="ask-controls">
          <span className="status-line mode-pill" data-live={live ? "true" : "false"}>
            {live === null ? "checking…" : live ? "live: Claude writes the SQL" : `demo: real test runs (${report.summary?.engine ?? "not run yet"})`}
          </span>
          <button className="btn-primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? "Thinking…" : "Ask"}</button>
        </div>
      </form>

      {live ? (
        <div className="examples"><span className="examples-label">try:</span>
          {LIVE_EXAMPLES.map((q) => <button key={q} type="button" className="chip" disabled={busy} onClick={() => { setText(q); submit(q); }}>{q}</button>)}
        </div>
      ) : report.records.length ? (
        <div className="chip-group">
          <div className="examples">
            <span className="examples-label">pick a tested question:</span>
            <div className="segmented level-tabs" role="group" aria-label="Difficulty">
              {levels.map((lvl) => {
                const qs = report.records.filter((r) => r.level === lvl);
                return <button key={lvl} type="button" aria-pressed={level === lvl} onClick={() => setLevel(lvl)}>{lvl}<span>{qs.filter((r) => r.correct).length}/{qs.length}</span></button>;
              })}
            </div>
          </div>
          {[level].map((lvl) => (
            <div className="examples" key={lvl}>
              {report.records.filter((r) => r.level === lvl).map((r) => (
                <button key={r.id} type="button" className={`chip ${r.correct ? "chip-ok" : "chip-miss"}`}
                  aria-pressed={shown[0]?.r.question === r.question} onClick={() => showRecord(r.id)}>{r.question}</button>
              ))}
            </div>
          ))}
          <p className="muted">✓ = the agent&apos;s result matched the answer key, ✗ = it didn&apos;t. Mistakes are shown too, on purpose.</p>
        </div>
      ) : (
        <p className="notice">The 40-question test hasn&apos;t run yet. Its results will appear here.</p>
      )}

      {notice && <p className="notice" role="status">{notice}</p>}
      {shown.map((s, i) => <ResultCard key={s.r.question + i} r={s.r} verdict={s.verdict} latest={i === 0} />)}
    </div>
  );
}
