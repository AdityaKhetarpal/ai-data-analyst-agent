// The AI that writes SQL on the server (website version of agent/step6_ai.py). Keys come only from environment variables.
//   LLM_API_KEY (+ optional LLM_BASE_URL, LLM_MODEL): any OpenAI-compatible API, e.g. a free tier
//   ANTHROPIC_API_KEY: Claude
import Anthropic from "@anthropic-ai/sdk";
import type { Writer } from "./agent";

const DEFAULT_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const CLAUDE_MODEL = "claude-haiku-5-5";

function openAICompatible(key: string): Writer {
  const base = (process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;
  return async (system, messages) => {
    for (const wait of [0, 2000, 6000]) {               // free tiers have per-minute limits: wait briefly and retry
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 700, messages: [{ role: "system", content: system }, ...messages] }),
      });
      if (res.status === 429) continue;
      if (!res.ok) throw new Error(`AI service error ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    throw new Error("AI service busy");
  };
}

function claude(): Writer {
  const client = new Anthropic();
  return async (system, messages) => {
    const r = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 700, temperature: 0, system, messages });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  };
}

/** The configured AI, or null if none is set up (then only the query planner answers). */
export function serverWriter(): Writer | null {
  if (process.env.LLM_API_KEY) return openAICompatible(process.env.LLM_API_KEY);
  if (process.env.ANTHROPIC_API_KEY) return claude();
  return null;
}
