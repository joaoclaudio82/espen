"""Cria/atualiza o admin padrão durante o startup da API."""
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import hash_password, sha256_hex_utf8, verify_password
from ..models import User, UserRole
from ..repositories import users as users_repo


def ensure_admin_user(db: Session) -> None:
    if users_repo.get_by_cpf(db, settings.admin_cpf):
        return
    admin = User(
        cpf=settings.admin_cpf,
        nome=settings.admin_nome,
        email=settings.admin_email,
        cargo=settings.admin_cargo,
        role=UserRole.ADMIN,
        password_hash=hash_password(sha256_hex_utf8(settings.admin_password)),
        ativo=True,
    )
    db.add(admin)
    db.commit()


def upgrade_default_admin_password_wire(db: Session) -> None:
    """Migra o hash do admin padrão de PBKDF2(senha) para PBKDF2(SHA-256(senha)).

    O cliente atual envia SHA-256 hex no lugar do texto plano; instalações antigas
    ainda guardam o hash da senha em texto plano e quebrariam no login.
    """
    user = users_repo.get_by_cpf(db, settings.admin_cpf)
    if not user:
        return
    plain = (settings.admin_password or "").strip()
    if not plain:
        return
    if verify_password(plain, user.password_hash):
        user.password_hash = hash_password(sha256_hex_utf8(plain))
        users_repo.save(db, user)
