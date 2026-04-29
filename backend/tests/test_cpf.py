import pytest

from app.core.cpf import cpf_is_valid, normalize_and_validate_cpf


def test_cpf_valido():
    assert cpf_is_valid("72792736968")


def test_cpf_repetido_invalido():
    assert not cpf_is_valid("11111111111")


def test_cpf_curto_invalido():
    assert not cpf_is_valid("123")


def test_normalize_aceita_formatado():
    assert normalize_and_validate_cpf("727.927.369-68") == "727.927.369-68"


def test_normalize_aceita_so_digitos():
    assert normalize_and_validate_cpf("72792736968") == "727.927.369-68"


def test_normalize_rejeita_invalido():
    with pytest.raises(ValueError):
        normalize_and_validate_cpf("123.456.789-00")
