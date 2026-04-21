from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import STORAGE_TABLES, clear_storage, read_storage_items, replace_storage_items
from ..database import get_db
from ..deps import get_current_user
from ..models import UserRole
from ..models import User
from ..schemas import BulkPayload


router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/{key}")
def get_storage_items(key: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if key == "espen_users":
        raise HTTPException(status_code=400, detail="Use endpoints /api/users para usuários")
    if key not in STORAGE_TABLES:
        raise HTTPException(status_code=404, detail="Chave de storage não suportada")
    return {"items": read_storage_items(db, key)}


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
