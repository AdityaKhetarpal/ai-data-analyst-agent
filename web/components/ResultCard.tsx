// One answered question: the short answer, chart and table on the left, the SQL (and any fixes) on the right
import DataTable from "./DataTable";
import ResultChart from "./ResultChart";
import SqlPane from "./SqlPane";
import type { AgentResult } from "@/lib/types";

export default function ResultCard({ r, verdict, latest }: { r: AgentResult; verdict?: boolean; latest?: boolean }) {
  const fixes = r.attempts.filter((a) => a.error).length;
  return (
    <article className={`result${latest ? " result-latest" : ""}`}>
      <p className="result-q">{r.question}</p>
      <div className="result-meta">
        {r.source && <span className="tag">{r.source === "live" ? "live answer" : "from the test run"}</span>}
        {r.type === "answer" && <span className="tag">read-only · SQL checked</span>}
        {r.type === "answer" && r.attempts.length > 1 && <span className="tag">{r.attempts.length} tries</span>}
        {fixes > 0 && r.type === "answer" && <span className="tag tag-ok">fixed its own error</span>}
        {r.type === "clarify" && <span className="tag">asked a question back</span>}
        {r.type === "failed" && <span className="tag tag-refused">couldn&apos;t answer</span>}
        {verdict !== undefined && <span className={`tag ${verdict ? "tag-ok" : "tag-refused"}`}>{verdict ? "✓ matches the answer key" : "✗ doesn't match the answer key"}</span>}
      </div>

      {r.type === "clarify" ? (
        <div className="clarify-box"><strong>Needs one detail first</strong>{r.clarify}</div>
      ) : (
        <div className="result-grid">
          <div>
            <p className="answer-big">{r.answer}</p>
            {r.table && r.chart && <ResultChart table={r.table} chart={r.chart} />}
            {r.table && r.table.columns.length > 0 && <DataTable table={r.table} />}
          </div>
          <SqlPane sql={r.sql} attempts={r.attempts} />
        </div>
      )}
    </article>
  );
}
