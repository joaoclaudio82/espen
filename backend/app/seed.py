from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import User, UserRole
from .security import hash_password, sha256_hex_utf8, verify_password


def ensure_admin_user(db: Session) -> None:
    existing = db.scalar(select(User).where(User.cpf == settings.admin_cpf))
    if existing:
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
    """
    Se o admin padrão ainda estiver com PBKDF2 sobre a senha em texto plano (instalações antigas),
    regrava o hash para PBKDF2(SHA256_hex(senha)), alinhado ao cliente atual.
    """
    user = db.scalar(select(User).where(User.cpf == settings.admin_cpf))
    if not user:
        return
    plain = (settings.admin_password or "").strip()
    if not plain:
        return
    if verify_password(plain, user.password_hash):
        user.password_hash = hash_password(sha256_hex_utf8(plain))
        db.add(user)
        db.commit()
