// The home page FAQ: questions people search about text-to-SQL agents,
// answered with this project's real test results (public/data/eval.json and tables.json).
import report from "@/public/data/eval.json";
import tables from "@/public/data/tables.json";
import type { Report } from "@/lib/types";
import type { FaqItem } from "@/components/Faq";
import { dateText } from "@/lib/seo";

const rows = (t: keyof typeof tables) => tables[t].rows.toLocaleString("en-IN");

export function agentFaq(): FaqItem[] {
  const s = (report as unknown as Report).summary;
  const level = (l: string) => (s ? `${s.by_level[l].right} of ${s.by_level[l].questions}` : "");

  const items: FaqItem[] = [
    {
      q: "What is a text-to-SQL agent?",
      a: "Text-to-SQL turns a question in plain English into a database query. An agent goes one step further: it runs the query, reads the result or the error, and fixes its own query before answering. This one also asks you back when a question is too vague to answer safely.",
    },
    {
      q: "How do you stop an AI from changing or deleting data?",
      a: "Two independent locks. Before anything runs, the SQL is parsed with sqlglot: it must be one SELECT statement on real tables, and a row limit is always added. Then the database itself is opened read-only, with SQLite's query_only switch and an authorizer that allows reading only, plus a 5-second time limit. Even a DELETE that slipped past the first check would be refused.",
    },
    {
      q: "How does the agent fix its own SQL errors?",
      a: "If a query fails or returns nothing, the exact error message (for example 'no such column: o.status') goes back to the AI with the instruction to fix it, up to 2 times. The answer's numbers are taken straight from the query result, so they can't be made up.",
    },
    {
      q: "What does execution accuracy mean?",
      a: "Execution accuracy checks whether the agent's query returns the same result table as a known-correct query. It is stricter than checking that the SQL runs, and fairer than comparing SQL text, because two different queries can give the same right answer.",
    },
    {
      q: "What data does the agent query?",
      a: `A generated sample database for an Indian online shop, made with a fixed random seed so the test answers never change: ${rows("customers")} customers, ${rows("products")} products, ${rows("orders")} orders and ${rows("order_items")} order lines from January 2025 to September 2026. It is not a real company's data.`,
    },
    {
      q: "Can I see the SQL behind each answer?",
      a: "Yes. Every answer shows the exact SQL that produced it, and if the agent fixed an error you can see the failed attempt and the error message too.",
    },
  ];

  if (s) {
    items.splice(1, 0, {
      q: "How accurate is this text-to-SQL agent?",
      a: `${Math.round(s.execution_accuracy_pct)}% execution accuracy on ${s.questions} test questions (run ${dateText(s.run_date)}): ${level("easy")} easy, ${level("medium")} medium and ${level("hard")} hard questions right. ${Math.round(s.first_try_pct)}% were right on the first try and ${s.fixed_by_retry} more were saved by self-correction. Every miss is shown on the Test results page.`,
    });
    items.splice(5, 0, {
      q: "What happens when a question is too vague?",
      a: `The agent should ask a clarifying question instead of guessing. In the latest test it asked back on ${s.vague_asked_back} deliberately vague questions, such as "show me the best products".`,
    });
  }
  return items;
}
