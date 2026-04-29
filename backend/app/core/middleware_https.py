"""HTTPS: redirecionamento atrás de proxy (X-Forwarded-Proto) + cabeçalho HSTS."""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from .config import settings


def _forwarded_proto(request: Request) -> str:
    raw = (request.headers.get("x-forwarded-proto") or "").strip()
    if not raw:
        return ""
    return raw.split(",")[0].strip().lower()


class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.effective_force_https:
            return await call_next(request)

        proto = _forwarded_proto(request)
        if proto == "http":
            host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
            if host:
                path = request.url.path
                if request.url.query:
                    path = f"{path}?{request.url.query}"
                return RedirectResponse(f"https://{host}{path}", status_code=308)

        response = await call_next(request)
        if proto == "https" or request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response
