"""
STEP 5 - CHECK THE SQL BEFORE RUNNING IT (validation with sqlglot)
------------------------------------------------------------------
What:  sqlglot reads the SQL the way a database would (it "parses" it into a tree) and we check:
         - it is valid SQL and exactly ONE statement
         - it is a SELECT (no INSERT / UPDATE / DELETE / DROP / CREATE / PRAGMA / ATTACH ...)
         - every table it uses exists
         - it has a row limit (we add LIMIT if missing, and cap it at ROW_LIMIT)
Why:   Never run AI-written code blindly. Clear error messages here also help step 7: the AI is told
       exactly what was wrong ("unknown table sales") and can fix it.
"""
import re

import sqlglot
from sqlglot import exp

import settings

TABLES = {"customers", "products", "orders", "order_items"}
FORBIDDEN = tuple(getattr(exp, name) for name in
                  ["Insert", "Update", "Delete", "Drop", "Create", "Alter", "Merge", "Command", "Pragma", "Attach", "Detach", "Set", "Transaction"]
                  if hasattr(exp, name))


def check_sql(sql, row_limit=settings.ROW_LIMIT):
    """Return a safe version of the SQL, or raise ValueError saying what is wrong."""
    sql = (sql or "").strip().rstrip(";").strip()
    if not sql:
        raise ValueError("no SQL was written")
    try:
        statements = [s for s in sqlglot.parse(sql, read="sqlite") if s is not None]
    except sqlglot.errors.ParseError as error:
        raise ValueError(f"SQL syntax error: {str(error).splitlines()[0]}") from None
    if len(statements) != 1:
        raise ValueError(f"write exactly one statement (found {len(statements)})")
    tree = statements[0]

    if not isinstance(tree, exp.Query) or tree.find(*FORBIDDEN):
        raise ValueError("only SELECT queries are allowed (the database is read-only)")

    cte_names = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        name = table.name.lower()
        if name and name not in TABLES and name not in cte_names:
            raise ValueError(f"unknown table '{table.name}'. The tables are: {', '.join(sorted(TABLES))}")

    limit = tree.args.get("limit")
    current = None
    if limit is not None:
        try:
            current = int(limit.expression.this)
        except (AttributeError, TypeError, ValueError):
            current = None
    if current is None or current > row_limit:
        tree = tree.limit(row_limit if current is None else min(current, row_limit))
    return tree.sql(dialect="sqlite", pretty=True)


if __name__ == "__main__":
    print(check_sql("select city, count(*) n from customers group by city order by n desc"), "\n")
    for bad in ["DELETE FROM orders", "SELECT * FROM sales", "SELECT 1; DROP TABLE orders", "SELEC * FROM orders"]:
        try:
            check_sql(bad)
        except ValueError as e:
            print(f"{bad!r:40} -> blocked: {e}")


# ---------- extra help for step 7 (self-correction) ----------
COLUMNS = {
    "customers": ["customer_id", "name", "city", "state", "segment", "signup_date"],
    "products": ["product_id", "product_name", "category", "brand", "list_price_inr"],
    "orders": ["order_id", "customer_id", "order_date", "delivery_date", "status", "payment_method"],
    "order_items": ["order_item_id", "order_id", "product_id", "quantity", "unit_price_inr", "discount_pct"],
}


def explain_error(message):
    """Add a hint to a database error, e.g. 'no such column: o.segment' -> say which table has 'segment'."""
    match = re.search(r"no such column: (?:\w+\.)?(\w+)", message)
    if match:
        column = match.group(1).lower()
        homes = [t for t, cols in COLUMNS.items() if column in cols]
        if homes:
            return f"{message}. Hint: '{column}' is a column of {' and '.join(homes)}; join that table and use its alias."
        return f"{message}. Hint: there is no column called '{column}'. Use only the columns listed in the schema."
    return message


def business_check(sql):
    """Catch a result that runs but breaks a business rule. Returns a message, or None if it looks fine."""
    lowered = sql.lower()
    if "unit_price_inr" in lowered and "sum(" in lowered and "status" not in lowered:
        return ("this looks like revenue but it doesn't filter orders by status. Revenue only counts orders with "
                "status IN ('delivered', 'shipped'): join orders and add that filter. If this is not revenue, return the same query.")
    return None
