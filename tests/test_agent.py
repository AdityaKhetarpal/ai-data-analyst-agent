import pandas as pd
import pytest

import step2_read_only
import step3_schema
import step4_prompt
import step5_check_sql
import step6_ai
import step7_agent
import step8_test


# step 1
def test_database_is_the_same_every_time():
    totals = step2_read_only.run_query("SELECT COUNT(*) AS n, SUM(quantity) AS q FROM order_items").iloc[0].tolist()
    orders = step2_read_only.run_query("SELECT COUNT(*) AS n FROM orders").iloc[0, 0]
    assert orders == 12000 and totals[0] > 15000


# step 2
@pytest.mark.parametrize("sql", ["DELETE FROM orders", "DROP TABLE customers", "UPDATE products SET list_price_inr = 1",
                                 "INSERT INTO customers (name) VALUES ('x')", "PRAGMA table_info(orders)", "ATTACH 'x.db' AS x"])
def test_database_cannot_be_changed_even_without_step5(sql):
    with pytest.raises(ValueError):
        step2_read_only.run_query(sql)


# step 3
def test_schema_lists_every_table_and_the_revenue_rule():
    text = step3_schema.describe()
    for table in ["customers", "products", "orders", "order_items"]:
        assert f"TABLE {table}" in text
    assert "discount_pct" in text and "Revenue" in text and "'delivered'" in text


# step 4
def test_examples_are_not_test_questions():
    import json, settings
    test_questions = {q["question"].lower() for q in json.loads(settings.QUESTIONS.read_text())["questions"]}
    assert not any(q.lower() in test_questions for q, _ in step4_prompt.EXAMPLES)


def test_every_example_sql_runs():
    for _, sql in step4_prompt.EXAMPLES:
        if not sql.startswith("CLARIFY"):
            assert not step2_read_only.run_query(step5_check_sql.check_sql(sql)).empty


# step 5
@pytest.mark.parametrize("sql", ["DELETE FROM orders", "SELECT * FROM sales", "SELECT 1; DROP TABLE orders",
                                 "WITH x AS (SELECT 1) DELETE FROM orders", "", "SELEC * FROM orders"])
def test_bad_sql_is_blocked(sql):
    with pytest.raises(ValueError):
        step5_check_sql.check_sql(sql)


def test_limit_added_and_capped():
    assert "LIMIT 200" in step5_check_sql.check_sql("SELECT * FROM orders")
    assert "LIMIT 200" in step5_check_sql.check_sql("SELECT * FROM orders LIMIT 99999")
    assert "LIMIT 5" in step5_check_sql.check_sql("SELECT * FROM orders LIMIT 5")
    assert "LIMIT" in step5_check_sql.check_sql("WITH t AS (SELECT city FROM customers) SELECT * FROM t")


# step 6
def test_read_reply():
    assert step6_ai.read_reply("```sql\nSELECT 1\n```") == ("sql", "SELECT 1")
    assert step6_ai.read_reply("Sure!\n```\nSELECT 2\n```") == ("sql", "SELECT 2")
    assert step6_ai.read_reply("CLARIFY: by revenue or units?")[0] == "clarify"


# step 7
def test_agent_fixes_its_own_mistake(fake_ai):
    ai = fake_ai(["```sql\nSELECT amount FROM sales\n```", "```sql\nSELECT COUNT(*) AS customers FROM customers\n```"])
    result = step7_agent.ask("How many customers?", ai)
    assert result["type"] == "answer" and len(result["attempts"]) == 2
    assert "unknown table" in ai.seen[1] and result["table"].iloc[0, 0] == 1500


def test_agent_gives_up_after_two_fixes(fake_ai):
    result = step7_agent.ask("?", fake_ai(["```sql\nSELECT nope FROM orders\n```"]))
    assert result["type"] == "failed" and len(result["attempts"]) == 3


def test_agent_retries_when_nothing_found(fake_ai):
    ai = fake_ai(["```sql\nSELECT COUNT(*) AS n FROM orders WHERE status = 'Delivered' GROUP BY status\n```",
                  "```sql\nSELECT COUNT(*) AS n FROM orders WHERE status = 'delivered'\n```"])
    assert step7_agent.ask("delivered orders?", ai)["table"].iloc[0, 0] == 10583


def test_agent_asks_back_when_vague(fake_ai):
    result = step7_agent.ask("best products?", fake_ai(["CLARIFY: Best by revenue or units sold?"]))
    assert result["type"] == "clarify" and "revenue" in result["clarify"]


def test_answer_and_chart():
    trend = pd.DataFrame({"month": ["2026-01", "2026-02"], "revenue_inr": [10.0, 12.5]})
    assert step7_agent.pick_chart(trend) == {"type": "line", "x": "month", "y": "revenue_inr"}
    assert "₹10" in step7_agent.summarise(trend)
    bars = pd.DataFrame({"city": ["Delhi", "Pune"], "orders": [5, 9]})
    assert step7_agent.pick_chart(bars)["type"] == "bar" and "Pune" in step7_agent.summarise(bars)
    assert step7_agent.pick_chart(pd.DataFrame({"n": [3]})) is None


# step 8
def test_lenient_comparison():
    right = pd.DataFrame({"category": ["A", "B"], "r": [1.234, 5.0]})
    assert step8_test.same_result(right, pd.DataFrame({"x": [5.0, 1.23], "name": ["b", "a"], "extra": [0, 0]}))
    assert not step8_test.same_result(right, pd.DataFrame({"category": ["A"], "r": [1.234]}))
    assert not step8_test.same_result(right, pd.DataFrame({"category": ["A", "B"], "r": [1.5, 5.0]}))


def test_answer_key_scores_100(answer_key_ai):
    report = step8_test.run_tests(answer_key_ai)
    assert report["summary"]["execution_accuracy_pct"] == 100.0
    assert report["summary"]["vague_asked_back"] == "5 of 5"


def test_error_hint_names_the_right_table():
    assert "column of customers" in step5_check_sql.explain_error("no such column: o.segment")


def test_revenue_without_status_is_sent_back_once(fake_ai):
    no_status = "```sql\nSELECT SUM(quantity * unit_price_inr) AS revenue_inr FROM order_items\n```"
    with_status = ("```sql\nSELECT SUM(oi.quantity * oi.unit_price_inr) AS revenue_inr FROM order_items oi "
                   "JOIN orders o ON o.order_id = oi.order_id WHERE o.status IN ('delivered', 'shipped')\n```")
    ai = fake_ai([no_status, with_status])
    result = step7_agent.ask("revenue?", ai)
    assert len(result["attempts"]) == 2 and "status" in result["attempts"][0]["error"] and "status" in result["sql"]
    # if the AI insists, the second identical answer is accepted
    assert step7_agent.ask("revenue?", fake_ai([no_status]))["type"] == "answer"
