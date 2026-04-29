from typing import Any

from pydantic import BaseModel


class BulkPayload(BaseModel):
    items: list[dict[str, Any]]


class ModeracaoAppendPayload(BaseModel):
    """Apêndice atômico de um item à fila de moderação (evita GET filtrado + PUT total)."""

    item: dict[str, Any]
