import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import MatrizItem, User


router = APIRouter(prefix="/api/matriz", tags=["matriz"])


@router.get("")
def list_matriz(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MatrizItem).order_by(MatrizItem.created_at.asc())).all()
    return [row.data for row in rows]


@router.post("")
def create_matriz(payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item_id = payload.get("id") or str(uuid.uuid4())
    payload["id"] = item_id
    row = MatrizItem(id=item_id, data=payload)
    db.add(row)
    db.commit()
    return payload


@router.put("/{item_id}")
def update_matriz(item_id: str, payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.get(MatrizItem, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    payload["id"] = item_id
    row.data = payload
    db.add(row)
    db.commit()
    return payload


@router.delete("/{item_id}")
def delete_matriz(item_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.get(MatrizItem, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}
