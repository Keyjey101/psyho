# 08. Схема Базы Данных

## 8.1 Новые таблицы

Все новые таблицы добавляются через Alembic миграцию.
Существующие таблицы (User, ChatSession, Message и др.) не изменяются.

---

### `game_sessions`

```sql
CREATE TABLE game_sessions (
    id                  TEXT PRIMARY KEY,          -- UUID
    anonymous_session_id TEXT NOT NULL,            -- значение cookie game_session_id
    user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'active',
                        -- active | finished_a | finished_b | crisis_interrupted
    move_count          INTEGER NOT NULL DEFAULT 0,
    max_moves           INTEGER NOT NULL DEFAULT 12,
    answers             TEXT NOT NULL DEFAULT '[]', -- JSON
    landing_answers     TEXT NOT NULL DEFAULT '[]', -- JSON
    dominant_topic      TEXT,
    final_confidence    REAL,
    time_seconds        INTEGER,                   -- длительность игры
    pseudonym_id        TEXT REFERENCES user_pseudonyms(id) ON DELETE SET NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at         DATETIME
);

CREATE INDEX ix_game_sessions_anon ON game_sessions(anonymous_session_id);
CREATE INDEX ix_game_sessions_user ON game_sessions(user_id);
CREATE INDEX ix_game_sessions_status ON game_sessions(status);
```

**Поле `answers` (JSON-структура):**
```json
[
  {
    "move": 1,
    "question": "Когда тебя критикуют...",
    "choices": ["А", "Б", "В"],
    "chosen_index": 1,
    "chosen_text": "Принимаю близко к сердцу",
    "analysis_snapshot": {"anxiety": 0.45, "self_criticism": 0.38}
  }
]
```

---

### `user_pseudonyms`

```sql
CREATE TABLE user_pseudonyms (
    id                  TEXT PRIMARY KEY,           -- UUID
    pseudonym           TEXT NOT NULL UNIQUE,
    type                TEXT NOT NULL,              -- generated | ironic | custom
    user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
    anonymous_session_id TEXT,
    visible_in_lb       INTEGER NOT NULL DEFAULT 1, -- bool: 1=visible, 0=hidden
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_pseudonyms_name ON user_pseudonyms(pseudonym);
CREATE INDEX ix_pseudonyms_user ON user_pseudonyms(user_id);
```

---

### `leaderboard_entries`

```sql
CREATE TABLE leaderboard_entries (
    id              TEXT PRIMARY KEY,               -- UUID
    pseudonym_id    TEXT NOT NULL REFERENCES user_pseudonyms(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL,
    moves_count     INTEGER NOT NULL,
    time_seconds    INTEGER NOT NULL,
    scenario        TEXT NOT NULL,                  -- A | B
    topic           TEXT,                           -- только для сценария A
    is_visible      INTEGER NOT NULL DEFAULT 1,     -- bool
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_lb_score ON leaderboard_entries(score DESC);
CREATE INDEX ix_lb_pseudonym ON leaderboard_entries(pseudonym_id);
CREATE INDEX ix_lb_visible ON leaderboard_entries(is_visible, score DESC);
```

---

### `landing_answers`

```sql
CREATE TABLE landing_answers (
    id                  TEXT PRIMARY KEY,           -- UUID
    anonymous_session_id TEXT NOT NULL,
    question_text       TEXT NOT NULL,
    choice_index        INTEGER NOT NULL,
    choice_text         TEXT NOT NULL,
    question_num        INTEGER NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_landing_answers_session ON landing_answers(anonymous_session_id);
-- TTL: удаляются через 24 часа фоновой задачей
```

---

### `budget_tracker`

```sql
CREATE TABLE budget_tracker (
    id              INTEGER PRIMARY KEY DEFAULT 1,  -- одна строка
    monthly_spend   REAL NOT NULL DEFAULT 0.0,
    month_year      TEXT NOT NULL,                  -- "2025-05"
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Одна строка, upsert при каждом вызове LLM
```

---

## 8.2 Индексы производительности

Лидерборд читается часто (polling 30 сек). Критически важен индекс по `(is_visible, score DESC)`.

Сессии ищутся по `anonymous_session_id` (cookie) — индекс обязателен.

---

## 8.3 Миграция Alembic

Создать файл `alembic/versions/XXXX_add_game_tables.py`:

```python
"""add game tables

Revision ID: add_game_tables
Revises: <last_revision>
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('user_pseudonyms', ...)
    op.create_table('game_sessions', ...)
    op.create_table('leaderboard_entries', ...)
    op.create_table('landing_answers', ...)
    op.create_table('budget_tracker', ...)
    # вставить начальную запись budget_tracker
    op.execute("INSERT INTO budget_tracker (monthly_spend, month_year) VALUES (0.0, strftime('%Y-%m', 'now'))")

def downgrade():
    op.drop_table('budget_tracker')
    op.drop_table('landing_answers')
    op.drop_table('leaderboard_entries')
    op.drop_table('game_sessions')
    op.drop_table('user_pseudonyms')
```

---

## 8.4 SQLAlchemy Модели (`models/game_models.py`)

```python
class GameSession(Base):
    __tablename__ = "game_sessions"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    anonymous_session_id = Column(String, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, nullable=False, default="active")
    move_count = Column(Integer, nullable=False, default=0)
    max_moves = Column(Integer, nullable=False, default=12)
    answers = Column(Text, nullable=False, default="[]")
    landing_answers = Column(Text, nullable=False, default="[]")
    dominant_topic = Column(String, nullable=True)
    final_confidence = Column(Float, nullable=True)
    time_seconds = Column(Integer, nullable=True)
    pseudonym_id = Column(String, ForeignKey("user_pseudonyms.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    @property
    def answers_list(self) -> list:
        return json.loads(self.answers)

    def add_answer(self, move: int, question: str, choices: list,
                   chosen_index: int, analysis_snapshot: dict):
        answers = self.answers_list
        answers.append({
            "move": move, "question": question, "choices": choices,
            "chosen_index": chosen_index,
            "chosen_text": choices[chosen_index],
            "analysis_snapshot": analysis_snapshot
        })
        self.answers = json.dumps(answers, ensure_ascii=False)
        self.move_count = len(answers)


class UserPseudonym(Base):
    __tablename__ = "user_pseudonyms"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    pseudonym = Column(String, nullable=False, unique=True)
    type = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    anonymous_session_id = Column(String, nullable=True)
    visible_in_lb = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LeaderboardEntry(Base):
    __tablename__ = "leaderboard_entries"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    pseudonym_id = Column(String, ForeignKey("user_pseudonyms.id"), nullable=False)
    score = Column(Integer, nullable=False)
    moves_count = Column(Integer, nullable=False)
    time_seconds = Column(Integer, nullable=False)
    scenario = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    is_visible = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pseudonym_rel = relationship("UserPseudonym", lazy="joined")


class BudgetTracker(Base):
    __tablename__ = "budget_tracker"
    id = Column(Integer, primary_key=True, default=1)
    monthly_spend = Column(Float, nullable=False, default=0.0)
    month_year = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```
