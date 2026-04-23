import uuid
from typing import Type

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    AcaoItem,
    DashboardPreferenceItem,
    MatrizItem,
    ModeracaoHistoricoItem,
    ModeracaoItem,
    PdiItem,
    TrilhaItem,
    User,
    UserRole,
)
from .schemas import UserOut


STORAGE_TABLES: dict[
    str, Type[
        MatrizItem
        | AcaoItem
        | TrilhaItem
        | PdiItem
        | DashboardPreferenceItem
        | ModeracaoItem
        | ModeracaoHistoricoItem
    ]
] = {
    "espen_matriz": MatrizItem,
    "espen_acoes": AcaoItem,
    "espen_trilhas": TrilhaItem,
    "espen_pdi": PdiItem,
    "espen_dashboard": DashboardPreferenceItem,
    "espen_moderacao": ModeracaoItem,
    "espen_moderacao_historico": ModeracaoHistoricoItem,
}


def role_from_acesso(acesso: str) -> UserRole:
    if acesso == "Administrador":
        return UserRole.ADMIN
    if acesso == "Gestor":
        return UserRole.GESTOR
    return UserRole.USER


def acesso_from_role(role: UserRole) -> str:
    if role == UserRole.ADMIN:
        return "Administrador"
    if role == UserRole.GESTOR:
        return "Gestor"
    return "Usuário"


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
    out: list[dict] = []
    for row in rows:
        d = dict(row.data) if row.data else {}
        # Garantir id no objeto (alguns legados tinham só PK na linha; o front depende de data.id)
        rid = getattr(row, "id", None)
        if rid is not None and not d.get("id"):
            d["id"] = rid
        out.append(d)
    return out


def clear_storage(db: Session, key: str) -> None:
    table = STORAGE_TABLES.get(key)
    if not table:
        return
    db.query(table).delete()
    db.commit()
