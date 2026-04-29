"""Tabelas relacionais reservadas — preservadas no schema mas não usadas pelos routers atuais.

Mantidas para compatibilidade com o banco existente em produção.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db.session import Base


class TrilhaAcao(Base):
    __tablename__ = "trilha_acoes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trilha_id: Mapped[str] = mapped_column(String(36), index=True)
    acao_id: Mapped[str] = mapped_column(String(36), index=True)
    ordem: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PdiProgresso(Base):
    __tablename__ = "pdi_progresso"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pdi_id: Mapped[str] = mapped_column(String(36), index=True)
    acao_id: Mapped[str] = mapped_column(String(36), index=True)
    concluida: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
