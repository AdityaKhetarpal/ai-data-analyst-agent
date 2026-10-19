// Shapes of the data passed around the site (mirrors the Python agent's output)
export type Cell = string | number | null;
export type Table = { columns: string[]; rows: Cell[][]; total_rows?: number };
export type Chart = { type: "line" | "bar"; x: string; y: string } | null;
export type Attempt = { sql: string; error: string | null };

export type AgentResult = {
  type: "answer" | "clarify" | "failed";
  question: string;
  sql?: string;
  table?: Table;
  answer?: string;
  clarify?: string;
  chart?: Chart;
  attempts: Attempt[];
  source?: "live" | "test run";
  engine?: string;
};

export type TestRecord = {
  id: string; level: "easy" | "medium" | "hard"; question: string; correct: boolean;
  type: AgentResult["type"]; tries: number; fixed: boolean; sql: string | null; attempts: Attempt[];
  answer: string | null; chart: Chart; table: Table | null; expected_sql: string; expected: Table | null; seconds: number;
};
export type VagueRecord = { id: string; question: string; asked_back: boolean; reply: string | null };
export type Summary = {
  engine: string; questions: number; execution_accuracy_pct: number; first_try_pct: number; fixed_by_retry: number;
  ran_without_error_pct: number; by_level: Record<string, { questions: number; right: number }>;
  vague_asked_back: string; run_date: string;
};
export type Report = { summary: Summary | null; records: TestRecord[]; vague: VagueRecord[] };
export type Message = { role: "user" | "assistant"; content: string };
export type PromptFile = { system: string; examples: Message[]; row_limit: number; max_fixes: number };
