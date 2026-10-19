import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))

import pytest  # noqa: E402

import settings  # noqa: E402
import step1_make_database  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    if not settings.DATABASE.exists():
        step1_make_database.build()
    return settings.DATABASE


class FakeAI:
    """Stands in for the AI in tests: answers from a script, so tests are free, fast and repeatable."""
    def __init__(self, replies):
        self.replies = list(replies)
        self.seen = []
        self.name = "fake"

    def __call__(self, system, messages):
        self.seen.append(messages[-1]["content"])
        return self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]


class AnswerKeyAI:
    """Writes the known-correct SQL for every test question (to check the test harness itself)."""
    name = "answer key"

    def __init__(self):
        data = json.loads(settings.QUESTIONS.read_text())
        self.key = {q["question"]: q["sql"] for q in data["questions"]}

    def __call__(self, system, messages):
        question = messages[-1]["content"]
        return f"```sql\n{self.key[question]}\n```" if question in self.key else "CLARIFY: by what measure?"


@pytest.fixture
def fake_ai():
    return FakeAI


@pytest.fixture
def answer_key_ai():
    return AnswerKeyAI()
