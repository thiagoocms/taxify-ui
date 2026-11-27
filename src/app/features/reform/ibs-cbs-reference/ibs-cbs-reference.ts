import {
  IBS_CBS_RATE_LIMITS,
  IBS_CBS_RATE_STATUS_LABELS,
  IbsCbsRateDTO,
  IbsCbsRatesResponseDTO,
} from '../../../core/models/ibs-cbs-rate.model';
import { formatPercent } from '../../../shared/utils/format';

/**
 * Regras de exibição da referência de IBS/CBS (F-AL-1 e F-AL-2). Nada aqui decide achado: quem diz se o ano gera
 * achado é o `generatesFindings` do backend (AL-RN-02) e o texto do aviso vem pronto em `warnings` (AL-RN-05).
 */

/** Um aviso por ano sem alíquota oficial: o texto do backend quando ele mandou para o ano, senão o da AL-RN-05. */
export interface MissingLawNotice {
  year: number;
  text: string;
}

/** Texto da AL-RN-05, só de reserva: o backend manda os avisos do ano corrente e do seguinte prontos. */
export function missingLawFallbackText(year: number): string {
  return `${year}: sem alíquota oficial cadastrada. A conferência não compara as alíquotas de IBS/CBS das notas desse ano.`;
}

/** "Referência de 2026: CBS 0,9%, IBS UF 0,1%, IBS Mun 0% (Lei)". Alíquota não informada (PENDING) vira "—". */
export function rateReferenceText(row: IbsCbsRateDTO): string {
  return (
    `Referência de ${row.year}: CBS ${formatPercent(row.cbsRate)}, IBS UF ${formatPercent(row.ibsStateRate)}, ` +
    `IBS Mun ${formatPercent(row.ibsMunicipalRate)} (${IBS_CBS_RATE_STATUS_LABELS[row.status] ?? row.status})`
  );
}

/** Ano de "aaaa-mm-dd" (ou de "aaaa-mm-ddTHH:mm..."), sem passar por Date. */
export function yearOf(date: string | null | undefined): number | null {
  const match = /^(\d{4})-\d{2}/.exec(date ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Anos do período conferido em que a tabela vale (a partir de 2026, a primeira linha possível da AL-RN-03). Período
 * invertido ou sem data: só o ano que der para ler. No máximo os anos da tabela (2026 a 2040).
 */
export function yearsInPeriod(from: string | null | undefined, to: string | null | undefined): number[] {
  const start = yearOf(from) ?? yearOf(to);
  const end = yearOf(to) ?? start;
  if (start == null || end == null) return [];
  const first = Math.max(Math.min(start, end), IBS_CBS_RATE_LIMITS.minYear);
  const last = Math.min(Math.max(start, end), IBS_CBS_RATE_LIMITS.maxYear);
  const years: number[] = [];
  for (let year = first; year <= last; year++) years.push(year);
  return years;
}

/** Linha de cada ano, se houver. */
export function rowOf(response: IbsCbsRatesResponseDTO | null, year: number): IbsCbsRateDTO | null {
  return response?.years.find((row) => row.year === year) ?? null;
}

/**
 * Anos do período sem alíquota que gere achado (AL-RN-06 b): sem linha, ou linha com `generatesFindings = false`.
 * Sem a resposta da API, nenhum aviso (a tela não afirma o que não sabe).
 */
export function missingLawNotices(response: IbsCbsRatesResponseDTO | null, years: number[]): MissingLawNotice[] {
  if (!response) return [];
  return years
    .filter((year) => rowOf(response, year)?.generatesFindings !== true)
    .map((year) => ({
      year,
      text: response.warnings.find((warning) => warning.year === year && warning.type === 'NO_LAW')?.text ?? missingLawFallbackText(year),
    }));
}
