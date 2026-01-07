import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "hinteval_db"),
        user=os.getenv("DB_USER", "hinteval_user"),
        password=os.getenv("DB_PASS", "secure_university_password")
    )


def init_db() -> None:
    """
    Initialize PostgreSQL DB schema safely.
    This function is idempotent and can be run multiple times.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # 1) QUESTIONS
        cur.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                session_id TEXT,
                created_at TEXT NOT NULL
            );
        """)

        # 2) ANSWERS
        cur.execute("""
            CREATE TABLE IF NOT EXISTS answers (
                id SERIAL PRIMARY KEY,
                question_id INTEGER NOT NULL,
                answer_text TEXT NOT NULL,
                model_name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
            );
        """)

        # 3) HINTS (FIXED TYPO)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS hints (
                id SERIAL PRIMARY KEY,
                question_id INTEGER NOT NULL,
                answer_id INTEGER,
                hint_text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
                FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE SET NULL
            );
        """)

        # 4) METRICS
        cur.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id SERIAL PRIMARY KEY,
                hint_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                value REAL,
                metadata_json TEXT,
                FOREIGN KEY(hint_id) REFERENCES hints(id) ON DELETE CASCADE
            );
        """)

        # 5) ENTITIES
        cur.execute("""
            CREATE TABLE IF NOT EXISTS entities (
                id SERIAL PRIMARY KEY,
                hint_id INTEGER NOT NULL,
                entity TEXT,
                ent_type TEXT,
                start_index INTEGER,
                end_index INTEGER,
                metadata_json TEXT,
                FOREIGN KEY(hint_id) REFERENCES hints(id) ON DELETE CASCADE
            );
        """)

        # 6) CANDIDATE ANSWERS (BASE TABLE)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS candidate_answers (
                id SERIAL PRIMARY KEY,
                question_id INTEGER NOT NULL,
                candidate_text TEXT NOT NULL,
                is_eliminated BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
            );
        """)

        # 🔁 MIGRATION: add is_groundtruth if missing
        cur.execute("""
            ALTER TABLE candidate_answers
            ADD COLUMN IF NOT EXISTS is_groundtruth BOOLEAN NOT NULL DEFAULT FALSE;
        """)

        # 🔒 Optional: ensure only ONE ground truth per question
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS unique_groundtruth_per_question
            ON candidate_answers (question_id)
            WHERE is_groundtruth = TRUE;
        """)

        conn.commit()
        print("✅ PostgreSQL schema initialized / migrated successfully.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error initializing DB: {e}")

    finally:
        cur.close()
        conn.close()
