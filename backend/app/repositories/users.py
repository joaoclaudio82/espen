from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User


def list_all(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.nome.asc())).all())


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_by_cpf(db: Session, cpf: str) -> User | None:
    return db.scalar(select(User).where(User.cpf == cpf))


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def save(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
