from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import (
    STORAGE_TABLES,
    append_moderacao_item,
    clear_storage,
    read_storage_items,
    replace_storage_items,
)
from ..database import get_db
from ..deps import get_current_user
from ..models import UserRole
from ..models import User
from ..schemas import BulkPayload, ModeracaoAppendPayload


router = APIRouter(prefix="/api/storage", tags=["storage"])


def _filter_moderacao_items_for_non_admin(items: list[dict], user: User) -> list[dict]:
    uid = str(user.id)
    return [it for it in items if str(it.get("solicitante_id")) == uid]


@router.post("/{key}/append")
def append_storage_item(
    key: str,
    payload: ModeracaoAppendPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if key != "espen_moderacao":
        raise HTTPException(status_code=404, detail="Append só é suportado para espen_moderacao")
    item = payload.item
    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail="Item inválido")
    if user.role == UserRole.ADMIN:
        append_moderacao_item(db, item)
        return {"ok": True}
    if user.role not in (UserRole.GESTOR, UserRole.USER):
        raise HTTPException(status_code=403, detail="Sem permissão para enfileirar moderação")
    if str(item.get("solicitante_id")) != str(user.id):
        raise HTTPException(status_code=403, detail="O solicitante do item deve ser o usuário autenticado")
    append_moderacao_item(db, item)
    return {"ok": True}


@router.get("/{key}")
def get_storage_items(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if key == "espen_users":
        raise HTTPException(status_code=400, detail="Use endpoints /api/users para usuários")
    if key not in STORAGE_TABLES:
        raise HTTPException(status_code=404, detail="Chave de storage não suportada")
    items = read_storage_items(db, key)
    if key == "espen_moderacao_historico":
        if user.role == UserRole.ADMIN:
            return {"items": items}
        if user.role in (UserRole.GESTOR, UserRole.USER):
            return {"items": _filter_moderacao_items_for_non_admin(items, user)}
        raise HTTPException(status_code=403, detail="Acesso restrito")
    if key == "espen_moderacao":
        if user.role == UserRole.ADMIN:
            return {"items": items}
        if user.role in (UserRole.GESTOR, UserRole.USER):
            return {"items": _filter_moderacao_items_for_non_admin(items, user)}
        raise HTTPException(status_code=403, detail="Acesso restrito")
    return {"items": items}


def _can_write_storage(key: str, user: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if key == "espen_dashboard":
        return True
    if key == "espen_moderacao" and user.role == UserRole.GESTOR:
        return True
    return False


@router.put("/{key}")
def put_storage_items(key: str, payload: BulkPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if key not in STORAGE_TABLES:
        raise HTTPException(status_code=404, detail="Chave de storage não suportada")
    if not _can_write_storage(key, current_user):
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    replace_storage_items(db, key, payload.items)
    return {"ok": True}


@router.delete("/{key}")
def delete_storage_items(key: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if key not in STORAGE_TABLES:
        raise HTTPException(status_code=404, detail="Chave de storage não suportada")
    if not _can_write_storage(key, current_user):
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    clear_storage(db, key)
    return {"ok": True}
