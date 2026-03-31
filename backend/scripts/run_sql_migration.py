from pathlib import Path

from sqlalchemy import text

from app.database import engine


def main():
    sql_path = Path(__file__).resolve().parent / "001_initial.sql"
    sql_text = sql_path.read_text(encoding="utf-8")
    statements = [stmt.strip() for stmt in sql_text.split(";") if stmt.strip()]

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    print("Migração inicial aplicada com sucesso.")


if __name__ == "__main__":
    main()
