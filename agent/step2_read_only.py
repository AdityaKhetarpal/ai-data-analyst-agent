"""
STEP 2 - CONNECT READ-ONLY
--------------------------
What:  Open the database so it can ONLY be read. Three locks:
         1. the file is opened in read-only mode (mode=ro)
         2. PRAGMA query_only = ON  (SQLite refuses any write)
         3. an "authorizer" that SQLite calls for every action; we allow reading and nothing else
       Plus a time limit, so a runaway query can't hang the app.
Why:   The AI writes the SQL. Even if it writes something harmful (DELETE, DROP...), the database can't be changed.
       Step 5 also blocks those queries before they run. Two independent safety nets.
"""
import sqlite3
import time

import pandas as pd

import settings

ALLOWED = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, getattr(sqlite3, "SQLITE_RECURSIVE", 33)}
TIME_LIMIT_SECONDS = 5


def only_reading(action, *_):
    return sqlite3.SQLITE_OK if action in ALLOWED else sqlite3.SQLITE_DENY


def connect(path=settings.DATABASE, for_ai=True):
    """for_ai=False is only used by our own code in step 3 to read the table list (a PRAGMA, which the AI is not allowed)."""
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
    con.execute("PRAGMA query_only = ON")
    if for_ai:
        con.set_authorizer(only_reading)
    return con


def run_query(sql, con=None):
    """Run one SELECT and return the result as a DataFrame. Raises an error if it fails (step 7 uses the error message to fix the query)."""
    con = con or connect()
    deadline = time.time() + TIME_LIMIT_SECONDS
    con.set_progress_handler(lambda: 1 if time.time() > deadline else 0, 10_000)   # returning 1 stops the query
    try:
        return pd.read_sql_query(sql, con)
    except Exception as error:
        message = str(error)
        if message.startswith("Execution failed on sql"):      # pandas adds the whole query in front; keep only SQLite's reason
            message = message.rsplit("': ", 1)[-1]
        if "interrupted" in message:
            message = f"query took longer than {TIME_LIMIT_SECONDS} seconds"
        raise ValueError(message) from None
    finally:
        con.set_progress_handler(None, 0)


if __name__ == "__main__":
    print(run_query("SELECT status, COUNT(*) AS orders FROM orders GROUP BY status"))
    try:
        run_query("DELETE FROM orders")
    except ValueError as e:
        print("DELETE blocked:", e)
