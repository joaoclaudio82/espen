"""Fábrica de routers CRUD para os baús JSON (matriz/ações/trilhas/PDI)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models import User
from ...repositories import storage as storage_repo
from ..deps import get_current_user, require_admin


def make_crud_router(*, prefix: str, tag: str, storage_key: str) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get("")
    def list_items(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
        return storage_repo.list_items(db, storage_key)

    @router.post("")
    def create_item(payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
        return storage_repo.upsert_item(db, storage_key, payload)

    @router.put("/{item_id}")
    def update_item(item_id: str, payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
        if not storage_repo.get_item(db, storage_key, item_id):
            raise HTTPException(status_code=404, detail="Item não encontrado")
        payload["id"] = item_id
        return storage_repo.upsert_item(db, storage_key, payload)

    @router.delete("/{item_id}")
    def delete_item(item_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
        if not storage_repo.delete_item(db, storage_key, item_id):
            raise HTTPException(status_code=404, detail="Item não encontrado")
        return {"ok": True}

    return router
