// Open the shop database with sql.js (SQLite compiled to WebAssembly). Works on the server and in tests.
// The database is loaded into memory as a COPY, so nothing a query does can touch the real file.
import { readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import type { Table } from "./types";

let cached: Promise<Database> | null = null;

export function openShop(): Promise<Database> {
  cached ??= initSqlJs({ locateFile: (f) => path.join(process.cwd(), "node_modules/sql.js/dist", f) }).then((SQL) => {
    const db = new SQL.Database(readFileSync(path.join(process.cwd(), "public/data/shop.db")));
    db.exec("PRAGMA query_only = ON");   // read-only, as in step 2
    return db;
  });
  return cached;
}

export function runOn(db: Database) {
  return (sql: string): Table => {
    const [res] = db.exec(sql);
    return res ? { columns: res.columns, rows: res.values as Table["rows"], total_rows: res.values.length } : { columns: [], rows: [], total_rows: 0 };
  };
}
