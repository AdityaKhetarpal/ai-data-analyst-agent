// Copies the in-browser SQLite engine (sql.js, compiled to WebAssembly) into public/ so the browser can load it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/sqljs", { recursive: true });
for (const file of ["sql-wasm-browser.js", "sql-wasm-browser.wasm"]) copyFileSync(`node_modules/sql.js/dist/${file}`, `public/sqljs/${file}`);
console.log("sql.js copied to public/sqljs");
