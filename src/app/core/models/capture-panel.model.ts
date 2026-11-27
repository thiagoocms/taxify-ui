/**
 * Painel de controle da captura de XML (spec 2026-11-27-painel-captura-xml, seção 8).
 * Contrato de `GET /capture-panel` (escritório) e `GET /platform/capture-panel` (plataforma), do detalhe por empresa e
 * do `POST .../sync-now`. Datas com hora chegam em ISO 8601 com o fuso de Recife (`-03:00`) e datas sem hora como
 * "aaaa-mm-dd": a tela só formata, sem conversão de fuso. Situações, motivos e mensagens de falha vêm prontos do
 * backend; a tela nunca recalcula a situação.
 *
 * `queuePosition` e `position` começam em 0 na API (0 = a próxima a ser atendida). A tela mostra somando 1
 * ({@link displayPosition}).
 */

/** Situação geral da empresa e de cada canal (CP-RN-06 a CP-RN-08). */
export type CaptureStatus =
  | 'EM_DIA'
  | 'PENDENTE'
  | 'ATRASADA'
  | 'COM_ERRO'
  | 'NUNCA_TENTADA'
  | 'FORA_DO_PLANO'
  | 'BLOQUEADA';

export type CaptureChannel = 'SIEG' | 'SEFAZ' | 'ADN';

/** Filtro por tipo de documento (CP-RN-13). */
export type CaptureDocType = 'NFE_RECEBIDAS' | 'NFE_EMITIDAS' | 'EVENTOS' | 'NFSE';

/** Ordem da lista (CP-RN-14). Sem `sort`, a API usa a pior situação primeiro e a tentativa mais antiga. */
export type CaptureSort = 'status' | 'name' | 'nextAttempt';

/** Saúde da fila SIEG (CP-RN-12). */
export type CaptureQueueHealth = 'RUNNING' | 'STALLED' | 'DISABLED';

/** Etapas com resultado gravado em `capture_stage_status` (CP-RN-10). */
export type CaptureStage =
  | 'SIEG_RECEIVED'
  | 'SIEG_ISSUED'
  | 'SIEG_EVENTS_RECEIVED'
  | 'SIEG_EVENTS_ISSUED'
  | 'SIEG_NFSE'
  | 'SIEG_RECOVERY'
  | 'SEFAZ_DIST'
  | 'NFSE_ADN';

export type CapturePriorityStatus = 'PENDING' | 'RESERVED' | 'SERVED' | 'CANCELED' | 'EXPIRED';

export type CaptureScope = 'firm' | 'platform';

export interface CapturePanelSummaryDTO {
  byStatus: Partial<Record<CaptureStatus, number>>;
  /** Maior `last_attempt_at` do escopo: a última empresa atendida. */
  lastAttemptAt: string | null;
}

/**
 * Saúde da fila. Para o ADMIN de escritório só o estado (`health`) é garantido: os números da plataforma podem vir
 * nulos (CP-RN-12) e a tela esconde o que não vier.
 */
export interface CapturePanelQueueDTO {
  health: CaptureQueueHealth;
  stalledSince: string | null;
  observedLapMinutes: number | null;
  /** Empresas com direito e nunca tentadas: com mais de 0, a volta observada é "incompleta". */
  neverAttempted: number | null;
  theoreticalLapMinutes: number | null;
  nextTickAt: string | null;
  /** Intervalo entre rodadas, empresas por rodada e vagas de prioridade em uso (informativos). */
  intervalMinutes?: number | null;
  batchSize?: number | null;
  prioritySlotsInUse?: number | null;
  /** Pedidos abertos na plataforma: só na visão da plataforma (nulo no escritório). */
  openPriorityRequests?: number | null;
}

export interface CaptureMonthCloseDTO {
  /** "aaaa-mm". */
  month: string;
  imported: number | null;
  totalSieg: number | null;
  /** NF-e que faltaram no fechamento (calculado pelo backend). */
  missing?: number | null;
  /** Texto pronto: "nov/2026 fechou com 180 de 200 NF-e recebidas". */
  memory?: string | null;
}

