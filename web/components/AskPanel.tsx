"use client"; // typing, clicking and fetching happen in the browser
// Ask a question about the shop's data. The server answers it live and returns the SQL with the result.
import { useState } from "react";
import Link from "next/link";
import ResultCard from "./ResultCard";
import type { AgentResult } from "@/lib/types";

const EXAMPLES = [
  "What was revenue by category last month?",
  "Show the monthly revenue trend for 2026",
  "Top 5 products by units sold in 2025",
  "Which city has the highest average order value?",
  "Return rate by payment method",
  "What share of revenue comes from each segment?",
  "Revenue growth Q3 2026 vs Q3 2025",
  "How many customers have never placed an order?",
  "Show me the best products",
];

export default function AskPanel() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [shown, setShown] = useState<AgentResult[]>([]);

  async function submit(question: string) {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setNotice(""); setBusy(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const data = await res.json();
      if (!res.ok) setNotice(data.error ?? "Something went wrong.");
      else setShown((s) => [data as AgentResult, ...s].slice(0, 8));
    } catch { setNotice("Network error. Try again."); }
    setBusy(false);
  }

  return (
    <div className="ask">
      <form className="ask-box" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <span className="prompt" aria-hidden="true">›</span>
        <label htmlFor="q" className="sr-only">Your question about the shop&apos;s data</label>
        <textarea id="q" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={400}
          placeholder="Ask about sales, orders, customers or products… e.g. revenue by city in 2026"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }} />
        <div className="ask-controls">
          <span className="status-line mode-pill" data-live="true">live · read-only database · Jan 2025 to Sep 2026</span>
          <button className="btn-primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? "Thinking…" : "Ask"}</button>
        </div>
      </form>

      <div className="examples"><span className="examples-label">try:</span>
        {EXAMPLES.map((q) => <button key={q} type="button" className="chip" disabled={busy} onClick={() => { setText(q); submit(q); }}>{q}</button>)}
      </div>

      {notice && <p className="notice" role="status">{notice}</p>}
      {busy && !shown.length && <p className="muted">Writing and checking the SQL…</p>}
      {shown.map((r, i) => <ResultCard key={r.question + i} r={r} latest={i === 0} />)}
      {!shown.length && !busy && (
        <p className="muted">Every answer comes with the exact SQL that produced it. <Link href="/results">See how the agent did on 40 test questions →</Link></p>
      )}
    </div>
  );
}
