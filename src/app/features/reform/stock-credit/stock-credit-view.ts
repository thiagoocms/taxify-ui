import { apiErrorBody, apiErrorCode, apiErrorMessage, FIRM_ACCESS_BLOCKED, httpStatusOf } from '../../../core/models/api-error.model';
import { READ_ONLY_HINT } from '../../../core/models/firm-access.model';
import {
  STOCK_CREDIT_ERROR_MESSAGES,
  STOCK_CREDIT_ERRORS,
  STOCK_CREDIT_REGIME_SOURCE_LABELS,
  STOCK_CREDIT_YEAR,
  StockCreditDetailDTO,
  StockCreditRowDTO,
} from '../../../core/models/stock-credit.model';
import { TAX_REGIME_LABELS } from '../../../core/models/tax-assessment.model';
import { formatLocalDate, formatLocalDateTime } from '../../../shared/utils/format';

/**
 * Regras de exibição do levantamento do crédito de estoque (F-CE-2 e F-CE-3). Nenhuma regra fiscal: classificação,
 * motivo, cobertura e memória vêm do backend. Aqui só o estado dos botões, os textos das recusas e a formatação.
 */

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-03" → "mar/2026". */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month ?? '');
  return match ? `${MONTHS[Number(match[2]) - 1] ?? match[2]}/${match[1]}` : month;
}

/** "HH:mm" de uma data e hora ISO com o fuso de Recife, sem conversão de fuso. */
export function timeOf(value: string | null | undefined): string {
  const match = /T(\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : '';
}

/** O instante já passou? ISO com offset compara exato; valor ilegível conta como passado (não trava o botão). */
export function isFuture(value: string | null | undefined, now: number): boolean {
  const at = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) && at > now;
}

/** "11 de 11 meses com entrada" (CE-RN-06). */
export function coverageText(row: Pick<StockCreditRowDTO, 'monthsWithInbound' | 'monthsEvaluated'>): string {
  return `${row.monthsWithInbound} de ${row.monthsEvaluated} ${row.monthsEvaluated === 1 ? 'mês' : 'meses'} com entrada`;
}

export function regimeLabel(regime: string | null | undefined): string {
  return regime ? ((TAX_REGIME_LABELS as Record<string, string>)[regime] ?? regime) : 'Não informado';
}

/** "Lucro Presumido desde 01/07/2026 (histórico de regime)" / "Lucro Real (cadastro da empresa)". */
export function referenceRegimeText(detail: Pick<StockCreditDetailDTO, 'referenceRegime' | 'referenceRegimeSince' | 'referenceRegimeSource'>): string {
  const since = detail.referenceRegimeSince ? ` desde ${formatLocalDate(detail.referenceRegimeSince)}` : '';
  const source = detail.referenceRegimeSource ? ` (${STOCK_CREDIT_REGIME_SOURCE_LABELS[detail.referenceRegimeSource]})` : '';
  return `${regimeLabel(detail.referenceRegime)}${since}${source}`;
}

/** Nome do CSV: o do `Content-Disposition` quando vier; senão o da seção 7 com a data de hoje. */
export function csvFileName(contentDisposition: string | null, today: Date): string {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition ?? '');
  if (match) return decodeURIComponent(match[1].trim());
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return `credito-estoque-${STOCK_CREDIT_YEAR}-${stamp}.csv`;
}

/** Estado de um botão de escrita do detalhe ("Atualizar agora", "Salvar situação"). */
export interface WriteButtonView {
  show: boolean;
  disabled: boolean;
  /** Motivo do desabilitado (vira a dica e o texto ao lado). O somente leitura quem explica é o `[write]`. */
  reason: string | null;
}

export interface WriteContext {
  /** TAX_ASSESSMENT_CLOSE (CE-RN-09 e CE-RN-10). */
  canWrite: boolean;
  /** Encerrado (CE-RN-12): pela flag do `/reform/features` ou do detalhe. */
  closed: boolean;
  /** Escritório em somente leitura (F1-RN-08): o `[write]` desabilita; aqui o motivo aparece também ao lado. */
  readOnly: boolean;
  busy: boolean;
  now: number;
}

const CLOSED_REASON = 'Levantamento encerrado em 30/06/2027: só consulta.';

/** "Atualizar agora": escondido sem a permissão; desabilitado encerrado, no ar ou até o cooldown liberar. */
export function refreshButtonView(detail: Pick<StockCreditDetailDTO, 'refreshAvailableAt' | 'closed'> | null, ctx: WriteContext): WriteButtonView {
  if (!ctx.canWrite) return { show: false, disabled: true, reason: null };
  if (ctx.closed || detail?.closed) return { show: true, disabled: true, reason: CLOSED_REASON };
  if (ctx.readOnly) return { show: true, disabled: true, reason: READ_ONLY_HINT };
  if (ctx.busy) return { show: true, disabled: true, reason: 'Atualizando...' };
  if (detail && isFuture(detail.refreshAvailableAt, ctx.now)) {
    return { show: true, disabled: true, reason: `Atualizado há pouco: disponível de novo às ${timeOf(detail.refreshAvailableAt)}.` };
  }
  return { show: true, disabled: false, reason: null };
}

