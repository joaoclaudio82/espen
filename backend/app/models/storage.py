"""Tabelas-baú em JSONB — uma linha por item de domínio.

Foram mantidas como blobs JSON para compatibilidade com o front (que envia
o objeto completo). Refator futuro pode tipar colunas conforme cada agregado.
"""
from datetime import datetime

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db.session import Base


class _JsonBlobMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MatrizItem(_JsonBlobMixin, Base):
    __tablename__ = "matriz_items"


class AcaoItem(_JsonBlobMixin, Base):
    __tablename__ = "acoes_items"


class TrilhaItem(_JsonBlobMixin, Base):
    __tablename__ = "trilhas_items"


class PdiItem(_JsonBlobMixin, Base):
    __tablename__ = "pdi_items"


class DashboardPreferenceItem(_JsonBlobMixin, Base):
    __tablename__ = "dashboard_preferences"


class ModeracaoItem(_JsonBlobMixin, Base):
    __tablename__ = "moderacao_items"


class ModeracaoHistoricoItem(_JsonBlobMixin, Base):
    """Decisões de aprovação/rejeição da fila de gestores — um JSON por linha."""

    __tablename__ = "moderacao_historico_items"
