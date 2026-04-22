#!/bin/sh
set -e

DB_PATH="/data/psyho.db"

# Если БД существует, но в ней нет таблицы alembic_version —
# значит она была создана через create_all без alembic.
# Помечаем её как уже на версии 001_initial, чтобы alembic
# не пытался создать таблицы повторно, а только применил 002+.
python3 - <<'EOF'
import sqlite3, os

db_path = "/data/psyho.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT count(*) FROM sqlite_master "
        "WHERE type='table' AND name='alembic_version'"
    )
    if cur.fetchone()[0] == 0:
        print("No alembic_version found — stamping DB at 001_initial")
        cur.execute(
            "CREATE TABLE alembic_version ("
            "version_num VARCHAR(32) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
        )
        cur.execute("INSERT INTO alembic_version VALUES ('001_initial')")
        conn.commit()
    conn.close()
EOF

alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
