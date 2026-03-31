from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..crud import role_from_acesso, to_user_out
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.cpf == payload.cpf))
    if not user or not user.ativo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CPF ou senha inválidos")
    if not verify_password(payload.senha, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CPF ou senha inválidos")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=to_user_out(user))


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
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


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return to_user_out(current_user)
