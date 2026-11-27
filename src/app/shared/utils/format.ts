import { onlyDigits } from './document-mask';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 1.234,56 — "—" quando não há valor. Formatador único de moeda do app. */
export function formatCurrency(value?: number | null): string {
  return value == null ? '—' : currency.format(value);
}

/**
 * "aaaa-mm-dd" (LocalDate) → "dd/mm/aaaa", sem passar por Date: `new Date('2026-12-09')` é meia-noite UTC e no
 * fuso de Recife viraria 08/12.
 */
export function formatLocalDate(value?: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '—';
}

/** "aaaa-mm-ddTHH:mm[:ss]" (LocalDateTime, horário de Recife) → "dd/mm/aaaa HH:mm", sem conversão de fuso. */
export function formatLocalDateTime(value?: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : formatLocalDate(value);
}

/** Máscara progressiva de telefone: (81) 9999-0000 ou (81) 99999-0000. */
export function maskPhone(value?: string | null): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) {
    return `(${ddd}) ${rest}`;
  }
  const split = digits.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Telefone guardado só com dígitos → (81) 99999-0000; vazio vira "—". */
export function formatPhone(value?: string | null): string {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11 ? maskPhone(digits) : value || '—';
}
