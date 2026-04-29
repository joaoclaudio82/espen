"""initial schema (users + json blobs + reservas)

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-29 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0001_initial"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_USER_ROLE = sa.Enum("ADMIN", "GESTOR", "USER", name="userrole")


def _create_json_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def upgrade() -> None:
    _USER_ROLE.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("cpf", sa.String(length=14), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("cargo", sa.String(length=255), nullable=True),
        sa.Column("role", _USER_ROLE, nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("data_registro", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("cpf", name="uq_users_cpf"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_cpf", "users", ["cpf"])
    op.create_index("ix_users_email", "users", ["email"])

    for tbl in (
        "matriz_items",
        "acoes_items",
        "trilhas_items",
        "pdi_items",
        "dashboard_preferences",
        "moderacao_items",
        "moderacao_historico_items",
    ):
        _create_json_table(tbl)

    op.create_table(
        "trilha_acoes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("trilha_id", sa.String(length=36), nullable=False),
        sa.Column("acao_id", sa.String(length=36), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_trilha_acoes_trilha_id", "trilha_acoes", ["trilha_id"])
    op.create_index("ix_trilha_acoes_acao_id", "trilha_acoes", ["acao_id"])

    op.create_table(
        "pdi_progresso",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("pdi_id", sa.String(length=36), nullable=False),
        sa.Column("acao_id", sa.String(length=36), nullable=False),
        sa.Column("concluida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_pdi_progresso_pdi_id", "pdi_progresso", ["pdi_id"])
    op.create_index("ix_pdi_progresso_acao_id", "pdi_progresso", ["acao_id"])


def downgrade() -> None:
    for ix, tbl in (
        ("ix_pdi_progresso_acao_id", "pdi_progresso"),
        ("ix_pdi_progresso_pdi_id", "pdi_progresso"),
    ):
        op.drop_index(ix, table_name=tbl)
    op.drop_table("pdi_progresso")
    for ix, tbl in (
        ("ix_trilha_acoes_acao_id", "trilha_acoes"),
        ("ix_trilha_acoes_trilha_id", "trilha_acoes"),
    ):
        op.drop_index(ix, table_name=tbl)
    op.drop_table("trilha_acoes")
    for tbl in (
        "moderacao_historico_items",
        "moderacao_items",
        "dashboard_preferences",
        "pdi_items",
        "trilhas_items",
        "acoes_items",
        "matriz_items",
    ):
        op.drop_table(tbl)
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_cpf", table_name="users")
    op.drop_table("users")
    _USER_ROLE.drop(op.get_bind(), checkfirst=True)
