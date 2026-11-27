import {
  CapturePanelRowDTO,
  CapturePriorityRequestDTO,
  CaptureQueueHealth,
  CaptureScope,
  CaptureStatus,
  displayPosition,
} from '../../core/models/capture-panel.model';
import { READ_ONLY_HINT } from '../../core/models/firm-access.model';
import { shortDateTime, timeOf } from './capture-format';

/** Ícone junto do texto da situação: legível sem cor (daltonismo, impressão). Nomes do Font Awesome (fas). */
export const CAPTURE_STATUS_ICONS: Record<CaptureStatus, string> = {
  EM_DIA: 'circle-check',
  PENDENTE: 'hourglass-half',
  ATRASADA: 'clock',
  COM_ERRO: 'circle-xmark',
  NUNCA_TENTADA: 'circle-pause',
  FORA_DO_PLANO: 'ban',
  BLOQUEADA: 'lock',
};

/** Pedido em aberto: ainda não atendido (o botão vira "Na fila"). */
export function isOpenRequest(request: CapturePriorityRequestDTO | null | undefined): boolean {
  return !!request && (request.status === 'PENDING' || request.status === 'RESERVED');
}

/**
 * "Na fila: posição 1 · estimativa 27/11 10:05 · Pedido por Carla às 10:01" (CP-RN-15 e CP-RN-19). No escritório,
 * o pedido da plataforma aparece como "Pedido pela CS Hub".
 */
export function priorityRequestText(request: CapturePriorityRequestDTO, scope: CaptureScope): string {
  const parts: string[] = [];
  if (request.status === 'RESERVED') {
    parts.push('Sendo atendida nesta rodada');
  } else if (request.status === 'PENDING') {
    const position = displayPosition(request.position);
    parts.push(position != null ? `Na fila: posição ${position}` : 'Na fila');
    if (request.estimatedAt) {
      parts.push(`estimativa ${shortDateTime(request.estimatedAt)}`);
    }
  } else {
    parts.push(
      request.status === 'SERVED' ? 'Pedido atendido' : request.status === 'CANCELED' ? 'Pedido cancelado' : 'Pedido expirado',
    );
  }
  const at = request.requestedAt ? ` às ${timeOf(request.requestedAt)}` : '';
  if (request.requestedByLabel) {
    parts.push(request.requestedByLabel); // texto pronto do backend ("Pedido pela CS Hub às 10:01")
  } else if (request.requestedByPlatform && scope === 'firm') {
    parts.push(`Pedido pela CS Hub${at}`);
  } else if (request.requestedByName) {
    parts.push(`Pedido por ${request.requestedByName}${at}`);
  }
  return parts.join(' · ');
}

export interface SyncButtonView {
  /** ADMIN do escritório ou admin da plataforma (o FISCAL não vê o botão - P-CP-02). */
  show: boolean;
  disabled: boolean;
  /** Por que está desabilitado (title do botão e texto no detalhe). */
  reason: string | null;
  /** Estado "na fila" com a posição somando 1. */
  queued: string | null;
  busy: boolean;
  /** Ação de escrita do escritório: o app-button desabilita sozinho no somente leitura (padrão da fase 1). */
  write: boolean;
}

export interface SyncContext {
  scope: CaptureScope;
  /** Pode pedir: ADMIN no escritório; admin da plataforma na plataforma. */
  allowed: boolean;
  readOnly: boolean;
  queueHealth: CaptureQueueHealth | null;
  busy: boolean;
}

/** Estado do "Sincronizar agora" de uma empresa. A primeira razão que se aplica explica o botão desabilitado. */
export function syncButtonView(row: CapturePanelRowDTO, context: SyncContext): SyncButtonView {
  const request = row.channels?.SIEG?.priorityRequest ?? null;
  const queued = isOpenRequest(request) ? priorityRequestText(request!, context.scope) : null;
  const write = context.scope === 'firm';
  let reason: string | null = null;
  if (context.scope === 'firm' && context.readOnly) {
    reason = READ_ONLY_HINT;
  } else if (row.status === 'BLOQUEADA') {
    reason = 'Escritório em somente leitura: capturas paradas. Reative o escritório para voltar à fila.';
  } else if (row.channels?.SIEG?.status === 'FORA_DO_PLANO') {
    reason = 'O plano vigente não tem importação de XML pelo SIEG.';
  } else if (context.queueHealth === 'DISABLED') {
    reason = 'A captura SIEG está desligada neste ambiente.';
  } else if (queued) {
    reason = 'A empresa já tem um pedido na fila.';
  }
  return {
    show: context.allowed,
    disabled: !!reason || context.busy,
    reason,
    queued,
    busy: context.busy,
    write,
  };
}
