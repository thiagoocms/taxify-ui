import { apiErrorBody, apiErrorCode, apiErrorMessage, FIRM_ACCESS_BLOCKED, httpStatusOf } from '../../core/models/api-error.model';
import {
  CAPTURE_ERRORS,
  CAPTURE_FAILURE_MESSAGES,
  CaptureQueueHealth,
  CaptureScope,
  CaptureSideDTO,
} from '../../core/models/capture-panel.model';
import { formatLocalDate, formatLocalDateTime } from '../../shared/utils/format';

/**
 * Formatação do painel de captura. Só texto de exibição: nenhuma situação é recalculada aqui (CP-RN-06 a 08 são do
 * backend). As datas chegam em Recife com o fuso explícito e são lidas pela parte local, sem conversão.
 */

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-11" → "nov/2026". */
export function shortMonth(value?: string | null): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? '');
  if (!match) {
    return value || '—';
  }
  const index = Number(match[2]) - 1;
  return index >= 0 && index < 12 ? `${MONTHS[index]}/${match[1]}` : value!;
}

/** "2026-11-27T09:40:00-03:00" → "27/11 09:40" (o formato curto da spec para a fila e as falhas). */
export function shortDateTime(value?: string | null): string {
  const match = /^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[2]}/${match[1]} ${match[3]}:${match[4]}` : formatLocalDate(value);
}

/** "…T09:20:00-03:00" → "09:20". */
export function timeOf(value?: string | null): string {
  const match = /[T ](\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : '—';
}

/** Data com hora completa: "27/11/2026 09:40"; "Nunca" quando não há. */
export function dateTimeOrNever(value?: string | null): string {
  return value ? formatLocalDateTime(value) : 'Nunca';
}

/** Mesmo dia civil (pela parte local da data ISO). */
export function sameLocalDay(a?: string | null, b?: string | null): boolean {
  const day = (value?: string | null) => /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '')?.[1] ?? null;
  return !!day(a) && day(a) === day(b);
}

/** 750 → "12 h 30 min"; 1500 → "25 h"; 45 → "45 min"; 0 → "0 min". */
export function formatMinutes(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
    return '—';
  }
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) {
    return `${rest} min`;
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export interface QueueHealthView {
  label: string;
  tone: string;
  icon: string;
}

/**
 * "rodando" / "parada desde {hora}" / "captura SIEG desligada neste ambiente" (CP-RN-12, CA-CP-20). A hora sozinha
 * quando a parada é do mesmo dia da próxima rodada; senão com a data.
 */
export function queueHealthView(
  health: CaptureQueueHealth,
  stalledSince: string | null,
  nextTickAt: string | null,
): QueueHealthView {
  switch (health) {
    case 'RUNNING':
      return { label: 'Fila SIEG rodando', tone: 'ok', icon: 'circle-play' };
    case 'STALLED': {
      const since = !stalledSince
        ? ''
        : sameLocalDay(stalledSince, nextTickAt)
          ? ` desde ${timeOf(stalledSince)}`
          : ` desde ${formatLocalDateTime(stalledSince)}`;
      return { label: `Fila SIEG parada${since}`, tone: 'danger', icon: 'circle-stop' };
    }
    default:
      return { label: 'Captura SIEG desligada neste ambiente', tone: '', icon: 'power-off' };
  }
}

/**
 * Volta observada: com empresas nunca tentadas, a volta ainda não fechou (CA-CP-06). Sem o número (o ADMIN do
 * escritório recebe nulo - CP-RN-12), nada é mostrado: a volta da plataforma não aparece para o escritório.
 */
export function observedLapText(
  observedLapMinutes: number | null,
  neverAttempted: number | null,
  platform = false,
): string | null {
  // Na plataforma, nenhuma empresa tentada vem com a volta nula e continua sendo "incompleta" (CA-CP-06).
  if (observedLapMinutes == null && !platform) {
    return null;
  }
  if (neverAttempted && neverAttempted > 0) {
    return `Volta incompleta: ${neverAttempted} ${neverAttempted === 1 ? 'empresa nunca tentada' : 'empresas nunca tentadas'}`;
  }
  return observedLapMinutes == null ? null : formatMinutes(observedLapMinutes);
}

export const THEORETICAL_LAP_NOTE =
  'Cada empresa gasta de 2 a 8 chamadas, e o SIEG aceita 2 por minuto, então uma rodada pode passar do intervalo.';

export function theoreticalLapText(theoreticalLapMinutes: number | null): string | null {
  return theoreticalLapMinutes == null ? null : `Pelo menos ${formatMinutes(theoreticalLapMinutes)}`;
}

/** Mensagem da falha: a do backend; sem ela, o texto da CP-RN-11 pelo código. Nunca o texto cru do provedor. */
export function failureText(
  code: string | null | undefined,
  message: string | null | undefined,
  providerStatus?: string | null,
  count?: number | null,
): string {
  if (message && message.trim()) {
    return message;
  }
  const template = code ? CAPTURE_FAILURE_MESSAGES[code] : undefined;
  if (!template) {
    return code ? `Falha na etapa (código ${code}).` : 'Falha na etapa.';
  }
  return template
    .replace('{status}', providerStatus && /^\d{1,4}$/.test(providerStatus) ? providerStatus : '?')
    .replace('{count}', count != null ? String(count) : '?');
}

// --------------------------------------------------- Erros do "Sincronizar agora" --

/** Campo extra do corpo de erro: no topo (padrão do ErrorDetailsDTO) ou dentro de `details`, se vier objeto. */
function errorExtra(error: unknown, key: string): unknown {
  const body = apiErrorBody(error);
  if (!body) {
    return undefined;
  }
  if (body[key] !== undefined) {
    return body[key];
  }
  const details = body.details as unknown;
  return details && typeof details === 'object' ? (details as Record<string, unknown>)[key] : undefined;
}

export interface SyncNowErrorView {
  title: string;
  message: string;
  /** 403 de somente leitura: recarregar a situação do escritório (faixa e botões). */
  reloadFirmAccess?: boolean;
}

/**
 * Texto de cada recusa do `POST sync-now` (CP-RN-17). Os codes novos têm frase própria com os números do corpo
 * (`retryAt`, `limit`); os demais usam a mensagem da API ou uma pelo status.
 */
export function syncNowErrorView(error: unknown, scope: CaptureScope): SyncNowErrorView {
  const code = apiErrorCode(error);
  const status = httpStatusOf(error);
  const apiMessage = apiErrorMessage(error);
  const retryAtRaw = errorExtra(error, 'retryAt');
  const retryAt = typeof retryAtRaw === 'string' ? retryAtRaw : null;
  const limitRaw = errorExtra(error, 'limit');
  const limit = typeof limitRaw === 'number' || typeof limitRaw === 'string' ? String(limitRaw) : null;

  switch (code) {
    case FIRM_ACCESS_BLOCKED:
      return {
        title: 'Somente leitura',
        message: 'O escritório está em somente leitura: as capturas estão paradas e o "Sincronizar agora" não fica disponível. Fale com a CS Hub.',
        reloadFirmAccess: true,
      };
    case CAPTURE_ERRORS.firmBlocked:
      return {
        title: 'Escritório bloqueado',
        message:
          'O escritório desta empresa está bloqueado e a captura está parada. Reative o escritório no console: a recuperação dos meses bloqueados cuida do período.',
      };
    case CAPTURE_ERRORS.notInPlan:
      return {
        title: 'Fora do plano',
        message: 'O plano vigente desta empresa não tem importação de XML pelo SIEG. Não há fila para adiantar.',
      };
    case CAPTURE_ERRORS.unavailable:
      // O mesmo code cobre o recurso desligado e outro pedido do escritório sendo gravado: a mensagem da API diz qual.
      return {
        title: 'Indisponível agora',
        message: apiMessage ?? 'Não foi possível registrar o pedido agora. Tente de novo em instantes.',
      };
    case CAPTURE_ERRORS.cooldown:
      return {
        title: 'Sincronizada há pouco',
        message: retryAt
          ? `Esta empresa foi sincronizada há pouco. Dá para pedir de novo a partir de ${shortDateTime(retryAt)}.`
          : 'Esta empresa foi sincronizada há pouco. Tente de novo mais tarde.',
      };
    case CAPTURE_ERRORS.firmOpenLimit:
      return {
        title: 'Limite de pedidos na fila',
        message: `O escritório já tem ${limit ?? 'o máximo de'} pedidos aguardando na fila. Espere um deles ser atendido para pedir outro.`,
      };
    case CAPTURE_ERRORS.firmDailyLimit:
      return {
        title: 'Limite do dia',
        message:
          `O escritório já fez ${limit ? `os ${limit}` : 'todos os'} pedidos de "Sincronizar agora" permitidos hoje.` +
          (retryAt ? ` Novos pedidos a partir de ${formatLocalDateTime(retryAt)}.` : ' Tente de novo amanhã.'),
      };
  }

  if (status === 403) {
    return {
      title: 'Sem permissão',
      message:
        scope === 'platform'
          ? 'Só o administrador da plataforma (CS Hub) pede "Sincronizar agora" por aqui.'
          : 'Só o administrador do escritório pede "Sincronizar agora".',
    };
  }
  if (status === 404) {
    return { title: 'Empresa não encontrada', message: 'A empresa não foi encontrada (pode ter sido excluída). Atualize a lista.' };
  }
  if (status === 0) {
    return { title: 'Sem conexão', message: 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.' };
  }
  return {
    title: 'Não foi possível pedir',
    message: apiMessage ?? 'Não foi possível colocar a empresa no início da fila. Tente de novo em instantes.',
  };
}

/** Erro ao carregar o painel ou o detalhe, com o que fazer a seguir. */
export function loadErrorText(error: unknown, scope: CaptureScope, what: 'list' | 'detail'): string {
  const status = httpStatusOf(error);
  if (status === 403) {
    return scope === 'platform'
      ? 'Só o administrador da plataforma (CS Hub) abre esta visão.'
      : 'O painel de captura é do administrador do escritório e do perfil Fiscal (só a carteira). Peça o acesso ao administrador.';
  }
  if (status === 404 && what === 'detail') {
    return 'Empresa não encontrada (pode ter sido excluída ou não é deste escritório). Atualize a lista.';
  }
  if (status === 400) {
    return 'Algum filtro da URL não é válido. Limpe os filtros e tente de novo.';
  }
  if (status === 0) {
    return 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.';
  }
  return what === 'list'
    ? 'Não foi possível carregar o painel de captura. Tente de novo em instantes.'
    : 'Não foi possível carregar o detalhe da empresa. Tente de novo.';
}

/**
 * Memória de um lado (recebidas/emitidas) no detalhe: a pronta do backend; montada aqui só de reserva.
 * "{importado} notas vindas do SIEG emitidas de {início} a {fim}; o SIEG informou {total} na verificação de {data hora};
 * {n} no Taxify (qualquer origem)."
 */
export function sideMemoText(side: CaptureSideDTO | null | undefined): string {
  if (side?.memory) {
    return side.memory;
  }
  if (!side || side.imported == null) {
    return 'Ainda não verificado.';
  }
  const window = side.from && side.to ? ` emitidas de ${formatLocalDate(side.from)} a ${formatLocalDate(side.to)}` : '';
  const sieg =
    side.totalSieg == null
      ? '; o SIEG ainda não informou o total'
      : `; o SIEG informou ${side.totalSieg}${side.checkedAt ? ` na verificação de ${formatLocalDateTime(side.checkedAt)}` : ''}`;
  const stored = side.storedAnySource != null ? `; ${side.storedAnySource} no Taxify (qualquer origem)` : '';
  return `${side.imported} notas vindas do SIEG${window}${sieg}${stored}.`;
}
