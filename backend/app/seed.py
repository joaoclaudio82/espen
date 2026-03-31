from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import User, UserRole
from .security import hash_password


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
        password_hash=hash_password(settings.admin_password),
        ativo=True,
    )
    db.add(admin)
    db.commit()
