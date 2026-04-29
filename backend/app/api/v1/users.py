from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models import User
from ...repositories import users as users_repo
from ...schemas import PasswordChange, UserCreate, UserDirectoryEntry, UserOut, UserUpdate
from ...services import users as users_service
from ..deps import get_current_user, require_admin


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/directory", response_model=list[UserDirectoryEntry])
def get_users_directory(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista nome/cargo/acesso para qualquer autenticado — não expõe e-mail/CPF."""
    return [
        UserDirectoryEntry(
            id=u.id,
            nome=u.nome,
            cargo=u.cargo,
            acesso=users_service.acesso_from_role(u.role),
            ativo=u.ativo,
        )
        for u in users_repo.list_all(db)
    ]


@router.get("", response_model=list[UserOut])
def get_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [users_service.to_user_out(u) for u in users_repo.list_all(db)]


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if users_repo.get_by_cpf(db, payload.cpf):
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    if users_repo.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    return users_service.to_user_out(users_service.create_user_admin(db, payload))


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = users_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return users_service.to_user_out(users_service.update_user(db, user, payload))


@router.patch("/{user_id}/toggle", response_model=UserOut)
def toggle_user(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = users_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return users_service.to_user_out(users_service.toggle_active(db, user))


@router.post("/change-password")
def change_password(payload: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = users_repo.get_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if not users_service.change_password(db, user, payload.senha_atual, payload.nova_senha):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    return {"message": "Senha alterada com sucesso"}
