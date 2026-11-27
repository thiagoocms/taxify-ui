import {
  PlatformAccessAction,
  PlatformFirmEventDTO,
  PlatformFirmRowDTO,
} from '../../../core/models/platform-firm.model';
import { FIRM_REASON_LABELS, FIRM_STATUS_LABELS, FirmAccessStatus, FirmBlockedReason } from '../../../core/models/firm-access.model';
import { formatLocalDate, formatLocalDateTime, formatPhone } from '../../../shared/utils/format';
import { formatDocument } from '../../../shared/utils/document-mask';

/** O que cada ação pede e como ela é apresentada (F1-RN-14). */
export interface PlatformActionSpec {
  action: PlatformAccessAction;
  label: string;
  description: string;
  /** Campo de data: `trialEndsOn` (extend/convert) ou `accessUntil` (release). */
  dateField?: 'trialEndsOn' | 'accessUntil';
  dateRequired?: boolean;
  dateLabel?: string;
  dateHint?: string;
  reasonRequired?: boolean;
  danger?: boolean;
}

export const PLATFORM_ACTIONS: PlatformActionSpec[] = [
  {
    action: 'mark-reviewed',
    label: 'Marcar como revisado',
    description: 'Mantém a situação como está e registra a revisão.',
  },
  {
    action: 'extend-trial',
    label: 'Estender o teste',
    description: 'Novo último dia do teste. Se o teste já tinha vencido, o escritório volta ao teste na próxima requisição.',
    dateField: 'trialEndsOn',
    dateRequired: true,
    dateLabel: 'Teste até (último dia)',
  },
  {
    action: 'convert-to-trial',
    label: 'Converter em teste',
    description: 'O escritório liberado passa a ter teste grátis, com o limite do teste.',
    dateField: 'trialEndsOn',
    dateLabel: 'Teste até (último dia, opcional)',
    dateHint: 'Em branco: o prazo padrão do teste grátis, contando hoje como o 1º dia.',
  },
  {
    action: 'release',
    label: 'Liberar',
    description: 'Acesso total, sem o limite do teste.',
    dateField: 'accessUntil',
    dateLabel: 'Liberado até (opcional)',
    dateHint: 'Em branco: liberado sem prazo.',
  },
  {
    action: 'suspend',
    label: 'Suspender',
    description: 'Somente leitura e capturas automáticas paradas até reativar.',
    reasonRequired: true,
    danger: true,
  },
  {
    action: 'reactivate',
    label: 'Reativar',
    description: 'Tira a suspensão: volta ao teste (se estava em teste) ou ao liberado, conforme as datas.',
  },
  {
    action: 'cancel',
    label: 'Cancelar a conta',
    description: 'Somente leitura e capturas paradas. Os dados não são apagados.',
    danger: true,
  },
];

/**
 * Ações oferecidas para a linha. É só para não mostrar botão que o backend recusaria (409
 * error.platform.action.invalid); quem decide continua sendo o backend, e a recusa aparece no modal.
 */
export function availableActions(row: PlatformFirmRowDTO): PlatformActionSpec[] {
  if (row.exempt) {
    return PLATFORM_ACTIONS.filter((spec) => spec.action === 'mark-reviewed');
  }
  const status = row.status;
  const allowed = (action: PlatformAccessAction): boolean => {
    switch (action) {
      case 'mark-reviewed':
        return true;
      case 'extend-trial':
        return status === 'TRIAL' || (status === 'BLOCKED' && row.reason === 'TRIAL_EXPIRED');
      case 'convert-to-trial':
        return status === 'ACTIVE' || (status === 'BLOCKED' && row.reason === 'ACCESS_EXPIRED');
      case 'release':
        return status !== 'PENDING_VERIFICATION';
      case 'suspend':
        return !['PENDING_VERIFICATION', 'SUSPENDED', 'CANCELED'].includes(status);
      case 'reactivate':
        return status === 'SUSPENDED';
      case 'cancel':
        return !['PENDING_VERIFICATION', 'CANCELED'].includes(status);
    }
  };
  return PLATFORM_ACTIONS.filter((spec) => allowed(spec.action));
}

