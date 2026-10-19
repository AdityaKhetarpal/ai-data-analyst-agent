// Turn the saved test run (eval.json) into answers the Ask page can show without any AI key
import type { AgentResult, Report, TestRecord } from "./types";

export function fromRecord(rec: TestRecord, engine?: string): AgentResult {
  return {
    type: rec.type, question: rec.question, sql: rec.sql ?? undefined, table: rec.table ?? undefined,
    answer: rec.answer ?? undefined, clarify: rec.type === "clarify" ? rec.answer ?? "" : undefined,
    chart: rec.chart, attempts: rec.attempts, source: "test run", engine,
  };
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

/** Find the tested question closest to what the visitor typed (or null if nothing is close). */
export function closest(report: Report, typed: string): TestRecord | null {
  const t = words(typed);
  let best: TestRecord | null = null, score = 0;
  for (const rec of report.records) {
    const q = words(rec.question);
    const overlap = [...t].filter((w) => q.has(w)).length / Math.max(t.size, q.size, 1);
    if (overlap > score) { score = overlap; best = rec; }
  }
  return score >= 0.6 ? best : null;
}
