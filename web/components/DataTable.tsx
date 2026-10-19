// The result rows exactly as the database returned them
import { fmt, label } from "@/lib/agent";
import type { Table } from "@/lib/types";

export default function DataTable({ table, max = 50 }: { table: Table; max?: number }) {
  const rows = table.rows.slice(0, max);
  const total = table.total_rows ?? table.rows.length;
  return (
    <div className="data-table">
      <table>
        <thead><tr>{table.columns.map((c) => <th key={c} className={typeof rows[0]?.[table.columns.indexOf(c)] === "number" ? "num" : ""}>{label(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{fmt(v, table.columns[j])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && <p className="table-note">Showing {rows.length} of {total.toLocaleString("en-IN")} rows.</p>}
    </div>
  );
}
