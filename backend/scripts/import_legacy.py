import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User, UserRole
from app.routers.storage import STORAGE_TABLES
from app.security import hash_password


def map_user_payload(payload: dict) -> dict:
    return {
        "id": payload.get("id"),
        "cpf": payload.get("cpf"),
        "nome": payload.get("nome"),
        "email": payload.get("email"),
        "cargo": payload.get("cargo"),
        "acesso": payload.get("acesso", "Usuário"),
        "senha": payload.get("senha"),
        "ativo": payload.get("ativo", True),
    }


def main():
    file_path = Path("legacy-storage.json")
    if not file_path.exists():
        raise SystemExit("Arquivo legacy-storage.json não encontrado no diretório backend/scripts")

    payload = json.loads(file_path.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        users = payload.get("espen_users", [])
        for row in users:
            if not row.get("cpf") or not row.get("email"):
                continue
            existing = db.scalar(select(User).where(User.cpf == row["cpf"]))
            if existing:
                continue
            raw = map_user_payload(row)
            db.add(
                User(
                    cpf=raw["cpf"],
                    nome=raw["nome"] or "Usuário sem nome",
                    email=raw["email"],
                    cargo=raw["cargo"],
                    role=UserRole.ADMIN if raw["acesso"] == "Administrador" else UserRole.USER,
                    password_hash=hash_password("admin123") if not raw["senha"] else hash_password(str(raw["senha"])),
                    ativo=bool(raw["ativo"]),
                )
            )
        db.commit()

        for key in STORAGE_TABLES:
            rows = payload.get(key, [])
            if isinstance(rows, list):
                db.query(STORAGE_TABLES[key]).delete()
                for item in rows:
                    item_id = item.get("id")
                    if not item_id:
                        continue
                    db.add(STORAGE_TABLES[key](id=item_id, data=item))
        db.commit()

    print("Importação legada concluída.")


if __name__ == "__main__":
    main()
