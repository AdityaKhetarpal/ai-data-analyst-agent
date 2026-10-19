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

# the AI that writes SQL (step 6), first one available:
#   1. any OpenAI-compatible API if LLM_API_KEY is set (e.g. Groq's or Google Gemini's free tier)
#   2. Claude if ANTHROPIC_API_KEY is set
#   3. a free open-source coding model that runs on this computer (no key at all)
API_BASE_URL = "https://api.groq.com/openai/v1"     # override with LLM_BASE_URL
API_MODEL = "llama-3.3-70b-versatile"               # override with LLM_MODEL
CLAUDE_MODEL = "claude-haiku-5-5"
FREE_MODEL = "Qwen/Qwen2.5-Coder-3B-Instruct"