/** Troca da situação: escondida sem a permissão; desabilitada encerrado ou gravando. */
export function statusEditView(detail: Pick<StockCreditDetailDTO, 'closed'> | null, ctx: WriteContext): WriteButtonView {
  if (!ctx.canWrite) return { show: false, disabled: true, reason: null };
  if (ctx.closed || detail?.closed) return { show: true, disabled: true, reason: CLOSED_REASON };
  if (ctx.readOnly) return { show: true, disabled: true, reason: READ_ONLY_HINT };
  return { show: true, disabled: ctx.busy, reason: ctx.busy ? 'Salvando...' : null };
}

/** Como a tela mostra uma recusa da API. */
export interface StockCreditErrorView {
  message: string;
  /** Recurso desligado no ambiente (404 `error.reform.stock.disabled`). */
  disabled: boolean;
  /** Empresa sem levantamento calculado (404 `error.reform.stock.survey.not.found`). */
  notCalculated: boolean;
  /** 409 de conflito de versão: recarrega a linha e avisa. */
  conflict: boolean;
  /** Encerrado (409 `error.reform.stock.survey.closed`). */
  closed: boolean;
  /** Cálculo falhou no "Atualizar agora" (409 `error.reform.stock.calculation.failed`): avisa no painel, sem cooldown. */
  calculationFailed: boolean;
  /** 403 de escrita bloqueada: recarrega a situação do escritório. */
  reloadFirmAccess: boolean;
  /** Campo do formulário a marcar (observação longa demais). */
  field: 'note' | 'status' | null;
}

export type StockCreditAction = 'list' | 'detail' | 'refresh' | 'status' | 'history' | 'export';

const GENERIC: Record<StockCreditAction, string> = {
  list: 'Não foi possível carregar o levantamento. Tente de novo.',
  detail: 'Não foi possível carregar o detalhe da empresa. Tente de novo.',
  refresh: 'Não foi possível atualizar a empresa. Tente de novo.',
  status: 'Não foi possível salvar a situação. Tente de novo.',
  history: 'Não foi possível carregar o histórico. Tente de novo.',
  export: 'Não foi possível gerar o CSV. Tente de novo.',
};

export function stockCreditErrorView(error: unknown, action: StockCreditAction): StockCreditErrorView {
  const code = apiErrorCode(error);
  const status = httpStatusOf(error);
  const apiMessage = apiErrorMessage(error);
  const fallback = code ? STOCK_CREDIT_ERROR_MESSAGES[code] : undefined;
  const view: StockCreditErrorView = {
    message: apiMessage ?? fallback ?? GENERIC[action],
    disabled: code === STOCK_CREDIT_ERRORS.disabled,
    notCalculated: code === STOCK_CREDIT_ERRORS.notFound,
    conflict: code === STOCK_CREDIT_ERRORS.conflict,
    closed: code === STOCK_CREDIT_ERRORS.closed,
    calculationFailed: code === STOCK_CREDIT_ERRORS.calculationFailed,
    reloadFirmAccess: false,
    field: code === STOCK_CREDIT_ERRORS.noteTooLong ? 'note' : code === STOCK_CREDIT_ERRORS.statusInvalid ? 'status' : null,
  };
  if (code === STOCK_CREDIT_ERRORS.cooldown) {
    const retryAt = apiErrorBody(error)?.['retryAt'];
    const at = typeof retryAt === 'string' ? timeOf(retryAt) : '';
    view.message = at ? `${view.message} Disponível de novo às ${at}.` : view.message;
    return view;
  }
  if (status === 403 && code === FIRM_ACCESS_BLOCKED) {
    return { ...view, message: apiMessage ?? READ_ONLY_HINT, reloadFirmAccess: true };
  }
  if (status === 403) {
    return {
      ...view,
      message:
        action === 'refresh' || action === 'status'
          ? 'Seu perfil só consulta o levantamento: atualizar e mudar a situação é de quem fecha a apuração.'
          : 'Seu perfil não tem acesso ao levantamento. Peça ao administrador do escritório.',
    };
  }
  if (status === 400 && action === 'list' && !fallback && !apiMessage) {
    return { ...view, message: 'Algum filtro da URL não é válido. Limpe os filtros e tente de novo.' };
  }
  if (status === 0) {
    return { ...view, message: 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.' };
  }
  return view;
}

/** "10/12/2026 06:15" ou "Ainda não calculado". */
export function calculatedText(value: string | null | undefined): string {
  return value ? formatLocalDateTime(value) : 'Ainda não calculado';
}
