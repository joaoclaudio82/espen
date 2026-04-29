"""Re-exports — mantém `from app.models import X` funcionando após o split."""
from .user import User, UserRole
from .storage import (
    AcaoItem,
    DashboardPreferenceItem,
    MatrizItem,
    ModeracaoHistoricoItem,
    ModeracaoItem,
    PdiItem,
    TrilhaItem,
)
from .relations import PdiProgresso, TrilhaAcao

__all__ = [
    "User",
    "UserRole",
    "MatrizItem",
    "AcaoItem",
    "TrilhaItem",
    "PdiItem",
    "DashboardPreferenceItem",
    "ModeracaoItem",
    "ModeracaoHistoricoItem",
    "TrilhaAcao",
    "PdiProgresso",
]
