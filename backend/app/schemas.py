from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from .cpf_utils import normalize_and_validate_cpf


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

    @field_validator("cpf")
    @classmethod
    def cpf_valido(cls, v: str) -> str:
        return normalize_and_validate_cpf(v)


class UserUpdate(BaseModel):
    nome: str | None = None
    email: EmailStr | None = None
    cargo: str | None = None
    acesso: Literal["Administrador", "Gestor", "Usuário"] | None = None
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6)

    @field_validator("acesso", mode="before")
    @classmethod
    def acesso_strip(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class LoginRequest(BaseModel):
    cpf: str
    senha: str

    @field_validator("cpf")
    @classmethod
    def cpf_valido_login(cls, v: str) -> str:
        return normalize_and_validate_cpf(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordChange(BaseModel):
    senha_atual: str = Field(min_length=6)
    nova_senha: str = Field(min_length=6)


class BulkPayload(BaseModel):
    items: list[dict[str, Any]]
