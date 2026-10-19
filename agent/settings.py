"""All settings in one place."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "data" / "shop.db"                 # step 1 creates it
QUESTIONS = ROOT / "data" / "test_questions.json"    # step 8: 40 questions with known answers
REPORT = ROOT / "data" / "test_report.json"          # step 8 writes the results here
WEBSITE_DATA = ROOT / "web" / "public" / "data"

TODAY = "2026-10-01"     # the data runs to 30 Sep 2026, so "last month" = September 2026. Fixed, so tests are repeatable.
ROW_LIMIT = 200          # every query is capped at this many rows
MAX_FIXES = 2            # if a query fails, the AI gets this many tries to correct it

# the AI that writes SQL: Claude if ANTHROPIC_API_KEY is set, otherwise a free open-source coding model
CLAUDE_MODEL = "claude-haiku-5-5"
FREE_MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
