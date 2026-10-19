"use client"; // the whole database runs inside your browser
// SQL playground: the same shop database, loaded into the browser with sql.js (SQLite compiled to WebAssembly).
// No server and no AI: you write the SQL, the same safety check as the agent runs first.
import { useEffect, useRef, useState } from "react";
import type { Database, SqlJsStatic } from "sql.js";
import DataTable from "./DataTable";
import ResultChart from "./ResultChart";
import { checkSql } from "@/lib/check";
import { pickChart, summarise } from "@/lib/agent";
import type { Table } from "@/lib/types";

type Loader = (cfg: { locateFile: (f: string) => string }) => Promise<SqlJsStatic>;
const loader = () => (window as unknown as { initSqlJs?: Loader }).initSqlJs;

const PRESETS: Record<string, string> = {
  "Revenue by month": `SELECT substr(o.order_date, 1, 7) AS month,
       ROUND(SUM(oi.quantity * oi.unit_price_inr * (1 - oi.discount_pct / 100.0)), 2) AS revenue_inr
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
WHERE o.status IN ('delivered', 'shipped')
GROUP BY month
ORDER BY month`,
  "Orders by payment method": `SELECT payment_method, COUNT(*) AS orders
FROM orders
GROUP BY payment_method
ORDER BY orders DESC`,
  "Return rate by category": `SELECT p.category,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN o.status = 'returned' THEN o.order_id END)
             / COUNT(DISTINCT CASE WHEN o.status != 'cancelled' THEN o.order_id END), 2) AS return_rate_pct
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category
ORDER BY return_rate_pct DESC`,
  "Try to delete (blocked)": "DELETE FROM orders",
};

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (loader()) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error("could not load sql.js"));
    document.head.appendChild(s);
  });
}

type Tables = Record<string, { rows: number; columns: string[] }>;

export default function Playground({ tables }: { tables: Tables }) {
  const db = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [sql, setSql] = useState(PRESETS["Revenue by month"]);
  const [result, setResult] = useState<{ table: Table; ms: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      await loadScript("/sqljs/sql-wasm-browser.js");
      const SQL = await loader()!({ locateFile: (f) => `/sqljs/${f}` });
      const bytes = new Uint8Array(await (await fetch("/data/shop.db")).arrayBuffer());
      db.current = new SQL.Database(bytes);
      db.current.exec("PRAGMA query_only = ON");
      setReady(true);
    })().catch((e) => setError(String(e)));
  }, []);

  function run(text = sql) {
    setError(""); setResult(null);
    if (!db.current) return;
    try {
      const safe = checkSql(text);
      const t0 = performance.now();
      const [res] = db.current.exec(safe);
      const table: Table = res ? { columns: res.columns, rows: res.values as Table["rows"], total_rows: res.values.length } : { columns: [], rows: [] };
      setResult({ table, ms: performance.now() - t0 });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const chart = result ? pickChart(result.table) : null;
  return (
    <div className="play">
      <aside className="schema" aria-label="Tables">
        {Object.entries(tables).map(([name, t]) => (
          <div key={name}>
            <h3>{name} <small>{t.rows.toLocaleString("en-IN")} rows</small></h3>
            <ul>{t.columns.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ))}
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="editor">
          <label htmlFor="sql" className="sr-only">SQL query</label>
          <textarea id="sql" spellCheck={false} value={sql} onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }} />
          <div className="editor-bar">
            <span className="muted">{ready ? "database loaded in your browser · Ctrl+Enter to run" : error ? "" : "loading database…"}</span>
            {Object.keys(PRESETS).map((k) => <button key={k} type="button" className="preset" onClick={() => { setSql(PRESETS[k]); run(PRESETS[k]); }}>{k}</button>)}
            <button type="button" className="btn-primary" disabled={!ready} onClick={() => run()}>Run</button>
          </div>
        </div>
        {error && <p className="notice error" role="alert">Blocked or failed: {error}</p>}
        {result && (
          <div className="result" style={{ marginTop: 16 }}>
            <p className="answer-big">{summarise(result.table)}</p>
            <p className="muted">{result.table.rows.length} rows in {result.ms.toFixed(0)} ms</p>
            {chart && <ResultChart table={result.table} chart={chart} />}
            {result.table.columns.length > 0 && <DataTable table={result.table} max={200} />}
          </div>
        )}
      </div>
    </div>
  );
}