/**
 * Um lado (recebidas ou emitidas) da verificação do mês. `imported` = notas vindas do SIEG (com `totalSieg` define o
 * `missing` e a situação); `storedAnySource` = notas no Taxify de qualquer origem (SIEG, SEFAZ ou upload), só exibido.
 */
export interface CaptureSideDTO {
  /** Notas vindas do SIEG no período. */
  imported: number | null;
  /** Notas no Taxify de qualquer origem; nulo até a primeira verificação (a tela não mostra). */
  storedAnySource?: number | null;
  totalSieg: number | null;
  from: string | null;
  to: string | null;
  checkedAt: string | null;
  /** Mês ("aaaa-mm") a que os contadores se referem. */
  month?: string | null;
  /** Quantas faltam no Taxify (calculado pelo backend; nulo/0 = nada falta). */
  missing?: number | null;
  previousMonth: CaptureMonthCloseDTO | null;
  /** Memória pronta do backend (vindas do SIEG, total do SIEG e no Taxify de qualquer origem). */
  memory?: string | null;
}

/** Pedido de "Sincronizar agora" em aberto (CP-RN-15 e CP-RN-19). */
export interface CapturePriorityRequestDTO {
  requestId: string;
  status: CapturePriorityStatus;
  requestedAt: string | null;
  /** Nome de quem pediu; só vem para quem é do mesmo escritório (CP-RN-19). */
  requestedByName?: string | null;
  /** Pedido feito pela CS Hub: o escritório vê "Pedido pela CS Hub". */
  requestedByPlatform?: boolean;
  /** Começa em 0 na API. */
  position: number | null;
  estimatedAt: string | null;
  /** Texto pronto: "Pedido por {nome} às {HH:mm}" / "Pedido pela CS Hub às {HH:mm}". */
  requestedByLabel?: string | null;
}

export interface CaptureSiegChannelDTO {
  status: CaptureStatus;
  reason?: string | null;
  lastAttemptAt: string | null;
  /** A mais antiga das duas verificações (recebidas e emitidas). */
  verifiedAt: string | null;
  /** Começa em 0 na API; nulo para empresa fora da fila. */
  queuePosition: number | null;
  nextAttemptEstimate: string | null;
  received: CaptureSideDTO | null;
  issued: CaptureSideDTO | null;
  eventsCheckedOn: { received: string | null; issued: string | null } | null;
  serviceInvoicesCheckedOn: string | null;
  priorityRequest: CapturePriorityRequestDTO | null;
}

export interface CaptureCertificateDTO {
  present: boolean;
  /** Certificado da matriz (mesma raiz do CNPJ), não da própria empresa. */
  fromHeadOffice: boolean;
  validUntil: string | null;
  /** Vence em até 30 dias (aviso, não muda a situação - CP-RN-07). Calculado pelo backend. */
  expiringSoon?: boolean;
  expired?: boolean;
  /** Texto pronto do aviso: "vence em dd/MM/aaaa". */
  warning?: string | null;
}

export type CaptureDirectLastStatus = 'OK' | 'SEM_MOVIMENTO' | 'ERRO';

