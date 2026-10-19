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

RULES = """You are a careful data analyst. You answer business questions by writing ONE SQLite query.
Rules:
- Use only the tables and columns described below. Check which table each column belongs to before using it.
- Follow the BUSINESS DEFINITIONS exactly (especially: revenue only counts delivered/shipped orders).
- Read-only: write a single SELECT (WITH ... SELECT is fine). Never change data.
- Return only the columns needed to answer, with short readable names (AS revenue_inr, AS orders, ...).
- Reply with only the SQL inside ```sql ... ```, no explanation.
- If the question does not say WHAT to measure (e.g. "best", "top", "how are we doing", "growth", "compare" with no metric,
  or "the numbers" with no period or metric), do NOT guess: reply with one line starting with CLARIFY: followed by
  a short question offering 2-3 options."""

REV = "SUM(oi.quantity * oi.unit_price_inr * (1 - oi.discount_pct / 100.0))"
EXAMPLES = [
    ("How many orders were delivered in August 2026?",
     "SELECT COUNT(*) AS delivered_orders\nFROM orders\nWHERE status = 'delivered' AND order_date LIKE '2026-08%'"),
    ("What was the revenue from the Books category in 2025?",
     f"SELECT ROUND({REV}, 2) AS revenue_inr\nFROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id\n"
     "JOIN products p ON p.product_id = oi.product_id\n"
     "WHERE o.status IN ('delivered', 'shipped') AND p.category = 'Books' AND o.order_date LIKE '2025%'"),
    ("Which 3 states have the most customers?",
     "SELECT state, COUNT(*) AS customers\nFROM customers\nGROUP BY state\nORDER BY customers DESC\nLIMIT 3"),
    ("Show units sold per month for Fashion in 2025",
     "SELECT substr(o.order_date, 1, 7) AS month, SUM(oi.quantity) AS units_sold\nFROM order_items oi\n"
     "JOIN orders o ON o.order_id = oi.order_id\nJOIN products p ON p.product_id = oi.product_id\n"
     "WHERE o.status IN ('delivered', 'shipped') AND p.category = 'Fashion' AND o.order_date LIKE '2025%'\n"
     "GROUP BY month\nORDER BY month"),
    ("What is the return rate for orders paid by card?",
     "SELECT ROUND(100.0 * SUM(status = 'returned') / SUM(status != 'cancelled'), 2) AS return_rate_pct\n"
     "FROM orders\nWHERE payment_method = 'Card'"),
    ("Which 5 brands had the highest revenue from customers in Pune?",
     f"SELECT p.brand, ROUND({REV}, 2) AS revenue_inr\nFROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id\n"
     "JOIN customers c ON c.customer_id = o.customer_id\nJOIN products p ON p.product_id = oi.product_id\n"
     "WHERE o.status IN ('delivered', 'shipped') AND c.city = 'Pune'\nGROUP BY p.brand\nORDER BY revenue_inr DESC\nLIMIT 5"),
    ("What is the cancellation rate for Business customers' orders by state?",
     "SELECT c.state, ROUND(100.0 * SUM(o.status = 'cancelled') / COUNT(*), 2) AS cancellation_rate_pct\n"
     "FROM orders o\nJOIN customers c ON c.customer_id = o.customer_id\nWHERE c.segment = 'Business'\nGROUP BY c.state"),
    ("How many products have never been ordered?",
     "SELECT COUNT(*) AS products_never_ordered\nFROM products\nWHERE product_id NOT IN (SELECT product_id FROM order_items)"),
    ("Show me the numbers for our customers",
     "CLARIFY: Which number would help: how many customers we have, revenue per customer, or customers by city?"),
    ("Which is the best?",
     "CLARIFY: Best by what: revenue, units sold or number of orders? And among products, categories or cities?"),
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
