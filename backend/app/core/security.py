"""Hashing PBKDF2 + emissão/validação de JWT (HS256)."""
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings

PBKDF2_ALGO = "sha256"
PBKDF2_ITERATIONS = 120_000

_SHA256_HEX_RE = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)


def sha256_hex_utf8(plain: str) -> str:
    """SHA-256 da senha em UTF-8, hex minúsculo (formato enviado pelo cliente em vez de texto plano)."""
    return hashlib.sha256(plain.encode("utf-8")).hexdigest().lower()


def is_sha256_hex(s: str) -> bool:
    return bool(s and _SHA256_HEX_RE.match(s.strip()))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGO, password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_{PBKDF2_ALGO}${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iteration_str, salt, expected = password_hash.split("$", 3)
        if algo != f"pbkdf2_{PBKDF2_ALGO}":
            return False
        iterations = int(iteration_str)
    except ValueError:
        return False

    actual = hashlib.pbkdf2_hmac(PBKDF2_ALGO, password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
    return hmac.compare_digest(actual, expected)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def parse_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
