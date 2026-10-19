// Test results: all 40 questions, what the agent wrote, what the right answer was, and whether they match
import type { Metadata } from "next";
import DataTable from "@/components/DataTable";
import { Highlight } from "@/components/SqlPane";
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";

export const metadata: Metadata = { title: "Test results · AI Data Analyst Agent" };

export default function ResultsPage() {
  const r = report as unknown as Report;
  const s = r.summary;
  return (
    <>
      <section className="hero hero-small"><div className="wrap">
        <p className="eyebrow-chip">step 8 · execution accuracy</p>
        <h1>40 business questions with known answers.</h1>
        <p className="lead">
          For each question the agent writes its own SQL. We run it and the correct SQL, and compare the <strong>results</strong>{" "}
          (not the SQL text, since there are many right ways to write a query). Extra columns, column names, row order and
          rounding don&apos;t count against it. It runs automatically on GitHub every Monday.
        </p>
      </div></section>

      <div className="wrap">
        {!s ? <div className="panel empty-state" style={{ marginTop: 24 }}>The test hasn&apos;t run yet.</div> : <>
          <div className="stats">
            <div className="stat"><p className="stat-label">Execution accuracy</p><p className="stat-value">{s.execution_accuracy_pct}%</p><p className="stat-note">{Math.round(s.execution_accuracy_pct * s.questions / 100)} of {s.questions} right</p></div>
            <div className="stat"><p className="stat-label">Right on the first try</p><p className="stat-value">{s.first_try_pct}%</p><p className="stat-note">before any self-correction</p></div>
            <div className="stat"><p className="stat-label">Saved by self-correction</p><p className="stat-value">{s.fixed_by_retry}</p><p className="stat-note">wrong first, right after seeing the error</p></div>
            <div className="stat"><p className="stat-label">Vague questions asked back</p><p className="stat-value">{s.vague_asked_back.replace(" of ", "/")}</p><p className="stat-note">instead of guessing</p></div>
          </div>
          <p className="note">AI: {s.engine} · run on {s.run_date} · {s.ran_without_error_pct}% of queries ran without an error.</p>

          <section className="section panel">
            <div className="panel-head"><h2>By difficulty</h2><span className="muted">share answered right</span></div>
            <div className="bars">
              {Object.entries(s.by_level).map(([lvl, v]) => {
                const pct = v.questions ? (100 * v.right) / v.questions : 0;
                return (
                  <div className="bar-row" key={lvl}>
                    <div className="bar-name">{lvl}<small>{lvl === "easy" ? "one table" : lvl === "medium" ? "joins + business rules" : "several steps"}</small></div>
                    <div className="bar-track"><div className="bar" style={{ width: `${pct * 0.85}%` }} /><span className="bar-value">{v.right}/{v.questions}</span></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section panel">
            <div className="panel-head"><h2>Every question</h2><span className="muted">open one to compare the SQL and results</span></div>
            {r.records.map((q) => (
              <details key={q.id} className="q-row">
                <summary>
                  <span className={`score-cell ${q.correct ? "score-ok" : "score-bad"}`}>{q.correct ? "✓" : "✗"}</span>
                  <span className="q-text">{q.question}</span>
                  <span className="tag">{q.level}</span>
                  <span className="tag">{q.tries} {q.tries === 1 ? "try" : "tries"}</span>
                </summary>
                <div className="q-body">
                  <div className="compare">
                    <div><h4>Agent wrote</h4><div className="sql-pane">{q.sql ? <Highlight sql={q.sql} /> : <p className="sql-code">{q.answer}</p>}</div>
                      {q.attempts.filter((a) => a.error).map((a, i) => <p key={i} className="muted">try {i + 1} error: {a.error}</p>)}
                      {q.table && <DataTable table={q.table} max={5} />}</div>
                    <div><h4>Answer key</h4><div className="sql-pane"><Highlight sql={q.expected_sql} /></div>
                      {q.expected && <DataTable table={q.expected} max={5} />}</div>
                  </div>
                </div>
              </details>
            ))}
          </section>

          <section className="section panel">
            <div className="panel-head"><h2>Vague questions</h2><span className="muted">the right move is to ask back, not guess</span></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Question</th><th>Asked back?</th><th>What it said</th></tr></thead>
              <tbody>{r.vague.map((v) => (
                <tr key={v.id}><td>{v.question}</td><td className={v.asked_back ? "score-ok" : "score-bad"}>{v.asked_back ? "✓ yes" : "✗ no"}</td>
                  <td className="answer-cell muted">{(v.reply ?? "").slice(0, 160)}</td></tr>))}</tbody>
            </table></div>
          </section>
        </>}
      </div>
    </>
  );
}
