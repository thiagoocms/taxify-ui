import { Params, ParamMap } from '@angular/router';
import {
  CAPTURE_CHANNEL_LABELS,
  CAPTURE_DOC_TYPE_LABELS,
  CAPTURE_SORT_LABELS,
  CAPTURE_STATUS_ORDER,
  CaptureChannel,
  CaptureDocType,
  CapturePanelFilter,
  CaptureScope,
  CaptureSort,
  CaptureStatus,
} from '../../core/models/capture-panel.model';

/**
 * Filtros do painel na URL (CP-RN-13): `?situacao=COM_ERRO&situacao=ATRASADA&canal=SIEG&tipo=EVENTOS&busca=textil
 * &incluirInativas=true&sort=name&page=2&firmId=…`. A URL é a fonte da verdade: copiar o link abre a mesma visão.
 * Valor desconhecido é ignorado (fica o padrão), para um link velho ou editado à mão não quebrar a tela.
 */

/** Acima disso a API responde 400: a página da URL volta para a primeira. */
export const MAX_PAGE = 100000;

export const EMPTY_FILTER: CapturePanelFilter = {
  situacao: [],
  canal: null,
  tipo: null,
  busca: '',
  incluirInativas: false,
  sort: null,
  page: 0,
  firmId: null,
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  const normalized = value?.trim() ?? '';
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

export function filterFromParams(params: ParamMap, scope: CaptureScope): CapturePanelFilter {
  // `situacao` aceita repetido ou separado por vírgula; ordem e duplicatas normalizadas.
  const statuses = new Set(
    params
      .getAll('situacao')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().toUpperCase()),
  );
  const situacao = CAPTURE_STATUS_ORDER.filter((status) => statuses.has(status));
  const page = Number(params.get('page'));
  const firmId = params.get('firmId')?.trim() || null;
  return {
    situacao,
    canal: oneOf(params.get('canal')?.toUpperCase() ?? null, Object.keys(CAPTURE_CHANNEL_LABELS) as CaptureChannel[]),
    tipo: oneOf(params.get('tipo')?.toUpperCase() ?? null, Object.keys(CAPTURE_DOC_TYPE_LABELS) as CaptureDocType[]),
    busca: (params.get('busca') ?? '').slice(0, 100),
    incluirInativas: params.get('incluirInativas') === 'true',
    sort: oneOf(params.get('sort'), Object.keys(CAPTURE_SORT_LABELS) as CaptureSort[]),
    page: Number.isInteger(page) && page > 0 && page <= MAX_PAGE ? page : 0,
    firmId: scope === 'platform' ? firmId : null,
  };
}

/** Query params do filtro: o que está no padrão sai da URL (null remove com `queryParamsHandling: 'merge'`). */
export function paramsFromFilter(filter: CapturePanelFilter): Params {
  return {
    situacao: filter.situacao.length ? filter.situacao : null,
    canal: filter.canal,
    tipo: filter.tipo,
    busca: filter.busca.trim() || null,
    incluirInativas: filter.incluirInativas ? 'true' : null,
    sort: filter.sort && filter.sort !== 'status' ? filter.sort : null,
    page: filter.page > 0 ? filter.page : null,
    firmId: filter.firmId,
  };
}

export function sameFilter(a: CapturePanelFilter, b: CapturePanelFilter): boolean {
  return JSON.stringify(paramsFromFilter(a)) === JSON.stringify(paramsFromFilter(b));
}

/** Algum filtro além da página (para o "Limpar filtros" e a mensagem de lista vazia). */
export function hasActiveFilter(filter: CapturePanelFilter): boolean {
  return (
    filter.situacao.length > 0 ||
    !!filter.canal ||
    !!filter.tipo ||
    !!filter.busca.trim() ||
    filter.incluirInativas ||
    !!filter.firmId
  );
}

/** Liga ou desliga uma situação no filtro (cartões do resumo). */
export function toggleStatus(current: CaptureStatus[], status: CaptureStatus): CaptureStatus[] {
  const set = new Set(current);
  if (set.has(status)) {
    set.delete(status);
  } else {
    set.add(status);
  }
  return CAPTURE_STATUS_ORDER.filter((item) => set.has(item));
}
