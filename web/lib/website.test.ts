import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkSql } from "./check";
import { ask, pickChart, readReply, summarise, type Writer } from "./agent";
import { openShop, runOn } from "./db";
import prompt from "@/public/data/prompt.json";
import type { PromptFile } from "./types";

const P = prompt as PromptFile;
const fake = (replies: string[]): Writer => { let i = 0; return async () => replies[Math.min(i++, replies.length - 1)]; };

describe("step 5: SQL check", () => {
  it.each(["DELETE FROM orders", "SELECT 1; DROP TABLE orders", "SELECT * FROM sales", "PRAGMA table_info(orders)",
    "WITH x AS (SELECT 1) DELETE FROM orders", "ATTACH 'a.db' AS a", ""])("blocks %s", (sql) => {
    expect(() => checkSql(sql)).toThrow();
  });
  it("ignores keywords inside text and adds a row limit", () => {
    expect(checkSql("SELECT 'drop; delete' AS x FROM orders")).toMatch(/LIMIT 200$/);
  });
  it("lets every correct test query through, and they run", async () => {
    const run = runOn(await openShop());
    const { questions } = JSON.parse(readFileSync("../data/test_questions.json", "utf8"));
    expect(questions).toHaveLength(40);
    for (const q of questions) expect(run(checkSql(q.sql)).rows.length).toBeGreaterThan(0);
  });
});

describe("step 2: read-only", () => {
  it("cannot change the database even without the check", async () => {
    const db = await openShop();
    expect(() => db.exec("DELETE FROM orders")).toThrow();
    expect(runOn(db)("SELECT COUNT(*) AS n FROM orders").rows[0][0]).toBe(12000);
  });
});

describe("step 7: agent loop", () => {
  it("fixes its own mistake", async () => {
    const r = await ask("How many customers?", fake(["```sql\nSELECT x FROM sales\n```", "```sql\nSELECT COUNT(*) AS customers FROM customers\n```"]), runOn(await openShop()), P);
    expect(r.type).toBe("answer");
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0].error).toMatch(/unknown table/);
    expect(r.table?.rows[0][0]).toBe(1500);
  });
  it("gives up after 2 fixes", async () => {
    const r = await ask("?", fake(["```sql\nSELECT nope FROM orders\n```"]), runOn(await openShop()), P);
    expect(r.type).toBe("failed");
    expect(r.attempts).toHaveLength(3);
  });
  it("asks back when vague", async () => {
    const r = await ask("best products", fake(["CLARIFY: By revenue or units?"]), runOn(await openShop()), P);
    expect(r).toMatchObject({ type: "clarify", clarify: "By revenue or units?" });
  });
  it("reads replies", () => {
    expect(readReply("```sql\nSELECT 1\n```")).toEqual({ kind: "sql", content: "SELECT 1" });
  });
  it("summarises and picks a chart", () => {
    const trend = { columns: ["month", "revenue_inr"], rows: [["2026-01", 10], ["2026-02", 12.5]] };
    expect(pickChart(trend)).toEqual({ type: "line", x: "month", y: "revenue_inr" });
    expect(summarise(trend)).toContain("₹10");
    expect(pickChart({ columns: ["n"], rows: [[3]] })).toBeNull();
  });
});
