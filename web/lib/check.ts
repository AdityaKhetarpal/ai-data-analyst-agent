// Website version of step 5: check SQL before running it. (The Python agent uses the sqlglot parser;
// here a simpler check is enough because the site runs queries on its own in-memory COPY of the database.)
export const TABLES = ["customers", "products", "orders", "order_items"];
const BLOCKED = /\b(insert|update|delete|drop|create|alter|attach|detach|pragma|replace|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release)\b/i;

/** Remove 'text', "names" and -- comments so keywords inside them are ignored. */
function strip(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
}

export function checkSql(raw: string, rowLimit = 200): string {
  const sql = (raw ?? "").trim().replace(/;\s*$/, "").trim();
  if (!sql) throw new Error("no SQL was written");
  const bare = strip(sql);
  if (bare.includes(";")) throw new Error("write exactly one statement");
  if (!/^(select|with)\b/i.test(bare.trim())) throw new Error("only SELECT queries are allowed (the database is read-only)");
  if (BLOCKED.test(bare)) throw new Error("only SELECT queries are allowed (the database is read-only)");

  const ctes = new Set([...bare.matchAll(/(?:with|,)\s*([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) => m[1].toLowerCase()));
  for (const m of bare.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)) {
    const name = m[1].toLowerCase();
    if (!TABLES.includes(name) && !ctes.has(name)) throw new Error(`unknown table '${m[1]}'. The tables are: ${TABLES.join(", ")}`);
  }
  return `SELECT * FROM (\n${sql}\n) LIMIT ${rowLimit}`;   // row limit on every query
}
