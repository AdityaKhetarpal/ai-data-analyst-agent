"use client"; // the Copy button needs the browser
// The SQL the agent ran, always shown next to the answer. Failed tries are listed first, crossed out, with the error.
import { useState } from "react";
import type { Attempt } from "@/lib/types";

const KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|INNER|ON|GROUP|BY|ORDER|HAVING|LIMIT|AS|AND|OR|NOT|IN|IS|NULL|WITH|CASE|WHEN|THEN|ELSE|END|DISTINCT|BETWEEN|LIKE|DESC|ASC|UNION|ALL|SUM|COUNT|AVG|MIN|MAX|ROUND)\b/gi;

export function Highlight({ sql }: { sql: string }) {
  const parts = sql.split(/('(?:[^']|'')*')/g);
  return (
    <pre className="sql-code">
      {parts.map((part, i) =>
        part.startsWith("'") ? <span key={i} className="str">{part}</span> :
          part.split(/(\b\d+(?:\.\d+)?\b)/g).map((p, j) =>
            /^\d/.test(p) ? <span key={`${i}-${j}`} className="num">{p}</span> :
              p.split(KEYWORDS).map((w, k) => (k % 2 ? <span key={`${i}-${j}-${k}`} className="kw">{w.toUpperCase()}</span> : w))))}
    </pre>
  );
}

export default function SqlPane({ sql, attempts }: { sql?: string | null; attempts: Attempt[] }) {
  const [copied, setCopied] = useState(false);
  const failed = attempts.filter((a) => a.error);
  return (
    <div className="sql-pane">
      <div className="sql-head">
        <span>SQL {failed.length ? `· fixed itself after ${failed.length} error${failed.length > 1 ? "s" : ""}` : "· worked first try"}</span>
        {sql && <button type="button" onClick={() => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>}
      </div>
      {failed.length > 0 && (
        <ol className="attempts">
          {failed.map((a, i) => (
            <li key={i} className="attempt">
              <div className="attempt-head">try {i + 1} failed: {a.error}</div>
              <Highlight sql={a.sql} />
            </li>
          ))}
        </ol>
      )}
      {failed.length > 0 && sql && <p className="fix-note">↳ error sent back to the AI, which rewrote the query:</p>}
      {sql ? <Highlight sql={sql} /> : <p className="sql-code">No query ran.</p>}
    </div>
  );
}
