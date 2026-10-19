"""
STEP 4 - WRITE THE INSTRUCTIONS FOR THE AI (few-shot prompting)
---------------------------------------------------------------
What:  Build the message the AI receives: rules + the database description from step 3 + a few
       worked EXAMPLES (question -> correct SQL), including one where the right move is to ask back.
Why:   Showing 5 solved examples teaches the AI our conventions (how revenue is calculated, how dates
       are stored, how to name columns) far better than rules alone. This is called few-shot prompting.
       None of these examples are in the step 8 test, so the test stays fair.
"""
import step3_schema

RULES = """You are a data analyst. You answer business questions by writing ONE SQLite query.
Rules:
- Use only the tables and columns described below. Follow the BUSINESS DEFINITIONS exactly.
- Read-only: write a single SELECT (WITH ... SELECT is fine). Never change data.
- Give columns short, readable names with AS (e.g. AS revenue_inr).
- Reply with only the SQL inside ```sql ... ```, no explanation.
- If the question is too vague to answer one sensible way (e.g. "best" without saying by what, or no clear metric),
  do NOT guess: reply with one line starting with CLARIFY: followed by a short question offering 2-3 options."""

EXAMPLES = [
    ("How many orders were delivered in August 2026?",
     "SELECT COUNT(*) AS delivered_orders\nFROM orders\nWHERE status = 'delivered' AND substr(order_date, 1, 7) = '2026-08'"),
    ("What was the revenue from the Books category in 2025?",
     "SELECT ROUND(SUM(oi.quantity * oi.unit_price_inr * (1 - oi.discount_pct / 100.0)), 2) AS revenue_inr\n"
     "FROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id\nJOIN products p ON p.product_id = oi.product_id\n"
     "WHERE o.status IN ('delivered', 'shipped') AND p.category = 'Books' AND o.order_date BETWEEN '2025-01-01' AND '2025-12-31'"),
    ("Which 3 states have the most customers?",
     "SELECT state, COUNT(*) AS customers\nFROM customers\nGROUP BY state\nORDER BY customers DESC\nLIMIT 3"),
    ("What is the return rate for orders paid by card?",
     "SELECT ROUND(100.0 * SUM(status = 'returned') / SUM(status != 'cancelled'), 2) AS return_rate_pct\n"
     "FROM orders\nWHERE payment_method = 'Card'"),
    ("Show me the numbers for our customers",
     "CLARIFY: Which number would help: how many customers we have, revenue per customer, or customers by city?"),
]


def system_prompt():
    return RULES + "\n\n" + step3_schema.describe()


def example_messages():
    """The examples, written as earlier turns of the conversation, so the AI copies the format."""
    messages = []
    for question, reply in EXAMPLES:
        messages.append({"role": "user", "content": question})
        messages.append({"role": "assistant", "content": reply if reply.startswith("CLARIFY") else f"```sql\n{reply}\n```"})
    return messages


def first_messages(question):
    return example_messages() + [{"role": "user", "content": question}]


if __name__ == "__main__":
    print(system_prompt()[:600], "...\n")
    for m in first_messages("What was revenue last month?")[-3:]:
        print(m["role"].upper(), ":", m["content"], "\n")
