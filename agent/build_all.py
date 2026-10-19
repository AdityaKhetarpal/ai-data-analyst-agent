"""
RUN EVERYTHING
--------------
  python agent/build_all.py           # step 1 (database) + export files for the website
  python agent/build_all.py --test    # ... and run the 40-question test (step 8) with the AI
"""
import argparse
import json
import shutil

import settings
import step1_make_database
import step2_read_only
import step4_prompt
import step8_test


def export_for_website():
    out = settings.WEBSITE_DATA
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(settings.DATABASE, out / "shop.db")                 # the browser SQL playground loads this copy
    (out / "prompt.json").write_text(json.dumps({                    # the website's live agent uses the SAME instructions
        "system": step4_prompt.system_prompt(), "examples": step4_prompt.example_messages(),
        "row_limit": settings.ROW_LIMIT, "max_fixes": settings.MAX_FIXES}, indent=1, ensure_ascii=False))
    con = step2_read_only.connect()
    tables = {}
    for table in ["customers", "products", "orders", "order_items"]:
        rows = step2_read_only.run_query(f"SELECT * FROM {table} LIMIT 3", con)
        count = int(step2_read_only.run_query(f"SELECT COUNT(*) AS n FROM {table}", con).iloc[0, 0])
        tables[table] = {"rows": count, "columns": list(rows.columns), "sample": rows.astype(object).values.tolist()}
    (out / "tables.json").write_text(json.dumps(tables, indent=1, ensure_ascii=False, default=str))
    report = json.loads(settings.REPORT.read_text()) if settings.REPORT.exists() else {"summary": None, "records": [], "vague": []}
    (out / "eval.json").write_text(json.dumps(report, ensure_ascii=False, default=str))
    print("website files written to", out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="also run the 40-question test with the AI")
    args = parser.parse_args()
    print("Step 1:", step1_make_database.build())
    if args.test:
        report = step8_test.run_tests()
        step8_test.save(report)
        print(json.dumps(report["summary"], indent=1))
    export_for_website()
