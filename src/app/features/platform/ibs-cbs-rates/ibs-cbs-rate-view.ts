import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { apiErrorBody, apiErrorCode, apiErrorMessage, httpStatusOf } from '../../../core/models/api-error.model';
import {
  IBS_CBS_RATE_ERROR_MESSAGES,
  IBS_CBS_RATE_ERRORS,
  IBS_CBS_RATE_LIMITS,
  IbsCbsRateDTO,
  IbsCbsRateChangeDTO,
  IbsCbsRateField,
  IbsCbsRateStatus,
  IBS_CBS_RATE_STATUS_LABELS,
} from '../../../core/models/ibs-cbs-rate.model';
import { formatPercent } from '../../../shared/utils/format';

/** Campos do formulário de alíquotas (os mesmos nomes do corpo do PUT). */
export type IbsCbsRateFormField = 'year' | 'status' | IbsCbsRateField | 'legalBasis' | 'sourceUrl';

export const RATE_FIELDS: IbsCbsRateField[] = ['cbsRate', 'ibsStateRate', 'ibsMunicipalRate'];

/**
 * O que o status exige (AL-RN-03): `LAW` e `ESTIMATE` exigem as três alíquotas; `LAW` exige fundamento e link.
 * O backend confere de novo; o formulário só marca antes de enviar.
 */
export function rateFormRules(status: IbsCbsRateStatus | '' | null): { ratesRequired: boolean; basisRequired: boolean } {
  return { ratesRequired: status === 'LAW' || status === 'ESTIMATE', basisRequired: status === 'LAW' };
}

const RATE_TEXT = /^\d{1,3}([.,]\d{1,4})?$/;

/**
 * Texto digitado → número em %, aceitando vírgula ("0,9" = 0.9). Vazio = null. Fora do formato (mais de 4 casas,
 * letras) = NaN, para o validador recusar: nunca arredonda (AL-RN-03).
 */
export function parseRate(text: string | number | null | undefined): number | null {
  if (text == null) return null;
  const value = String(text).trim();
  if (!value) return null;
  if (!RATE_TEXT.test(value)) return Number.NaN;
  return Number(value.replace(',', '.'));
}

/** Número da API → texto do campo, com vírgula e sem zeros à direita (0.9000 → "0,9"). */
export function rateInputText(value: number | null | undefined): string {
  return value == null ? '' : String(value).replace('.', ',');
}

/** 0 ≤ x ≤ 100, até 4 casas (vazio passa: o obrigatório é outro validador). */
export const rateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = parseRate(control.value);
  if (value == null) return null;
  return Number.isNaN(value) || value < 0 || value > 100
    ? { server: IBS_CBS_RATE_ERROR_MESSAGES[IBS_CBS_RATE_ERRORS.rateInvalid] }
    : null;
};

/** Link do ato: começa com https:// (AL-RN-03). */
export const httpsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  return value && !value.startsWith('https://') ? { server: 'O link do ato precisa começar com https://.' } : null;
};

/** Como a tela mostra a recusa do PUT: no campo, no topo do formulário ou como conflito (recarrega). */
export interface RateSaveErrorView {
  message: string;
  /** Campos marcados com a mensagem. */
  fields: IbsCbsRateFormField[];
  conflict: boolean;
}

export function rateSaveErrorView(error: unknown): RateSaveErrorView {
  const code = apiErrorCode(error);
  const message = apiErrorMessage(error) ?? (code ? IBS_CBS_RATE_ERROR_MESSAGES[code] : undefined);
  switch (code) {
    case IBS_CBS_RATE_ERRORS.conflict:
      return { message: message!, fields: [], conflict: true };
    case IBS_CBS_RATE_ERRORS.rateInvalid: {
      const field = apiErrorBody(error)?.['invalidField'];
      const fields = RATE_FIELDS.includes(field as IbsCbsRateField) ? [field as IbsCbsRateField] : RATE_FIELDS;
      return { message: message!, fields, conflict: false };
    }
    case IBS_CBS_RATE_ERRORS.basisRequired:
    case IBS_CBS_RATE_ERRORS.basisInvalid:
      return { message: message!, fields: ['legalBasis', 'sourceUrl'], conflict: false };
    case IBS_CBS_RATE_ERRORS.yearInvalid:
      return { message: message!, fields: ['year'], conflict: false };
    case IBS_CBS_RATE_ERRORS.statusInvalid:
      return { message: message!, fields: ['status'], conflict: false };
    // PUT de edição de um ano que não existe mais: recarregar mostra a tabela atual.
    case IBS_CBS_RATE_ERRORS.notFound:
      return { message: `${message} Recarregue a lista.`, fields: [], conflict: false };
  }
  const status = httpStatusOf(error);
  if (status === 403) {
    return { message: 'Só o administrador da plataforma (CS Hub) altera as alíquotas.', fields: [], conflict: false };
  }
  if (status === 0) {
    return { message: 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.', fields: [], conflict: false };
  }
  return { message: message ?? 'Não foi possível salvar. Tente de novo.', fields: [], conflict: false };
}

/** Erro ao carregar a tabela ou o histórico. */
export function rateLoadErrorText(error: unknown, what: 'list' | 'history'): string {
  const status = httpStatusOf(error);
  if (status === 403) return 'Só o administrador da plataforma (CS Hub) abre o cadastro de alíquotas.';
  if (status === 404 && what === 'history') {
    return apiErrorMessage(error) ?? IBS_CBS_RATE_ERROR_MESSAGES[IBS_CBS_RATE_ERRORS.notFound];
  }
  if (status === 0) return 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.';
  return what === 'list' ? 'Não foi possível carregar as alíquotas. Tente de novo.' : 'Não foi possível carregar o histórico. Tente de novo.';
}

/** "CBS: 8,8% → 9%" para cada campo que mudou no evento; na criação, o valor gravado ("CBS: 8,8%"). */
export function changeLines(event: IbsCbsRateChangeDTO): string[] {
  const created = event.action === 'CREATED';
  const statusLabel = (status: IbsCbsRateStatus | null) => (status ? (IBS_CBS_RATE_STATUS_LABELS[status] ?? status) : '—');
  const pairs: [string, string, string][] = [
    ['Status', statusLabel(event.statusBefore), statusLabel(event.statusAfter)],
    ['CBS', formatPercent(event.cbsBefore), formatPercent(event.cbsAfter)],
    ['IBS UF', formatPercent(event.ibsStateBefore), formatPercent(event.ibsStateAfter)],
    ['IBS Mun', formatPercent(event.ibsMunicipalBefore), formatPercent(event.ibsMunicipalAfter)],
  ];
  return pairs
    .filter(([, before, after]) => created || before !== after)
    .map(([label, before, after]) => (created ? `${label}: ${after}` : `${label}: ${before} → ${after}`));
}

/** Primeiro ano da faixa da AL-RN-03 que ainda não tem linha (sugestão do "Novo ano"); todos cadastrados = null. */
export function nextFreeYear(rows: IbsCbsRateDTO[]): number | null {
  const taken = new Set(rows.map((row) => row.year));
  for (let year = IBS_CBS_RATE_LIMITS.minYear; year <= IBS_CBS_RATE_LIMITS.maxYear; year++) {
    if (!taken.has(year)) return year;
  }
  return null;
}
