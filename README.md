# AI Data Analyst Agent

Ask a business question in plain English. The agent writes the SQL, checks that it's safe, runs it on a **read-only** database, **fixes its own errors**, and answers with a short sentence, a table and a chart. The SQL is always shown. If a question is too vague, it asks you back instead of guessing.

**Live site:** _add your Vercel link here_ · **Test results:** see the *Test results* page or [`data/test_report.json`](data/test_report.json)

**Latest test (free Qwen2.5-Coder-1.5B, no paid AI):** 57.5% execution accuracy on 40 business questions (easy 9/10, medium 13/23, hard 1/7). 90% of queries ran without error, 1 answer was saved by self-correction, and it asked back on 2 of 5 vague questions. Every miss is listed on the results page.

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

## Deploy (Vercel)

Import the repo, set **Root Directory** to `web`, deploy. Optional: add `ANTHROPIC_API_KEY` as an environment variable to turn on live answers (8 questions per visitor per 10 minutes). Without it, the site shows the agent's real test runs and the SQL playground still works.

Keys live only in Vercel / GitHub secrets, never in the code.
