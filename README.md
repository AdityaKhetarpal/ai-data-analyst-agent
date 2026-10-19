# AI Data Analyst Agent

Ask a business question in plain English. The agent writes the SQL, checks that it's safe, runs it on a **read-only** database, **fixes its own errors**, and answers with a short sentence, a table and a chart. The SQL is always shown. If a question is too vague, it asks you back instead of guessing.

**Live site:** _add your Vercel link here_ · **Test results:** see the *Test results* page or [`data/test_report.json`](data/test_report.json)

**Latest test (free open-source Qwen2.5-Coder-3B on GitHub's CPU, no paid AI):** **80% execution accuracy on 40 business questions** (easy 9/10, medium 22/23, hard 1/7). 100% of queries ran without error, 2 answers were saved by self-correction, and it asked back on 2 of 5 vague questions. Every miss is listed on the results page.

## What it shows

| Skill | Where |
|---|---|
| SQL on a realistic, multi-table business database | `agent/step1_make_database.py`, `data/test_questions.json` |
| Safe AI use: read-only access + SQL validation | `agent/step2_read_only.py`, `agent/step5_check_sql.py` |
| Prompting: schema grounding, business glossary, few-shot examples | `agent/step3_schema.py`, `agent/step4_prompt.py` |
| An AI agent loop with self-correction (max 2 retries) and clarifying questions | `agent/step7_agent.py` |
| Measuring an AI system: execution accuracy on 40 questions | `agent/step8_test.py`, `.github/workflows/evaluate.yml` |
| A product: live Ask page, SQL playground in the browser, results dashboard | `web/` (Next.js) |

## The data

A generated Indian online shop (fixed random seed, so it's identical every time): 1,500 customers in 15 cities, 70 products in 7 categories, 12,000 orders from Jan 2025 to Sep 2026 with growth, Diwali peaks, cancellations and returns. It is sample data, not a real company.

## The 8 steps (one file each in `agent/`)

1. **Make the database**: SQLite file `data/shop.db`.
2. **Connect read-only**: read-only file mode + `PRAGMA query_only` + an authorizer that allows only reading + a 5-second limit.
3. **Describe the database**: tables, columns, example values, and a glossary ("revenue" = delivered/shipped orders, after discount).
4. **Write the prompt**: rules + description + 5 worked examples (one shows asking back).
5. **Check the SQL** with `sqlglot`: one statement, SELECT only, known tables, row limit of 200.
6. **The AI**: Claude if `ANTHROPIC_API_KEY` is set, otherwise the free open-source **Qwen2.5-Coder-1.5B** (runs on a normal CPU, no key).
7. **The agent loop**: write → check → run → if it fails or finds nothing, show the AI the error and retry (up to 2 times) → answer + chart.
8. **The test**: 40 questions with known-correct SQL (10 easy, 23 medium, 7 hard) + 5 vague ones. Results are compared, not SQL text (lenient: extra columns, names, order and rounding don't count).

## Run it

```bash
pip install -r requirements.txt            # plus: pip install torch  (for the free model)
python agent/build_all.py                  # make the database + website files
python agent/step7_agent.py "What was revenue by category last month?"
python agent/build_all.py --test           # the 40-question test
pytest -q                                  # unit tests (fake AI, free, ~1 second)

cd web && npm install && npm run dev       # the website on http://localhost:3000
```

The **Evaluate** GitHub Action runs the 40-question test every Monday with the free model and publishes the results to the website. Run it by hand from the Actions tab and choose `claude` to use Claude instead (needs the repository secret `ANTHROPIC_API_KEY`).

## The website answers live, with no paid AI

1. **Query planner** (`web/lib/planner.ts`): most business questions are a measure + breakdown + filters + period
   ("revenue by city in Q2 2026", "top 5 products by units last month", "Q3 2026 vs Q3 2025 revenue growth").
   The planner reads those and writes the SQL straight from the same business definitions the AI gets. It's instant,
   free and consistent, and a test checks that it never gives a wrong answer to the 40 known questions.
   Vague questions get a clarifying question back.
2. **AI agent** for everything else, the same loop as step 7 (write → check → run → fix ≤2 times), using whichever AI is configured:
   - `LLM_API_KEY` for any OpenAI-compatible API. The default is Groq's free tier (`llama-3.3-70b-versatile`). For Google Gemini's free tier, set
     `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai` and `LLM_MODEL=gemini-2.5-flash`.
   - or `ANTHROPIC_API_KEY` for Claude.

## Deploy (Vercel)

Import the repo, set **Root Directory** to `web`, deploy. To let the AI handle questions the planner can't, add a free key as the
environment variable `LLM_API_KEY` (e.g. from console.groq.com, no card needed), then redeploy. The same key can go into the GitHub
secret `LLM_API_KEY` to run the 40-question test with it (Actions → Evaluate → engine `api`).

Keys live only in Vercel / GitHub secrets, never in the code.
