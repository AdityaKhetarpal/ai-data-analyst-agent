// /llms.txt: a short plain-text summary for AI tools, built from the same data as the website.
// It's an experiment (no search engine has said it uses llms.txt), but it costs nothing.
import report from "@/public/data/eval.json";
import type { Report } from "@/lib/types";
import { SITE_URL, REPO_URL, HUB_URL, AUTHOR, dateText } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const s = (report as unknown as Report).summary;
  const results = s
    ? `\nTest results (run ${dateText(s.run_date)}): ${Math.round(s.execution_accuracy_pct)}% execution accuracy on ${s.questions} questions (easy ${s.by_level.easy.right}/${s.by_level.easy.questions}, medium ${s.by_level.medium.right}/${s.by_level.medium.questions}, hard ${s.by_level.hard.right}/${s.by_level.hard.questions}); ${Math.round(s.first_try_pct)}% right on the first try; ${s.fixed_by_retry} fixed by self-correction; asked back on ${s.vague_asked_back} vague questions.\n`
    : "";

  const text = `# AI Data Analyst Agent: a read-only, self-correcting text-to-SQL agent

> Ask business questions in plain English about an Indian online shop's database. The agent writes the SQL, checks it is a single safe SELECT (sqlglot), runs it on a read-only SQLite copy, fixes its own errors up to 2 times, asks back when a question is vague, and shows the exact SQL with every answer. Built by ${AUTHOR.name} (${HUB_URL}). The shop's data is generated sample data.
${results}
## Pages
- [Ask a question](${SITE_URL}/)
- [How it works](${SITE_URL}/how-it-works): schema grounding, few-shot examples, SQL checks, read-only locks, the fix-and-retry loop, the test
- [Test results](${SITE_URL}/results): all 40 test questions with the agent's SQL and the correct answer
- [SQL playground](${SITE_URL}/playground): write your own SQL against the same database
- [Source code](${REPO_URL})
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
