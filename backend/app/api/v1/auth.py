from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...core.security import (
    create_access_token,
    hash_password,
    is_sha256_hex,
    sha256_hex_utf8,
    verify_password,
)
from ...db.session import get_db
from ...models import User, UserRole
from ...repositories import users as users_repo
from ...schemas import LoginRequest, TokenResponse, UserCreate, UserOut
from ...services.users import to_user_out
from ..deps import get_current_user


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = users_repo.get_by_cpf(db, payload.cpf)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CPF ou senha inválidos")
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cadastro inativo ou aguardando aprovação do administrador. Contate a equipe ESPEN.",
        )
    wire = (payload.senha or "").strip()
    if not verify_password(wire, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CPF ou senha inválidos")

    # Migração: hashes antigos foram gerados sobre o texto plano; cliente atual envia SHA-256 em hex.
    if not is_sha256_hex(wire):
        user.password_hash = hash_password(sha256_hex_utf8(wire))
        users_repo.save(db, user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=to_user_out(user))


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if users_repo.get_by_cpf(db, payload.cpf):
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    if users_repo.get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Cadastro público: sempre cria com perfil Usuário inativo aguardando aprovação.
    user = User(
        cpf=payload.cpf,
        nome=payload.nome,
        email=payload.email,
        cargo=payload.cargo,
        role=UserRole.USER,
        password_hash=hash_password(payload.senha),
        ativo=False,
    )
    return to_user_out(users_repo.save(db, user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return to_user_out(current_user)
