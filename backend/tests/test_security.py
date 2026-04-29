from app.core.security import (
    create_access_token,
    hash_password,
    is_sha256_hex,
    parse_access_token,
    sha256_hex_utf8,
    verify_password,
)


def test_pbkdf2_roundtrip():
    h = hash_password("segredo")
    assert verify_password("segredo", h)
    assert not verify_password("outra", h)


def test_pbkdf2_aceita_apenas_formato_proprio():
    assert not verify_password("x", "formato-invalido")


def test_sha256_hex():
    digest = sha256_hex_utf8("admin123")
    assert len(digest) == 64
    assert digest == digest.lower()
    assert is_sha256_hex(digest)
    assert not is_sha256_hex("nao-é-sha")


def test_jwt_roundtrip():
    token = create_access_token("user-id-1")
    assert parse_access_token(token) == "user-id-1"


def test_jwt_invalido_retorna_none():
    assert parse_access_token("token-falso") is None
