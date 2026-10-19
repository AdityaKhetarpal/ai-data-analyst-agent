// Website version of step 7: write SQL -> check -> run -> fix (up to 2 times) -> answer. Same logic as agent/step7_agent.py.
import { checkSql, COLUMNS } from "./check";
import type { AgentResult, Attempt, Cell, Chart, Message, PromptFile, Table } from "./types";

export type Writer = (system: string, messages: Message[]) => Promise<string>;
export type Runner = (sql: string) => Table;

export function readReply(text: string): { kind: "clarify" | "sql"; content: string } {
  const t = (text ?? "").trim();
  const c = t.match(/CLARIFY:\s*(.+)/);
  if (c && !/select/i.test(t.slice(0, c.index))) return { kind: "clarify", content: c[1].split("\n")[0].trim() };
  const block = t.match(/```(?:sql|sqlite)?\s*([\s\S]*?)```/i);
  return { kind: "sql", content: (block ? block[1] : t).trim() };
}

export async function ask(question: string, write: Writer, run: Runner, prompt: PromptFile): Promise<AgentResult> {
  let messages: Message[] = [...prompt.examples, { role: "user", content: question }];
  const attempts: Attempt[] = [];
  let warned = false;   // the business-rule warning is given at most once
  for (let attempt = 0; attempt <= prompt.max_fixes; attempt++) {
    const reply = await write(prompt.system, messages);
    const { kind, content } = readReply(reply);
    if (kind === "clarify") return { type: "clarify", question, clarify: content, attempts };
    try {
      const sql = checkSql(content, prompt.row_limit);
      const table = run(sql);
      if (!table.rows.length && attempt < prompt.max_fixes)
        throw new Error("the query ran but returned no rows. Check text values (they are case-sensitive) and date filters. If no rows really is the right answer, return the same query again.");
      const problem = businessCheck(content);
      if (problem && !warned && attempt < prompt.max_fixes) { warned = true; throw new Error(problem); }
      attempts.push({ sql: content, error: null });
      return { type: "answer", question, sql: content, table, answer: summarise(table), chart: pickChart(table), attempts };
    } catch (err) {
      const error = explainError(err instanceof Error ? err.message : String(err));
      attempts.push({ sql: content, error });
      messages = [...messages, { role: "assistant", content: reply },
        { role: "user", content: `That query has a problem: ${error}\nFix it. Reply with only the corrected SQL.` }];
    }
  }
  return { type: "failed", question, attempts, answer: `I couldn't write a working query after ${attempts.length} tries. Last error: ${attempts.at(-1)?.error}` };
}

// ---------- extra help for self-correction (same as agent/step5_check_sql.py) ----------
export function explainError(message: string): string {
  const m = message.match(/no such column: (?:\w+\.)?(\w+)/);
  if (!m) return message;
  const column = m[1].toLowerCase();
  const homes = Object.entries(COLUMNS).filter(([, cols]) => cols.includes(column)).map(([t]) => t);
  return homes.length ? `${message}. Hint: '${column}' is a column of ${homes.join(" and ")}; join that table and use its alias.`
    : `${message}. Hint: there is no column called '${column}'. Use only the columns listed in the schema.`;
}

export function businessCheck(sql: string): string | null {
  const s = sql.toLowerCase();
  if (s.includes("unit_price_inr") && s.includes("sum(") && !s.includes("status"))
    return "this looks like revenue but it doesn't filter orders by status. Revenue only counts orders with status IN ('delivered', 'shipped'): join orders and add that filter. If this is not revenue, return the same query.";
  return null;
}

// ---------- result -> words and chart (same rules as Python) ----------
const isNum = (v: Cell) => typeof v === "number";
export const numericColumns = (t: Table) => t.columns.filter((_, i) => t.rows.every((r) => r[i] === null || isNum(r[i])) && t.rows.some((r) => isNum(r[i])));
export const looksLikeTime = (vals: Cell[]) => vals.every((v) => /^\d{4}(-\d{2})?(-\d{2})?$/.test(String(v)));

export function label(col: string) {
  const s = col.replace(/_inr/g, "").replace(/_pct/g, " %").replace(/_/g, " ").trim();
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/\bq([1-4])\b/g, "Q$1").replace(/\by(20\d\d)\b/g, "$1")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/g, (m) => m[0].toUpperCase() + m.slice(1));
}

export function fmt(v: Cell, col = ""): string {
  if (v === null || v === undefined) return "none";
  if (typeof v !== "number") return String(v);
  const c = col.toLowerCase();
  const text = Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (/inr|revenue|spend|value|aov|sales/.test(c)) return "₹" + text;
  if (/pct|rate|percent|share/.test(c)) return text + "%";
  return text;
}

export function summarise(t: Table): string {
  if (!t.rows.length) return "The query returned no rows.";
  if (t.rows.length === 1) return t.columns.map((c, i) => `${label(c)}: ${fmt(t.rows[0][i], c)}`).join(" · ");
  const nums = numericColumns(t);
  const names = t.columns.filter((c) => !nums.includes(c));
  if (names.length && nums.length) {
    const xi = t.columns.indexOf(names[0]), y = nums[nums.length - 1], yi = t.columns.indexOf(y);
    if (looksLikeTime(t.rows.map((r) => r[xi]))) {
      const a = t.rows[0], b = t.rows[t.rows.length - 1];
      return `${label(y)} went from ${fmt(a[yi], y)} in ${a[xi]} to ${fmt(b[yi], y)} in ${b[xi]} (${t.rows.length} rows).`;
    }
    const top = t.rows.reduce((best, r) => ((r[yi] as number) > (best[yi] as number) ? r : best));
    return `Highest ${label(y).toLowerCase()}: ${top[xi]} (${fmt(top[yi], y)}). ${t.rows.length} rows.`;
  }
  return `${t.rows.length} rows.`;
}

export function pickChart(t: Table): Chart {
  if (t.rows.length < 2 || t.rows.length > 60) return null;
  const nums = numericColumns(t);
  const names = t.columns.filter((c) => !nums.includes(c));
  if (!nums.length || !names.length) return null;
  const xi = t.columns.indexOf(names[0]);
  return { type: looksLikeTime(t.rows.map((r) => r[xi])) ? "line" : "bar", x: names[0], y: nums[nums.length - 1] };
}
