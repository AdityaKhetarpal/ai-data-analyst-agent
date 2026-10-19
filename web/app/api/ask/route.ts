// POST /api/ask -> answers a question live. Keys (if any) stay on the server; the browser never sees them.
//   1. the query planner answers common questions (metric + breakdown + filters + period) directly, using the business definitions
//   2. anything else goes to the AI agent (write SQL -> check -> run -> fix up to 2 times), if an AI is configured
//   3. vague questions get a clarifying question back
import { ask } from "@/lib/agent";
import { checkSql } from "@/lib/check";
import { openShop, runOn } from "@/lib/db";
import { plan } from "@/lib/planner";
import { pickChart, summarise } from "@/lib/agent";
import { serverWriter } from "@/lib/writers";
import prompt from "@/public/data/prompt.json";
import type { AgentResult, PromptFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMIT = 20;                      // AI questions per visitor...
const WINDOW_MS = 10 * 60 * 1000;      // ...per 10 minutes (planner answers are not limited)
const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  hits.set(ip, [...recent, now]);
  return true;
}

const HELP = "I couldn't work that one out. Try naming a measure (revenue, orders, units, customers, average order value, return or cancellation rate), " +
  "a breakdown (by category, city, state, brand, product, payment method, segment or month) and a period (last month, Q2 2026, 2025).";

export async function GET() {
  return Response.json({ live: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 400) return Response.json({ error: "Ask a question between 3 and 400 characters." }, { status: 400 });

  const db = await openShop();
  const run = runOn(db);
  const p = plan(question);

  if (p.kind === "sql") {
    try {
      const table = run(checkSql(p.sql, (prompt as PromptFile).row_limit));
      const result: AgentResult = { type: "answer", question, sql: p.sql, table, answer: summarise(table), chart: pickChart(table), attempts: [{ sql: p.sql, error: null }], source: "live" };
      return Response.json(result);
    } catch (err) {
      console.error("[ask] planner query failed:", err);   // fall through to the AI agent
    }
  }
  if (p.kind === "clarify") return Response.json({ type: "clarify", question, clarify: p.question, attempts: [], source: "live" } satisfies AgentResult);

  const write = serverWriter();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!write) return Response.json({ type: "clarify", question, clarify: HELP, attempts: [], source: "live" } satisfies AgentResult);
  if (!allowed(ip)) return Response.json({ error: "Too many questions. Try again in a few minutes." }, { status: 429 });
  try {
    return Response.json({ ...(await ask(question, write, run, prompt as PromptFile)), source: "live" });
  } catch (err) {
    console.error("[ask] AI failed:", err);
    return Response.json({ type: "clarify", question, clarify: HELP, attempts: [], source: "live" } satisfies AgentResult);
  }
}
