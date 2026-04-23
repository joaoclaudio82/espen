from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..crud import acesso_from_role, list_users, role_from_acesso, to_user_out
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import User
from ..schemas import PasswordChange, UserCreate, UserDirectoryEntry, UserOut, UserUpdate
from ..security import hash_password, verify_password


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/directory", response_model=list[UserDirectoryEntry])
def get_users_directory(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista id/nome/acesso para resolução de autores (planos de ensino, etc.) sem expor e-mail/CPF."""
    return [
        UserDirectoryEntry(
            id=u.id,
            nome=u.nome,
            cargo=u.cargo,
            acesso=acesso_from_role(u.role),
            ativo=u.ativo,
        )
        for u in list_users(db)
    ]


@router.get("", response_model=list[UserOut])
def get_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [to_user_out(user) for user in list_users(db)]


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.cpf == payload.cpf)):
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(
        cpf=payload.cpf,
        nome=payload.nome,
        email=payload.email,
        cargo=payload.cargo,
        role=role_from_acesso(payload.acesso),
        password_hash=hash_password(payload.senha),
        ativo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_user_out(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # model_dump(exclude_unset=True): só campos enviados no JSON (PUT parcial seguro)
    data = payload.model_dump(exclude_unset=True)

    if "nome" in data and data["nome"] is not None:
        user.nome = data["nome"]
    if "email" in data and data["email"] is not None:
        user.email = data["email"]
    if "cargo" in data:
        user.cargo = data["cargo"]
    if "ativo" in data and data["ativo"] is not None:
        user.ativo = data["ativo"]
    if "acesso" in data and data["acesso"] is not None:
        user.role = role_from_acesso(data["acesso"])
        flag_modified(user, "role")
    if data.get("senha"):
        user.password_hash = hash_password(data["senha"])

    db.commit()
    db.refresh(user)
    return to_user_out(user)


@router.patch("/{user_id}/toggle", response_model=UserOut)
def toggle_user(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.ativo = not user.ativo
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_user_out(user)


@router.post("/change-password")
def change_password(payload: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if not verify_password(payload.senha_atual, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    user.password_hash = hash_password(payload.nova_senha)
    db.add(user)
    db.commit()
    return {"message": "Senha alterada com sucesso"}
