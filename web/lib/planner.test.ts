import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plan } from "./planner";
import { checkSql } from "./check";
import { openShop, runOn } from "./db";
import { sameResult } from "./compare";
import { businessCheck, explainError } from "./agent";
import { POST } from "@/app/api/ask/route";

describe("query planner", () => {
  it("never gives a wrong answer to the 40 known questions", async () => {
    const run = runOn(await openShop());
    const { questions } = JSON.parse(readFileSync("../data/test_questions.json", "utf8"));
    const wrong: string[] = [];
    for (const q of questions) {
      const p = plan(q.question);
      if (p.kind === "sql" && !sameResult(run(checkSql(q.sql)), run(checkSql(p.sql)))) wrong.push(q.question);
    }
    expect(wrong).toEqual([]);
  });
  it.each(["Show me the best products", "How are we doing?", "What is the growth?", "Give me the sales numbers", "Revenue for December 2026"])(
    "asks back on a vague question: %s", (q) => expect(plan(q).kind).toBe("clarify"));
  it.each(["How much did Arjun Das spend?", "Which day of the week has the most orders?", "What is the revenue per customer?"])(
    "hands harder questions to the AI: %s", (q) => expect(plan(q).kind).toBe("pass"));
  it("reads periods, filters and rankings", async () => {
    const run = runOn(await openShop());
    const t = (q: string) => { const p = plan(q); if (p.kind !== "sql") throw new Error(q); return run(checkSql(p.sql)); };
    expect(t("Revenue by category last month").rows).toHaveLength(7);
    expect(t("Top 3 cities by revenue in Q2 2026").rows).toHaveLength(3);
    expect(t("Which brand sold the most units last month?").rows).toHaveLength(1);
    expect(t("How many products does Nova have?").rows[0][0]).toBeGreaterThan(0);   // "Nova" is a brand, not November
    expect(t("Revenue growth Q1 2026 vs Q1 2025").columns).toContain("growth_pct");
  });
});

describe("self-correction help", () => {
  it("says which table has a missing column", () => expect(explainError("no such column: o.segment")).toContain("column of customers"));
  it("flags revenue without a status filter", () => {
    expect(businessCheck("SELECT SUM(quantity * unit_price_inr) FROM order_items")).toMatch(/status/);
    expect(businessCheck("SELECT SUM(oi.quantity * oi.unit_price_inr) FROM order_items oi JOIN orders o USING (order_id) WHERE o.status = 'delivered'")).toBeNull();
  });
});

describe("live API", () => {
  const ask = async (question: string) => (await POST(new Request("http://x/api/ask", { method: "POST", body: JSON.stringify({ question }) }))).json();
  it("answers with SQL, a table and a chart", async () => {
    const r = await ask("Show the monthly revenue trend for 2026");
    expect(r.type).toBe("answer");
    expect(r.sql).toMatch(/status IN \('delivered', 'shipped'\)/);
    expect(r.table.rows).toHaveLength(9);
    expect(r.chart.type).toBe("line");
  });
  it("asks back instead of guessing", async () => expect((await ask("Show me the best products")).type).toBe("clarify"));
});
