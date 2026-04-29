from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..core.security import hash_password, verify_password
from ..models import User, UserRole
from ..repositories import users as users_repo
from ..schemas import UserCreate, UserOut, UserUpdate


def role_from_acesso(acesso: str) -> UserRole:
    if acesso == "Administrador":
        return UserRole.ADMIN
    if acesso == "Gestor":
        return UserRole.GESTOR
    return UserRole.USER


def acesso_from_role(role: UserRole) -> str:
    if role == UserRole.ADMIN:
        return "Administrador"
    if role == UserRole.GESTOR:
        return "Gestor"
    return "Usuário"


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        cpf=user.cpf,
        nome=user.nome,
        email=user.email,
        cargo=user.cargo,
        acesso=acesso_from_role(user.role),
        ativo=user.ativo,
        data_registro=user.data_registro,
    )


def create_user_admin(db: Session, payload: UserCreate) -> User:
    user = User(
        cpf=payload.cpf,
        nome=payload.nome,
        email=payload.email,
        cargo=payload.cargo,
        role=role_from_acesso(payload.acesso),
        password_hash=hash_password(payload.senha),
        ativo=True,
    )
    return users_repo.save(db, user)


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)

    if data.get("nome") is not None:
        user.nome = data["nome"]
    if data.get("email") is not None:
        user.email = data["email"]
    if "cargo" in data:
        user.cargo = data["cargo"]
    if data.get("ativo") is not None:
        user.ativo = data["ativo"]
    if data.get("acesso") is not None:
        user.role = role_from_acesso(data["acesso"])
        flag_modified(user, "role")
    if data.get("senha"):
        user.password_hash = hash_password(data["senha"])

    return users_repo.save(db, user)


def toggle_active(db: Session, user: User) -> User:
    user.ativo = not user.ativo
    return users_repo.save(db, user)


def change_password(db: Session, user: User, current_plain: str, new_plain: str) -> bool:
    if not verify_password(current_plain, user.password_hash):
        return False
    user.password_hash = hash_password(new_plain)
    users_repo.save(db, user)
    return True
