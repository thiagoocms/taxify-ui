/** CPF/CNPJ: só os dígitos, máscara enquanto digita, formatação para exibição e conferência do DV. */

export function onlyDigits(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Máscara progressiva para um campo de CPF/CNPJ: até 11 dígitos segue o CPF
 * (000.000.000-00), daí em diante o CNPJ (00.000.000/0000-00). No máximo 14 dígitos.
 */
export function maskDocument(value?: string | null): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** CPF (11 dígitos) ou CNPJ (14) formatado; qualquer outro valor volta como veio. */
export function formatDocument(value?: string | null): string {
  const digits = onlyDigits(value);
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value ?? '';
}

/** Máscara de CNPJ enquanto digita: 00.000.000/0000-00 (sem passar pelo formato de CPF nos primeiros dígitos). */
export function maskCnpj(value?: string | null): string {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** Máscara de CPF enquanto digita: 000.000.000-00. */
export function maskCpf(value?: string | null): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** Confere o DV do CNPJ (só ajuda o usuário: o backend é a fonte e recusa o que for inválido). */
export function isValidCnpj(value?: string | null): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }
  const check = (length: number): number => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Confere o DV do CPF. */
export function isValidCpf(value?: string | null): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  const check = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}
