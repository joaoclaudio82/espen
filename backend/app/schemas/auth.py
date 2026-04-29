from pydantic import BaseModel, Field, field_validator

from ..core.cpf import normalize_and_validate_cpf
from .user import UserOut


class LoginRequest(BaseModel):
    cpf: str
    senha: str = Field(
        ...,
        description=(
            "SHA-256 (hex minúsculo, 64 chars) da senha em UTF-8. "
            "Compatível com clientes legados que enviam o texto plano (caminho de migração)."
        ),
    )

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
