/** Aplica máscara `XXX.XXX.XXX-XX` enquanto o usuário digita. */
export function maskCPF(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
  input.value = v;
}

/** Validação de CPF (algoritmo dos dígitos verificadores). */
export function validateCPF(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const nums = d.split('').map(Number);
  const s1 = nums.slice(0, 9).reduce((acc, n, i) => acc + n * (10 - i), 0);
  let r1 = (s1 * 10) % 11;
  if (r1 === 10) r1 = 0;
  if (r1 !== nums[9]) return false;
  const s2 = nums.slice(0, 10).reduce((acc, n, i) => acc + n * (11 - i), 0);
  let r2 = (s2 * 10) % 11;
  if (r2 === 10) r2 = 0;
  return r2 === nums[10];
}
