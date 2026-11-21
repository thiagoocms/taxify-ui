const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 1.234,56 — "—" quando não há valor. Formatador único de moeda do app. */
export function formatCurrency(value?: number | null): string {
  return value == null ? '—' : currency.format(value);
}
