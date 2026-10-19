"""
STEP 8 - TEST: EXECUTION ACCURACY ON 40 QUESTIONS
-------------------------------------------------
What:  40 business questions where we know the correct SQL. For each one the agent writes its own SQL,
       we RUN both, and compare the RESULTS (not the SQL text: there are many correct ways to write a query).
       This is called execution accuracy. Plus 5 vague questions where the right move is to ask back.
Why:   A number you can trust and put on a CV, and a way to see if a change made the agent better or worse.
How results are compared (lenient, like a human checker):
       - same number of rows
       - every column of the correct answer appears somewhere in the agent's answer (extra columns are fine,
         column names and row order don't matter, numbers may differ by rounding)
"""
import argparse
import json
import math
import time

import pandas as pd

import settings
import step2_read_only
import step5_check_sql
import step6_ai
import step7_agent


def _values(column):
    out = []
    for v in column.tolist():
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out.append((0, ""))
        elif isinstance(v, (int, float)):
            out.append((1, float(v)))
        else:
            out.append((2, str(v).strip().lower()))
    return sorted(out)


def _close(a, b):
    if a[0] != b[0]:
        return False
    if a[0] == 1:
        return math.isclose(a[1], b[1], rel_tol=1e-3, abs_tol=0.05)
    return a[1] == b[1]


def same_result(correct, mine):
    """True if the agent's table contains the correct answer (see the rules at the top)."""
    if mine is None or len(correct) != len(mine):
        return False
    mine_columns = [_values(mine.iloc[:, i]) for i in range(mine.shape[1])]
    for i in range(correct.shape[1]):
        want = _values(correct.iloc[:, i])
        if not any(len(want) == len(got) and all(_close(a, b) for a, b in zip(want, got)) for got in mine_columns):
            return False
    return True


def preview(table, rows=12):
    if table is None:
        return None
    small = table.head(rows).astype(object).where(pd.notna(table.head(rows)), None)
    return {"columns": list(table.columns), "rows": small.values.tolist(), "total_rows": len(table)}


def run_tests(write=None, limit=None):
    write = write or step6_ai.pick_writer()
    con = step2_read_only.connect()
    data = json.loads(settings.QUESTIONS.read_text())
    questions = data["questions"][:limit] if limit else data["questions"]
    records = []
    for q in questions:
        start = time.time()
        correct = step2_read_only.run_query(step5_check_sql.check_sql(q["sql"]), con)
        result = step7_agent.ask(q["question"], write, con)
        mine = result.get("table")
        ok = result["type"] == "answer" and same_result(correct, mine)
        records.append({
            "id": q["id"], "level": q["level"], "question": q["question"], "correct": ok, "type": result["type"],
            "tries": len(result["attempts"]), "fixed": ok and len(result["attempts"]) > 1,
            "sql": result.get("sql"), "attempts": result["attempts"], "answer": result.get("answer") or result.get("clarify"),
            "chart": result.get("chart"), "table": preview(mine), "expected_sql": q["sql"], "expected": preview(correct, 5),
            "seconds": round(time.time() - start, 1)})
        print(f"{q['id']} {'RIGHT' if ok else 'wrong'} ({len(result['attempts'])} tries) {q['question']}", flush=True)

    vague = []
    for v in (data["vague"] if not limit else data["vague"][:1]):
        result = step7_agent.ask(v["question"], write, con)
        vague.append({"id": v["id"], "question": v["question"], "asked_back": result["type"] == "clarify",
                      "reply": result.get("clarify") or result.get("sql") or result.get("answer")})
        print(f"{v['id']} {'asked back' if vague[-1]['asked_back'] else 'did not ask'}: {v['question']}", flush=True)

    n = len(records)
    pct = lambda k: round(100 * k / n, 1) if n else 0.0
    summary = {
        "engine": getattr(write, "name", "unknown"), "questions": n,
        "execution_accuracy_pct": pct(sum(r["correct"] for r in records)),
        "first_try_pct": pct(sum(r["correct"] and r["tries"] == 1 for r in records)),
        "fixed_by_retry": sum(r["fixed"] for r in records),
        "ran_without_error_pct": pct(sum(r["type"] == "answer" for r in records)),
        "by_level": {lvl: {"questions": sum(r["level"] == lvl for r in records),
                           "right": sum(r["level"] == lvl and r["correct"] for r in records)} for lvl in ["easy", "medium", "hard"]},
        "vague_asked_back": f"{sum(v['asked_back'] for v in vague)} of {len(vague)}",
        "run_date": time.strftime("%Y-%m-%d"),
    }
    return {"summary": summary, "records": records, "vague": vague}


def save(report):
    settings.REPORT.write_text(json.dumps(report, indent=1, ensure_ascii=False, default=str))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="only the first N questions (quick check)")
    args = parser.parse_args()
    report = run_tests(limit=args.limit)
    save(report)
    print(json.dumps(report["summary"], indent=1))
