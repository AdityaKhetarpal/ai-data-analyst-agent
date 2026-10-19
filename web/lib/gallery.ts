// Turn the saved test run (eval.json) into answers the Ask page can show without any AI key
import type { AgentResult, TestRecord } from "./types";

export function fromRecord(rec: TestRecord, engine?: string): AgentResult {
  return {
    type: rec.type, question: rec.question, sql: rec.sql ?? undefined, table: rec.table ?? undefined,
    answer: rec.answer ?? undefined, clarify: rec.type === "clarify" ? rec.answer ?? "" : undefined,
    chart: rec.chart, attempts: rec.attempts, source: "test run", engine,
  };
}