export interface CaptureSefazChannelDTO {
  status: CaptureStatus;
  reason?: string | null;
  certificate?: CaptureCertificateDTO | null;
  lastRunAt?: string | null;
  lastStatus?: CaptureDirectLastStatus | null;
  nextQueryAt?: string | null;
  /** Com COM_ERRO: o código seguro e a mensagem (CP-RN-11). Nunca o `last_detail`. */
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface CaptureAdnChannelDTO {
  status: CaptureStatus;
  reason?: string | null;
  lastRunAt?: string | null;
  lastStatus?: CaptureDirectLastStatus | null;
  nextQueryAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface CaptureChannelsDTO {
  SIEG: CaptureSiegChannelDTO;
  SEFAZ: CaptureSefazChannelDTO;
  ADN: CaptureAdnChannelDTO;
}

/** Última falha da empresa (a etapa mais recente com falha). A mensagem vem do i18n do backend (CP-RN-11). */
export interface CaptureLastFailureDTO {
  stage: CaptureStage;
  at: string | null;
  code: string;
  providerStatus: string | null;
  message: string | null;
  resolved: boolean;
  consecutiveFailures: number;
  lastSuccessAt?: string | null;
  /** A falha aberta tem a mesma mensagem do `statusReason`: a lista não repete a mensagem (o detalhe mostra tudo). */
  explainsStatus?: boolean;
  /** Texto pronto: "Falhou 3 vezes seguidas; último sucesso em …" / "última falha em … (resolvida)". */
  memory?: string | null;
}

export interface CapturePanelRowDTO {
  companyId: string;
  companyName: string;
  /** Número do estabelecimento do CNPJ ("0001", "0002"). Nunca o CNPJ inteiro. */
  establishment: string | null;
  active: boolean;
  /** Só na visão da plataforma. */
  firmId: string | null;
  firmName: string | null;
  status: CaptureStatus;
  statusReason: string | null;
  channels: CaptureChannelsDTO;
  lastFailure: CaptureLastFailureDTO | null;
}

/** Página no formato da seção 8 (sem os campos extras do Page do Spring). */
export interface CapturePanelPageDTO<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CapturePanelResponseDTO {
  summary: CapturePanelSummaryDTO;
  queue: CapturePanelQueueDTO;
  page: CapturePanelPageDTO<CapturePanelRowDTO>;
}

/** Resultado de uma etapa (CP-RN-10): a falha resolvida continua aparecendo como "(resolvida)". */
export interface CaptureStageStatusDTO {
  stage: CaptureStage;
  lastOutcome: 'SUCCESS' | 'FAILURE';
  lastOutcomeAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCode: string | null;
  providerStatus: string | null;
  failureMessage: string | null;
  warningCode: string | null;
  warningCount: number | null;
  warningMessage: string | null;
  consecutiveFailures: number;
  resolved?: boolean;
  /** Histórico pronto da etapa (mesma regra do `lastFailure.memory`). */
  memory?: string | null;
}

/** Última nota gravada por origem: `max(created_date)`; nulo = "Nunca". */
export interface CaptureLastDocumentsDTO {
  nfe: { SIEG: string | null; SEFAZ_DIST: string | null; UPLOAD: string | null };
  nfse: { SIEG: string | null; ADN: string | null; UPLOAD: string | null };
}

/** Detalhe da empresa (CP-RN-09): a linha mais as etapas, a última nota por origem e a recuperação. */
export interface CapturePanelDetailDTO extends CapturePanelRowDTO {
  stages: CaptureStageStatusDTO[];
  lastDocuments: CaptureLastDocumentsDTO | null;
  /** Meses bloqueados ainda em recuperação ("aaaa-mm"). */
  recoveringMonths: string[];
  /** Memórias prontas do detalhe (CP-RN-09). */
  memory?: CaptureDetailMemoryDTO | null;
}

export interface CaptureDetailMemoryDTO {
  /** "Posição {n} na fila; estimativa {dd/MM HH:mm}" (posição já somando 1). */
  queue: string | null;
  /** "A mais antiga entre recebidas ({hora}) e emitidas ({hora})". */
  verification: string | null;
  /** "Recuperando 2026-10 e 2026-11". */
  recovery: string | null;
}

export interface CapturePanelFilter {
  situacao: CaptureStatus[];
  canal: CaptureChannel | null;
  tipo: CaptureDocType | null;
  busca: string;
  incluirInativas: boolean;
  sort: CaptureSort | null;
  page: number;
  /** Só na plataforma. */
  firmId: string | null;
}

export interface CaptureSyncNowResponseDTO {
  requestId: string;
  status: CapturePriorityStatus;
  /** Começa em 0. */
  position: number | null;
  estimatedAt: string | null;
}

// ------------------------------------------------------------------ Rótulos --

/** Ordem da CP-RN-08 (pior primeiro) para os cartões do resumo e a legenda. */
export const CAPTURE_STATUS_ORDER: CaptureStatus[] = [
  'COM_ERRO',
  'NUNCA_TENTADA',
  'ATRASADA',
  'PENDENTE',
  'EM_DIA',
  'FORA_DO_PLANO',
  'BLOQUEADA',
];

export const CAPTURE_STATUS_LABELS: Record<CaptureStatus, string> = {
  EM_DIA: 'Em dia',
  PENDENTE: 'Pendente',
  ATRASADA: 'Atrasada',
  COM_ERRO: 'Com erro',
  NUNCA_TENTADA: 'Nunca tentada',
  FORA_DO_PLANO: 'Fora do plano',
  BLOQUEADA: 'Bloqueada',
};

/** Legenda: o que cada situação quer dizer (o texto acompanha a cor, nunca só a cor). */
export const CAPTURE_STATUS_HINTS: Record<CaptureStatus, string> = {
  COM_ERRO: 'A última tentativa de alguma etapa falhou. O motivo aparece na linha.',
  NUNCA_TENTADA: 'Tem direito à captura, mas a fila ainda não chegou nela.',
  ATRASADA: 'Sem verificação completa no prazo (SIEG 24 h; SEFAZ e ADN 3 h), ou eventos e NFS-e sem varredura.',
  PENDENTE: 'Verificada, mas o SIEG informa mais notas do que as que estão no Taxify.',
  EM_DIA: 'Verificada no prazo, sem nota faltando e sem falha.',
  FORA_DO_PLANO: 'O plano vigente não tem a captura deste canal.',
  BLOQUEADA: 'Escritório em somente leitura: as capturas estão paradas.',
};

export const CAPTURE_STATUS_TONES: Record<CaptureStatus, string> = {
  EM_DIA: 'ok',
  PENDENTE: 'warn',
  ATRASADA: 'warn',
  COM_ERRO: 'danger',
  NUNCA_TENTADA: 'info',
  FORA_DO_PLANO: '',
  BLOQUEADA: '',
};

export const CAPTURE_CHANNEL_LABELS: Record<CaptureChannel, string> = {
  SIEG: 'SIEG',
  SEFAZ: 'SEFAZ',
  ADN: 'ADN (NFS-e Nacional)',
};

export const CAPTURE_DOC_TYPE_LABELS: Record<CaptureDocType, string> = {
  NFE_RECEBIDAS: 'NF-e recebidas',
  NFE_EMITIDAS: 'NF-e emitidas',
  EVENTOS: 'Eventos',
  NFSE: 'NFS-e',
};

export const CAPTURE_SORT_LABELS: Record<CaptureSort, string> = {
  status: 'Pior situação primeiro',
  name: 'Nome da empresa',
  nextAttempt: 'Próxima tentativa',
};

export const CAPTURE_STAGE_LABELS: Record<CaptureStage, string> = {
  SIEG_RECEIVED: 'SIEG: NF-e recebidas',
  SIEG_ISSUED: 'SIEG: NF-e emitidas',
  SIEG_EVENTS_RECEIVED: 'SIEG: eventos das recebidas',
  SIEG_EVENTS_ISSUED: 'SIEG: eventos das emitidas',
  SIEG_NFSE: 'SIEG: NFS-e',
  SIEG_RECOVERY: 'SIEG: recuperação dos meses bloqueados',
  SEFAZ_DIST: 'SEFAZ (distribuição de NF-e)',
  NFSE_ADN: 'Ambiente Nacional da NFS-e',
};

export const CAPTURE_DIRECT_LAST_STATUS_LABELS: Record<CaptureDirectLastStatus, string> = {
  OK: 'OK',
  SEM_MOVIMENTO: 'Sem movimento',
  ERRO: 'Erro',
};

/**
 * Textos da CP-RN-11, usados só quando a API não manda a `message` pronta. `{status}` e `{count}` são trocados pelo
 * `providerStatus` e pelo `warningCount`. A data do `CERT_EXPIRED` só vem na mensagem do backend.
 */
export const CAPTURE_FAILURE_MESSAGES: Record<string, string> = {
  SIEG_API_KEY_MISSING: 'O escritório não tem a chave da API do SIEG cadastrada em Integrações.',
  SIEG_AUTH: 'O SIEG recusou a chave da API do escritório (HTTP {status}). Confira a chave em Integrações.',
  SIEG_RATE_LIMITED: 'O SIEG recusou por excesso de requisições. A próxima volta tenta de novo.',
  SIEG_REJECTED: 'O SIEG recusou a consulta (HTTP {status}).',
  SIEG_UNAVAILABLE: 'O SIEG respondeu com erro (HTTP {status}). A próxima volta tenta de novo.',
  SIEG_TIMEOUT: 'O SIEG não respondeu a tempo.',
  SIEG_CONNECTION: 'Não foi possível conectar ao SIEG.',
  SIEG_INVALID_RESPONSE: 'O SIEG devolveu uma resposta que o Taxify não conseguiu ler.',
  SIEG_COUNT_FAILED: 'A contagem do SIEG falhou. As notas foram baixadas, mas o total do SIEG não foi atualizado.',
  XML_PARSE_ERRORS: '{count} XML(s) não puderam ser lidos nesta volta.',
  XML_STORAGE_FAILED: 'Falha ao guardar o XML no armazenamento do Taxify.',
  COMPANY_WITHOUT_CNPJ: 'A empresa não tem CNPJ cadastrado.',
  COMPANY_WITHOUT_UF: 'A UF da empresa não está cadastrada.',
  CERT_MISSING: 'Não há certificado A1 desta empresa ou da matriz.',
  CERT_EXPIRED: 'O certificado A1 venceu.',
  CERT_FILE_MISSING: 'O arquivo do certificado não foi encontrado. Envie o certificado de novo.',
  CERT_INVALID: 'O certificado A1 não pôde ser aberto. Envie o certificado de novo.',
  SEFAZ_REJECTED: 'A SEFAZ recusou a consulta (cStat {status}).',
  SEFAZ_CONSUMO_INDEVIDO: 'A SEFAZ pediu para esperar 1 hora antes de consultar de novo.',
  SEFAZ_TIMEOUT: 'A SEFAZ não respondeu a tempo.',
  SEFAZ_CONNECTION: 'Não foi possível conectar à SEFAZ.',
  ADN_REJECTED: 'O Ambiente Nacional da NFS-e recusou a consulta (HTTP {status}).',
  ADN_TIMEOUT: 'O Ambiente Nacional não respondeu a tempo.',
  ADN_CONNECTION: 'Não foi possível conectar ao Ambiente Nacional.',
  INTERNAL_ERROR: 'Erro interno do Taxify nesta etapa. O suporte da CS Hub vê o detalhe no log.',
  SIEG_RECOVERY_GAVE_UP:
    'A recuperação dos meses bloqueados desistiu depois de várias tentativas; os meses que faltaram não serão buscados de novo automaticamente.',
  LEGACY_ERROR: 'Erro registrado antes do painel. Veja a aba Certificado da empresa.',
};

/** Codes de erro novos do "Sincronizar agora" (CP-RN-17). O 403 de escritório bloqueado é o da fase 1. */
export const CAPTURE_ERRORS = {
  firmBlocked: 'error.capture.priority.firm.blocked',
  notInPlan: 'error.capture.priority.not.in.plan',
  unavailable: 'error.capture.priority.unavailable',
  cooldown: 'error.capture.priority.cooldown',
  firmOpenLimit: 'error.capture.priority.firm.open.limit',
  firmDailyLimit: 'error.capture.priority.firm.daily.limit',
} as const;

/** Posição da API (0 = a próxima) como a tela mostra (1 = a próxima). Nulo continua nulo. */
export function displayPosition(apiPosition: number | null | undefined): number | null {
  return typeof apiPosition === 'number' && apiPosition >= 0 ? apiPosition + 1 : null;
}
