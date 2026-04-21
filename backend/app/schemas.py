from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    id: str
    cpf: str
    nome: str
    email: str
    cargo: str | None = None
    acesso: Literal["Administrador", "Gestor", "Usuário"]
    ativo: bool
    data_registro: datetime


class UserCreate(BaseModel):
    cpf: str = Field(min_length=11, max_length=14)
    nome: str
    email: EmailStr
    cargo: str | None = None
    acesso: Literal["Administrador", "Gestor", "Usuário"] = "Usuário"
    senha: str = Field(min_length=6)


class UserUpdate(BaseModel):
    nome: str | None = None
    email: EmailStr | None = None
    cargo: str | None = None
    acesso: Literal["Administrador", "Gestor", "Usuário"] | None = None
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6)


class LoginRequest(BaseModel):
    cpf: str
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordChange(BaseModel):
    senha_atual: str = Field(min_length=6)
    nova_senha: str = Field(min_length=6)


class BulkPayload(BaseModel):
    items: list[dict[str, Any]]
