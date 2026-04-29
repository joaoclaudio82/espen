"""Acesso às tabelas-baú JSON (matriz, ações, trilhas, PDI, dashboard, moderação)."""
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    AcaoItem,
    DashboardPreferenceItem,
    MatrizItem,
    ModeracaoHistoricoItem,
    ModeracaoItem,
    PdiItem,
    TrilhaItem,
)


JsonItemModel = type[
    MatrizItem
    | AcaoItem
    | TrilhaItem
    | PdiItem
    | DashboardPreferenceItem
    | ModeracaoItem
    | ModeracaoHistoricoItem
]


STORAGE_TABLES: dict[str, JsonItemModel] = {
    "espen_matriz": MatrizItem,
    "espen_acoes": AcaoItem,
    "espen_trilhas": TrilhaItem,
    "espen_pdi": PdiItem,
    "espen_dashboard": DashboardPreferenceItem,
    "espen_moderacao": ModeracaoItem,
    "espen_moderacao_historico": ModeracaoHistoricoItem,
}


def is_known_key(key: str) -> bool:
    return key in STORAGE_TABLES


def list_items(db: Session, key: str) -> list[dict[str, Any]]:
    table = STORAGE_TABLES.get(key)
    if not table:
        return []
    rows = db.scalars(select(table).order_by(table.created_at.asc())).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        d = dict(row.data) if row.data else {}
        rid = getattr(row, "id", None)
        if rid is not None and not d.get("id"):
            d["id"] = rid
        out.append(d)
    return out


def replace_all(db: Session, key: str, items: list[dict[str, Any]]) -> None:
    table = STORAGE_TABLES.get(key)
    if not table:
        return
    db.query(table).delete()
    for item in items:
        item_id = item.get("id") or str(uuid.uuid4())
        item["id"] = item_id
        db.add(table(id=item_id, data=item))
    db.commit()


def clear(db: Session, key: str) -> None:
    table = STORAGE_TABLES.get(key)
    if not table:
        return
    db.query(table).delete()
    db.commit()


def append_moderacao(db: Session, item: dict[str, Any]) -> None:
    row = dict(item)
    item_id = row.get("id") or str(uuid.uuid4())
    row["id"] = item_id
    db.add(ModeracaoItem(id=item_id, data=row))
    db.commit()


def get_item(db: Session, key: str, item_id: str):
    table = STORAGE_TABLES.get(key)
    if not table:
        return None
    return db.get(table, item_id)


def upsert_item(db: Session, key: str, payload: dict[str, Any]) -> dict[str, Any]:
    table = STORAGE_TABLES.get(key)
    if not table:
        raise KeyError(key)
    item_id = payload.get("id") or str(uuid.uuid4())
    payload["id"] = item_id
    existing = db.get(table, item_id)
    if existing:
        existing.data = payload
        db.add(existing)
    else:
        db.add(table(id=item_id, data=payload))
    db.commit()
    return payload


def delete_item(db: Session, key: str, item_id: str) -> bool:
    table = STORAGE_TABLES.get(key)
    if not table:
        return False
    row = db.get(table, item_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
