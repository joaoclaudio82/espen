import uuid
from typing import Type

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AcaoItem, DashboardPreferenceItem, MatrizItem, PdiItem, TrilhaItem, User, UserRole
from .schemas import UserOut


STORAGE_TABLES: dict[str, Type[MatrizItem | AcaoItem | TrilhaItem | PdiItem | DashboardPreferenceItem]] = {
    "espen_matriz": MatrizItem,
    "espen_acoes": AcaoItem,
    "espen_trilhas": TrilhaItem,
    "espen_pdi": PdiItem,
    "espen_dashboard": DashboardPreferenceItem,
}


def role_from_acesso(acesso: str) -> UserRole:
    return UserRole.ADMIN if acesso == "Administrador" else UserRole.USER


def acesso_from_role(role: UserRole) -> str:
    return "Administrador" if role == UserRole.ADMIN else "Usuário"


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        cpf=user.cpf,
        nome=user.nome,
        email=user.email,
        cargo=user.cargo,
        acesso=acesso_from_role(user.role),
        ativo=user.ativo,
        data_registro=user.data_registro,
    )


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.nome.asc())).all())


def replace_storage_items(db: Session, key: str, items: list[dict]) -> None:
    table = STORAGE_TABLES.get(key)
    if not table:
        return

    db.query(table).delete()
    for item in items:
        item_id = item.get("id") or str(uuid.uuid4())
        item["id"] = item_id
        db.add(table(id=item_id, data=item))
    db.commit()


def read_storage_items(db: Session, key: str) -> list[dict]:
    table = STORAGE_TABLES.get(key)
    if not table:
        return []
    rows = db.scalars(select(table).order_by(table.created_at.asc())).all()
    return [row.data for row in rows]


def clear_storage(db: Session, key: str) -> None:
    table = STORAGE_TABLES.get(key)
    if not table:
        return
    db.query(table).delete()
    db.commit()