/** Situação da linha por extenso, com a data que importa (texto, nunca só a cor). */
export function situationText(row: Pick<PlatformFirmRowDTO, 'status' | 'exempt' | 'reason' | 'trialEndsOn' | 'accessUntil' | 'blockedSince'>): string {
  if (row.exempt) {
    return 'Isento (CS Hub)';
  }
  const label = FIRM_STATUS_LABELS[row.status] ?? row.status;
  switch (row.status) {
    case 'TRIAL':
      return row.trialEndsOn ? `${label} até ${formatLocalDate(row.trialEndsOn)}` : label;
    case 'ACTIVE':
      return row.accessUntil ? `${label} até ${formatLocalDate(row.accessUntil)}` : `${label} sem prazo`;
    case 'BLOCKED':
    case 'SUSPENDED':
    case 'CANCELED': {
      const reason = row.reason ? ` (${FIRM_REASON_LABELS[row.reason] ?? row.reason})` : '';
      const since = row.blockedSince ? ` desde ${formatLocalDate(row.blockedSince)}` : '';
      return `${label}${since}${reason}`;
    }
    default:
      return label;
  }
}

/** Variação do `.state-badge` (page-patterns) da situação; a cor acompanha o texto. Vazio = selo neutro. */
export function situationTone(row: Pick<PlatformFirmRowDTO, 'status' | 'exempt'>): 'ok' | 'info' | 'warn' | 'danger' | '' {
  if (row.exempt) return '';
  switch (row.status) {
    case 'ACTIVE':
      return 'ok';
    case 'TRIAL':
      return 'info';
    case 'PAST_DUE':
    case 'PENDING_VERIFICATION':
      return 'warn';
    case 'BLOCKED':
    case 'SUSPENDED':
    case 'CANCELED':
      return 'danger';
    default:
      return '';
  }
}

const SNAPSHOT_FIELDS: { key: string; label: string }[] = [
  { key: 'status', label: 'Situação' },
  { key: 'trialEndsOn', label: 'Teste até' },
  { key: 'accessUntil', label: 'Liberado até' },
  { key: 'blockedSince', label: 'Bloqueado desde' },
  { key: 'blockedReason', label: 'Motivo do bloqueio' },
  { key: 'migrated', label: 'Liberado na migração' },
  { key: 'reviewed', label: 'Revisado' },
  { key: 'documentNumber', label: 'CNPJ' },
  { key: 'billingEmail', label: 'E-mail financeiro' },
  { key: 'contactPhone', label: 'Telefone' },
];

function snapshotValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (key === 'status') return FIRM_STATUS_LABELS[value as FirmAccessStatus] ?? String(value);
  if (key === 'documentNumber') return formatDocument(String(value));
  if (key === 'contactPhone') return formatPhone(String(value));
  if (key === 'blockedReason') return FIRM_REASON_LABELS[value as FirmBlockedReason] ?? String(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatLocalDateTime(value);
  return String(value);
}

/** O que mudou no evento: "Situação: Liberado → Teste grátis". */
export function eventChanges(event: PlatformFirmEventDTO): string[] {
  const before = event.before ?? {};
  const after = event.after ?? {};
  return SNAPSHOT_FIELDS.filter(({ key }) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)).map(
    ({ key, label }) => `${label}: ${snapshotValue(key, before[key])} → ${snapshotValue(key, after[key])}`,
  );
}

const RECIFE_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Recife',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Hoje em America/Recife, "aaaa-mm-dd" - o mesmo "hoje" do backend (F1-RN-05), qualquer que seja o fuso do
 * navegador. É o mínimo dos campos de data; quem recusa data passada continua sendo o backend.
 */
export function todayIso(now: Date = new Date()): string {
  const parts = Object.fromEntries(RECIFE_DATE.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}
