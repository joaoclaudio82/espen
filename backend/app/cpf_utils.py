"""Validação e formatação de CPF (11 dígitos)."""


def _only_digits(s: str) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def cpf_is_valid(digits: str) -> bool:
    if len(digits) != 11 or digits == digits[0] * 11:
        return False
    nums = [int(x) for x in digits]
    s1 = sum(nums[i] * (10 - i) for i in range(9))
    r1 = (s1 * 10) % 11
    if r1 == 10:
        r1 = 0
    if r1 != nums[9]:
        return False
    s2 = sum(nums[i] * (11 - i) for i in range(10))
    r2 = (s2 * 10) % 11
    if r2 == 10:
        r2 = 0
    return r2 == nums[10]


def normalize_and_validate_cpf(cpf: str) -> str:
    """Retorna CPF formatado XXX.XXX.XXX-XX ou levanta ValueError."""
    d = _only_digits(cpf)
    if not cpf_is_valid(d):
        raise ValueError("CPF inválido")
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
