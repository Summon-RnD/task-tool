import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from seed_data import default_board

DB_PATH = Path(__file__).resolve().parent / "data" / "taskboard.db"


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS board_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        row = conn.execute("SELECT data FROM board_state WHERE id = 1").fetchone()
        if row is None:
            save_board(conn, default_board())
        else:
            board = json.loads(row["data"])
            if not board.get("tasks") or not board.get("people"):
                save_board(conn, default_board())


def get_board(conn=None):
    own = conn is None
    if own:
        conn = connect()
    try:
        row = conn.execute("SELECT data, updated_at FROM board_state WHERE id = 1").fetchone()
        if row is None:
            board = default_board()
            save_board(conn, board)
            return board, datetime.now(timezone.utc).isoformat()
        board = json.loads(row["data"])
        if not board.get("tasks") or not board.get("people"):
            board = default_board()
            save_board(conn, board)
        return board, row["updated_at"]
    finally:
        if own:
            conn.close()


def save_board(conn, board):
    now = datetime.now(timezone.utc).isoformat()
    payload = json.dumps(board, ensure_ascii=False)
    conn.execute(
        """
        INSERT INTO board_state (id, data, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        """,
        (payload, now),
    )
    conn.commit()
    return now


def put_board(board):
    with connect() as conn:
        return save_board(conn, board)
