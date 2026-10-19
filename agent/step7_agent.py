"""
STEP 7 - THE AGENT: WRITE -> CHECK -> RUN -> FIX -> ANSWER
----------------------------------------------------------
What:  The loop that answers a question:
         1. the AI writes SQL (step 6), or asks a clarifying question if the request is vague
         2. the SQL is checked (step 5) and run on the read-only database (step 2)
         3. if it fails (or returns nothing), the AI is shown the exact error and tries again, up to MAX_FIXES times
         4. the result becomes a short answer + a table + a chart suggestion, with the SQL always shown
Why:   This is what makes it an AGENT and not a single prompt: it acts, looks at what happened, and corrects itself.
       The written answer is made from the result table by code, so the numbers in it can't be made up.
"""
import pandas as pd

import settings
import step2_read_only
import step4_prompt
import step5_check_sql
import step6_ai


def ask(question, write=None, con=None):
    write = write or step6_ai.pick_writer()
    con = con or step2_read_only.connect()
    system = step4_prompt.system_prompt()
    messages = step4_prompt.first_messages(question)
    attempts = []
    warned = False      # the business-rule warning is given at most once

    for attempt in range(1 + settings.MAX_FIXES):
        reply = write(system, messages)
        kind, content = step6_ai.read_reply(reply)
        if kind == "clarify":
            return {"type": "clarify", "question": question, "clarify": content, "attempts": attempts}
        try:
            sql = step5_check_sql.check_sql(content)
            table = step2_read_only.run_query(sql, con)
            if table.empty and attempt < settings.MAX_FIXES:
                raise ValueError("the query ran but returned no rows. Check text values (they are case-sensitive) and date filters. "
                                 "If no rows really is the right answer, return the same query again.")
            problem = step5_check_sql.business_check(content)
            if problem and not warned and attempt < settings.MAX_FIXES:
                warned = True
                raise ValueError(problem)
        except ValueError as error:
            message = step5_check_sql.explain_error(str(error))
            attempts.append({"sql": content, "error": message})
            messages = messages + [{"role": "assistant", "content": reply},
                                   {"role": "user", "content": f"That query has a problem: {message}\nFix it. Reply with only the corrected SQL."}]
            continue
        attempts.append({"sql": content, "error": None})
        return {"type": "answer", "question": question, "sql": content, "ran_sql": sql, "table": table, "answer": summarise(table),
                "chart": pick_chart(table), "attempts": attempts}

    return {"type": "failed", "question": question, "attempts": attempts,
            "answer": f"I couldn't write a working query after {len(attempts)} tries. Last error: {attempts[-1]['error']}"}


# ---------- turning the result table into words and a chart ----------

def label(column):
    return column.replace("_inr", "").replace("_pct", " %").replace("_", " ").strip().capitalize()


def fmt(value, column=""):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "none"
    if isinstance(value, (int, float)):
        money = "inr" in column.lower() or "revenue" in column.lower() or "spend" in column.lower() or "value" in column.lower()
        text = indian(value)
        return ("₹" + text) if money else (text + "%" if "pct" in column.lower() or "rate" in column.lower() else text)
    return str(value)


def indian(value):
    """1234567.8 -> '12,34,567.80' (Indian digit grouping, as on the website)."""
    whole_number = not isinstance(value, float) or float(value).is_integer()
    sign, value = ("-" if value < 0 else ""), abs(value)
    whole, cents = f"{value:.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    text = ",".join(([head] if head else []) + groups + [tail])
    return sign + (text if whole_number else f"{text}.{cents}")


def summarise(table):
    if table.empty:
        return "The query returned no rows."
    if len(table) == 1:
        return " · ".join(f"{label(c)}: {fmt(table[c].iloc[0], c)}" for c in table.columns)
    numbers = [c for c in table.columns if pd.api.types.is_numeric_dtype(table[c])]
    names = [c for c in table.columns if c not in numbers]
    if names and numbers:
        x, y = names[0], numbers[-1]
        if looks_like_time(table[x]):
            first, last = table.iloc[0], table.iloc[-1]
            return f"{label(y)} went from {fmt(first[y], y)} in {first[x]} to {fmt(last[y], y)} in {last[x]} ({len(table)} rows)."
        top = table.loc[table[y].idxmax()]
        return f"Highest {label(y).lower()}: {top[x]} ({fmt(top[y], y)}). {len(table)} rows."
    return f"{len(table)} rows."


def looks_like_time(column):
    return column.astype(str).str.match(r"^\d{4}(-\d{2})?(-\d{2})?$").all()


def pick_chart(table):
    """A line chart for a trend over time, a bar chart for a comparison, nothing for a single number."""
    if len(table) < 2 or len(table) > 60:
        return None
    numbers = [c for c in table.columns if pd.api.types.is_numeric_dtype(table[c])]
    names = [c for c in table.columns if c not in numbers]
    if not numbers or not names:
        return None
    x = names[0]
    return {"type": "line" if looks_like_time(table[x]) else "bar", "x": x, "y": numbers[-1]}


if __name__ == "__main__":
    import sys
    result = ask(" ".join(sys.argv[1:]) or "What was revenue by category in 2026?")
    print(result.get("clarify") or result["answer"])
    for a in result["attempts"]:
        print("\nSQL:\n" + a["sql"] + (f"\n-> error: {a['error']}" if a["error"] else ""))
    if "table" in result:
        print(result["table"].head(10))
