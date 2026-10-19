"""
STEP 3 - DESCRIBE THE DATABASE TO THE AI (schema grounding)
-----------------------------------------------------------
What:  Write a short description of every table and column, with a few real example values,
       plus a GLOSSARY of business terms (what "revenue" or "return rate" means in THIS company).
Why:   The AI has never seen this database. If we don't tell it the exact table and column names it will
       guess them (e.g. "sales.amount") and the query fails. The glossary stops it inventing its own
       definition of revenue, so its numbers match what the finance team would report.
"""
import step2_read_only

TABLES = {
    "customers": "one row per customer",
    "products": "one row per product in the catalogue",
    "orders": "one row per order (an order can contain several products)",
    "order_items": "one row per product line inside an order",
}
COLUMN_NOTES = {
    "order_date": "text 'YYYY-MM-DD'",
    "delivery_date": "text 'YYYY-MM-DD', empty (NULL) if cancelled or not delivered yet",
    "signup_date": "text 'YYYY-MM-DD'",
    "unit_price_inr": "price of ONE unit in rupees before discount",
    "list_price_inr": "catalogue price in rupees",
    "discount_pct": "discount on this line, 0-30 (percent)",
}
GLOSSARY = [
    "Today is 2026-10-01. Data runs from 2025-01-01 to 2026-09-30. 'Last month' = September 2026; 'this year' = 2026; 'last year' = 2025.",
    "Line revenue = quantity * unit_price_inr * (1 - discount_pct / 100.0).",
    "Revenue (or sales) = sum of line revenue for orders with status IN ('delivered', 'shipped'). Cancelled and returned orders are NOT revenue.",
    "Valid orders = orders with status IN ('delivered', 'shipped').",
    "Average order value (AOV) = revenue / number of valid orders.",
    "Return rate = returned orders / (all orders that were not cancelled) * 100.",
    "Cancellation rate = cancelled orders / all orders * 100.",
    "Units sold = sum of quantity on valid orders.",
    "Delivery time = julianday(delivery_date) - julianday(order_date), in days, for delivered orders.",
    "Months: use substr(order_date, 1, 7) to get 'YYYY-MM'. Percentages are 0-100, not 0-1. Round money to 2 decimals.",
]


def describe(con=None):
    """The text the AI reads before every question."""
    con = con or step2_read_only.connect(for_ai=False)
    lines = ["SQLite database of an Indian online shop. Money is in Indian rupees (INR).", ""]
    for table, what in TABLES.items():
        lines.append(f"TABLE {table} -- {what}")
        for name, kind in con.execute(f"SELECT name, type FROM pragma_table_info('{table}')"):
            note = COLUMN_NOTES.get(name, "")
            if kind == "TEXT" and not note and not name.endswith("name"):
                values = [r[0] for r in con.execute(f"SELECT DISTINCT {name} FROM {table} LIMIT 8")]
                note = "e.g. " + ", ".join(repr(v) for v in values)
            lines.append(f"  {name} {kind}" + (f"  -- {note}" if note else ""))
        lines.append("")
    lines.append("JOINS: orders.customer_id = customers.customer_id; order_items.order_id = orders.order_id; "
                 "order_items.product_id = products.product_id")
    lines.append("")
    lines.append("BUSINESS DEFINITIONS:")
    lines += [f"- {g}" for g in GLOSSARY]
    return "\n".join(lines)


if __name__ == "__main__":
    print(describe())
