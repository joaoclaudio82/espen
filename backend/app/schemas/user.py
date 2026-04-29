from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from ..core.cpf import normalize_and_validate_cpf


Acesso = Literal["Administrador", "Gestor", "Usuário"]


class UserOut(BaseModel):
    id: str
    cpf: str
    nome: str
    email: str
    cargo: str | None = None
    acesso: Acesso
    ativo: bool
    data_registro: datetime


class UserDirectoryEntry(BaseModel):
    """Resumo público para resolver autores (planos de ensino) sem expor e-mail/CPF."""

    id: str
    nome: str
    cargo: str | None = None
    acesso: Acesso
    ativo: bool


class UserCreate(BaseModel):
    cpf: str = Field(min_length=11, max_length=14)
    nome: str
    email: EmailStr
    cargo: str | None = None
    acesso: Acesso = "Usuário"
    senha: str = Field(min_length=6)

    @field_validator("cpf")
    @classmethod
    def cpf_valido(cls, v: str) -> str:
        return normalize_and_validate_cpf(v)


class UserUpdate(BaseModel):
    nome: str | None = None
    email: EmailStr | None = None
    cargo: str | None = None
    acesso: Acesso | None = None
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
