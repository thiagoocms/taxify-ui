/** CPF/CNPJ: só os dígitos, máscara enquanto digita e formatação para exibição. */

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
