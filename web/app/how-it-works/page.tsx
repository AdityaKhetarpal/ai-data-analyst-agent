// How it works: the 8 steps of the agent, each with real output from this project
import type { Metadata } from "next";
import ResultCard from "@/components/ResultCard";
import { Highlight } from "@/components/SqlPane";
import { fromRecord } from "@/lib/gallery";
import prompt from "@/public/data/prompt.json";
import tables from "@/public/data/tables.json";
import report from "@/public/data/eval.json";
import type { PromptFile, Report } from "@/lib/types";

export const metadata: Metadata = { title: "How it works · AI Data Analyst Agent" };
const CODE = "https://github.com/AdityaKhetarpal/ai-data-analyst-agent/blob/main/agent/";

function Step({ n, title, file, children }: { n: number; title: string; file: string; children: React.ReactNode }) {
  return (
    <li className="walk-step">
      <div className="walk-n" aria-hidden="true">{n}</div>
      <div className="walk-body">
        <h3>{title}</h3>
        {children}
        <p className="walk-file">Code: <a href={CODE + file} target="_blank" rel="noreferrer">agent/{file}</a></p>
      </div>
    </li>
  );
}

export default function HowPage() {
  const p = prompt as PromptFile;
  const r = report as unknown as Report;
  const fixed = r.records.find((q) => q.fixed) ?? r.records.find((q) => q.correct && q.chart);
  const schemaLines = p.system.split("\n");
  const start = schemaLines.findIndex((l) => l.startsWith("TABLE orders"));
  const glossary = schemaLines.filter((l) => l.startsWith("- ") && /Revenue|Return rate|Today/.test(l));

  return (
    <>
      <section className="hero hero-small"><div className="wrap">
        <p className="eyebrow-chip">how it works</p>
        <h1>From a plain-English question to a checked SQL answer.</h1>
        <p className="lead">
          This is <strong>text-to-SQL</strong>: an AI turns a business question into a database query. On its own that is risky
          (it can invent columns or write a DELETE), so the agent wraps the AI in checks and lets it <strong>see its errors and try again</strong>.
          No model is trained here; the AI is used as it comes, and all the work is in the steps around it.
        </p>
      </div></section>

      <div className="wrap">
        <ol className="walk">
          <Step n={1} title="Make a realistic sample database" file="step1_make_database.py">
            <p>Code generates an Indian online shop with a fixed random seed, so it&apos;s identical every time and the test answers never change: growth over time, Diwali peaks, cancellations, returns, UPI as the top payment method.</p>
            <p className="walk-data">{Object.entries(tables).map(([t, v]) => `${t}: ${v.rows.toLocaleString("en-IN")} rows`).join(" · ")}</p>
          </Step>

          <Step n={2} title="Open it read-only" file="step2_read_only.py">
            <p>Three locks: the file opens in read-only mode, SQLite&apos;s <code>query_only</code> switch is on, and an &ldquo;authorizer&rdquo; lets SQLite do nothing except read. Even if the AI wrote <code>DELETE FROM orders</code> and it slipped past step 5, the database would answer <em>not authorized</em>. There&apos;s also a 5-second time limit.</p>
          </Step>

          <Step n={3} title="Describe the database to the AI (schema grounding)" file="step3_schema.py">
            <p>The AI has never seen this database, so it gets every table and column with real example values. A glossary pins down business terms, so &ldquo;revenue&rdquo; means what finance would report:</p>
            <div className="sql-pane" style={{ marginTop: 10 }}><pre className="sql-code">{schemaLines.slice(start, start + 7).join("\n")}{"\n…\n"}{glossary.join("\n")}</pre></div>
          </Step>

          <Step n={4} title="Show it worked examples (few-shot prompting)" file="step4_prompt.py">
            <p>{p.examples.length / 2} solved examples teach the conventions better than rules alone. One shows the right move for a vague question: ask back. None of them are test questions.</p>
            <p className="walk-data" style={{ marginTop: 10 }}>{p.examples[2].content}</p>
            <div className="sql-pane" style={{ marginTop: 6 }}><Highlight sql={p.examples[3].content.replace(/```sql\n?|```/g, "").trim()} /></div>
          </Step>

          <Step n={5} title="Check the SQL before it runs (sqlglot)" file="step5_check_sql.py">
            <p>The SQL is parsed into a tree. It must be one statement, a SELECT, use only real tables, and it always gets a row limit ({p.row_limit}). A clear error message here is what lets step 7 work.</p>
            <ul className="list"><li><code>DELETE FROM orders</code> → only SELECT queries are allowed</li><li><code>SELECT * FROM sales</code> → unknown table &apos;sales&apos;. The tables are: customers, order_items, orders, products</li><li><code>SELECT 1; DROP TABLE orders</code> → write exactly one statement</li></ul>
          </Step>

          <Step n={6} title="The AI that writes the SQL" file="step6_ai.py">
            <p>Two options, same code around them: <strong>Claude</strong> when an API key is set, or a <strong>free open-source coding model</strong> (Qwen2.5-Coder, 1.5 billion parameters) that runs on an ordinary computer. The weekly test on GitHub uses the free one, so the score costs nothing.</p>
          </Step>

          <Step n={7} title="The agent loop: run, read the error, fix, answer" file="step7_agent.py">
            <p>If the query fails (or finds nothing), the exact error goes back to the AI with &ldquo;fix it&rdquo;, up to {p.max_fixes} times. When it works, code turns the result into a one-line answer and picks a chart (line for time, bars for comparisons). The numbers in the answer come straight from the result, so they can&apos;t be made up.</p>
            {fixed && <div style={{ marginTop: 12 }}><ResultCard r={fromRecord(fixed, r.summary?.engine)} verdict={fixed.correct} /></div>}
          </Step>

          <Step n={8} title="Test it: execution accuracy on 40 questions" file="step8_test.py">
            <p>40 questions (10 easy, 23 medium, 7 hard) with a known-correct query, plus 5 vague ones. The agent&apos;s results are compared with the right results.</p>
            {r.summary && <p className="walk-data">Latest: {r.summary.execution_accuracy_pct}% right, {r.summary.fixed_by_retry} saved by self-correction, vague questions asked back {r.summary.vague_asked_back}. <a href="/results">See all 40 →</a></p>}
          </Step>
        </ol>

        <section className="section grid-2">
          <div className="panel">
            <h3>Words you&apos;ll hear</h3>
            <ul className="list">
              <li><strong>Text-to-SQL</strong>: turning a question in plain English into a database query.</li>
              <li><strong>Schema grounding</strong>: giving the AI the real table and column names (step 3).</li>
              <li><strong>Few-shot prompting</strong>: showing a few solved examples in the prompt (step 4).</li>
              <li><strong>Agent</strong>: an AI in a loop that acts, sees the result and decides what to do next (step 7).</li>
              <li><strong>Execution accuracy</strong>: does the query give the right <em>result</em> (step 8).</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Limits</h3>
            <ul className="list">
              <li>The data is generated sample data, not a real company.</li>
              <li>The test checks the result table, not whether the one-line wording is perfect.</li>
              <li>A small free model makes more mistakes than Claude; mistakes are shown on the results page.</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
