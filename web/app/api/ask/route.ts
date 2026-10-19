// POST /api/ask -> the agent answers a question live (only if ANTHROPIC_API_KEY is set in Vercel).
// GET  /api/ask -> whether live mode is on. The key stays on the server; the browser never sees it.
import Anthropic from "@anthropic-ai/sdk";
import { ask, type Writer } from "@/lib/agent";
import { openShop, runOn } from "@/lib/db";
import prompt from "@/public/data/prompt.json";
import type { Message, PromptFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const MODEL = "claude-haiku-5-5";

const LIMIT = 8;                       // questions per visitor...
const WINDOW_MS = 10 * 60 * 1000;      // ...per 10 minutes; the provider's monthly spend cap is the hard stop
const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  hits.set(ip, [...recent, now]);
  return true;
}

export async function GET() {
  return Response.json({ live: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 400) return Response.json({ error: "Ask a question between 3 and 400 characters." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Live mode is off on this deployment." }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) return Response.json({ error: "Too many questions. Try again in a few minutes." }, { status: 429 });

  const client = new Anthropic();
  const write: Writer = async (system: string, messages: Message[]) => {
    const r = await client.messages.create({ model: MODEL, max_tokens: 700, temperature: 0, system, messages });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  };
  try {
    const db = await openShop();
    const result = await ask(question, write, runOn(db), prompt as PromptFile);
    return Response.json({ ...result, source: "live", engine: `Claude (${MODEL})` });
  } catch (err) {
    console.error("[ask] failed:", err);
    return Response.json({ error: "The AI is unavailable right now. Try a tested question below." }, { status: 502 });
  }
}
