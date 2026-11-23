/** Entrada ou saída para a empresa (ver FiscalDirection.java). */
export type FiscalDirection = 'INBOUND' | 'OUTBOUND';

export const DIRECTION_LABELS: Record<FiscalDirection, string> = { INBOUND: 'Entrada', OUTBOUND: 'Saída' };

/** Conferência da nota pela equipe fiscal antes de escriturar. */
export type ReviewStatus = 'PENDING' | 'REVIEWED' | 'DIVERGENT';

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'A conferir',
  REVIEWED: 'Conferida',
  DIVERGENT: 'Divergência',
};

/** Situação na SEFAZ, pelos eventos: cancelada quando chega um cancelamento registrado. */
export type FiscalDocumentStatus = 'AUTHORIZED' | 'CANCELED';

/** Evento SEFAZ de uma nota (cancelamento, carta de correção, manifestação). */
export interface FiscalXmlEventDTO {
  /** tpEvento: 110111 cancelamento, 110110 carta de correção, 2102x0 manifestação... */
  type: string;
  description?: string | null;
  sequence: number;
  eventAt?: string | null;
  protocol?: string | null;
  /** Justificativa (cancelamento) ou texto da correção (CC-e). */
  text?: string | null;
  registered: boolean;
}

export const EVENT_LABELS: Record<string, string> = {
  '110111': 'Cancelamento',
  '110112': 'Cancelamento por substituição',
  '110110': 'Carta de correção',
  '210200': 'Confirmação da operação',
  '210210': 'Ciência da operação',
  '210220': 'Desconhecimento da operação',
  '210240': 'Operação não realizada',
};

export interface FiscalXmlSearchFilterDTO {
  companyId: string;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  numero?: string;
  /** Só entradas ou só saídas; vazio = todas. */
  direction?: FiscalDirection;
  /** Parte do nome do fornecedor/cliente, ou o CNPJ/CPF dele. */
  participant?: string;
  /** Situação da conferência; vazio = todas. */
  reviewStatus?: ReviewStatus;
  /** De onde a nota veio primeiro; vazio = qualquer. */
  origem?: FiscalXmlOrigin;
  /** Confronto SIEG × SEFAZ: SO_SIEG / SO_SEFAZ = há mais de 48h numa fonte e não na outra. */
  fonte?: 'SO_SIEG' | 'SO_SEFAZ';
  // Unlike the other list endpoints, this one nests the page/size under a
  // "pagination" object in the request body instead of taking them flat.
  pagination?: { page: number; size: number; sort?: string; direction?: 'ASC' | 'DESC' };
}

export interface FiscalXmlExportFilterDTO {
  companyId: string;
  xmlType: number;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
}

export interface FiscalXmlEnderecoDTO {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codigoMunicipio?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigoPais?: string;
  pais?: string;
  telefone?: string;
}

export interface FiscalXmlIdentificacaoDTO {
  codigoUf?: string;
  naturezaOperacao?: string;
  modelo?: string;
  serie?: string;
  numero?: string;
  dataEmissao?: string;
  dataSaidaEntrada?: string;
  tipoOperacao?: string;
  destinoOperacao?: string;
  codigoMunicipioFatoGerador?: string;
  tipoImpressao?: string;
  tipoEmissao?: string;
  digitoVerificador?: string;
  ambiente?: string;
  finalidadeEmissao?: string;
  consumidorFinal?: string;
  indicadorPresenca?: string;
  processoEmissao?: string;
  versaoProcessoEmissao?: string;
}

export interface FiscalXmlEmitenteDTO {
  cnpj?: string;
  cpf?: string;
  nome?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoEstadualSubstitutoTributario?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario?: string;
  endereco?: FiscalXmlEnderecoDTO;
}

export interface FiscalXmlDestinatarioDTO {
  cnpj?: string;
  cpf?: string;
  idEstrangeiro?: string;
  nome?: string;
  inscricaoEstadual?: string;
  indicadorIe?: string;
  email?: string;
  endereco?: FiscalXmlEnderecoDTO;
}

export interface FiscalXmlImpostoItemDTO {
  situacaoTributariaIcms?: string;
  baseCalculoIcms?: number;
  aliquotaIcms?: number;
  valorIcms?: number;
  situacaoTributariaIpi?: string;
  valorIpi?: number;
  situacaoTributariaPis?: string;
  valorPis?: number;
  situacaoTributariaCofins?: string;
  valorCofins?: number;
}

export interface FiscalXmlProdutoDTO {
  numeroItem?: number;
  codigo?: string;
  codigoBarras?: string;
  descricao?: string;
  ncm?: string;
  cfop?: string;
  /** CFOP as issued, only when the rectified version changed it (cfop then holds the rectified one). */
  cfopEmitido?: string;
  unidadeComercial?: string;
  quantidadeComercial?: number;
  valorUnitarioComercial?: number;
  valorTotal?: number;
  unidadeTributavel?: string;
  quantidadeTributavel?: number;
  valorUnitarioTributavel?: number;
  impostos?: FiscalXmlImpostoItemDTO;
}

export interface FiscalXmlTotaisDTO {
  baseCalculoIcms?: number;
  valorIcms?: number;
  valorIcmsDesonerado?: number;
  valorFcp?: number;
  baseCalculoIcmsSt?: number;
  valorIcmsSt?: number;
  valorFcpSt?: number;
  valorProdutos?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorDesconto?: number;
  valorImportacao?: number;
  valorIpi?: number;
  valorPis?: number;
  valorCofins?: number;
  valorOutrasDespesas?: number;
  valorTotalNota?: number;
  valorAproximadoTributos?: number;
}

export interface FiscalXmlItemDTO {
  accessKey?: string;
  documentType?: string;
  issuerCnpj?: string;
  recipientCnpj?: string;
  issueDate?: string;
  identificacao?: FiscalXmlIdentificacaoDTO;
  emitente?: FiscalXmlEmitenteDTO;
  destinatario?: FiscalXmlDestinatarioDTO;
  totais?: FiscalXmlTotaisDTO;
  produtos?: FiscalXmlProdutoDTO[];
  xmlContent?: string;
}

/** One row of the notes list — built from DB columns only, no XML content. */
export interface FiscalXmlSummaryDTO {
  id: string;
  accessKey?: string;
  documentType?: string;
  issueDate?: string;
  modelo?: string;
  serie?: string;
  numero?: string;
  tipoOperacao?: string;
  naturezaOperacao?: string;
  emitenteNome?: string;
  issuerCnpj?: string;
  emitenteCpf?: string;
  destinatarioNome?: string;
  recipientCnpj?: string;
  destinatarioCpf?: string;
  valorTotalNota?: number;
  quantidadeItens: number;
  retificada: boolean;
  direction?: FiscalDirection;
  /** Emitida pela própria empresa (não pode ser retificada). */
  ownIssue: boolean;
  status?: FiscalDocumentStatus;
  reviewStatus?: ReviewStatus;
  /** CFOPs distintos dos itens: um só = a nota inteira usa ele; mais de um = segmentado. */
  cfops?: string[];
  /** De onde a nota veio primeiro. */
  origem?: FiscalXmlOrigin | null;
}

/** Totais do período por direção (cards acima da lista). */
export interface FiscalXmlDirectionTotalsDTO {
  count: number;
  total: number;
  icms: number;
  icmsSt: number;
  ipi: number;
  pis: number;
  cofins: number;
  /** Canceladas no período — aparecem na lista, mas ficam fora dos totais acima. */
  canceledCount: number;
}

export interface FiscalXmlTotalsDTO {
  inbound: FiscalXmlDirectionTotalsDTO;
  outbound: FiscalXmlDirectionTotalsDTO;
}

/** Detail page header — items and raw XML come from their own endpoints. */
export interface FiscalXmlDetailDTO {
  id: string;
  companyId: string;
  accessKey?: string;
  documentType?: string;
  issuerCnpj?: string;
  recipientCnpj?: string;
  issueDate?: string;
  retificada: boolean;
  quantidadeItens: number;
  identificacao?: FiscalXmlIdentificacaoDTO;
  emitente?: FiscalXmlEmitenteDTO;
  destinatario?: FiscalXmlDestinatarioDTO;
  totais?: FiscalXmlTotaisDTO;
  direction?: FiscalDirection;
  ownIssue: boolean;
  status?: FiscalDocumentStatus;
  canceledAt?: string | null;
  reviewStatus?: ReviewStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  /** De onde a nota veio primeiro. */
  origem?: FiscalXmlOrigin | null;
  /** Quando o SIEG / a SEFAZ trouxe a nota (vazio = a fonte nunca trouxe, ou é anterior a esse controle). */
  encontradaSiegEm?: string | null;
  encontradaSefazEm?: string | null;
}

/** Fonte de onde a nota veio primeiro. */
export type FiscalXmlOrigin = 'SIEG' | 'SEFAZ_DIST' | 'UPLOAD';

export const ORIGIN_LABELS: Record<FiscalXmlOrigin, string> = {
  SIEG: 'SIEG',
  SEFAZ_DIST: 'SEFAZ',
  UPLOAD: 'Upload',
};

export interface FiscalXmlDownloadResultDTO {
  totalItemsFound?: number;
  totalXmlsCounted?: number;
  totalPersistedNew?: number;
  totalDuplicatedSkipped?: number;
  totalParseErrors?: number;
  persistedAccessKeys?: string[];
  xmls?: FiscalXmlItemDTO[];
}

export interface FiscalXmlRectificationResultDTO {
  documentId?: string;
  accessKey?: string;
  originalFilePath?: string;
  rectifiedFilePath?: string;
  correcoesAplicadas?: string[];
}

/** Manifestação do destinatário: a ciência e as três conclusivas. */
export type ManifestationType = 'CIENCIA' | 'CONFIRMACAO' | 'DESCONHECIMENTO' | 'NAO_REALIZADA';

export const MANIFESTATION_LABELS: Record<ManifestationType, string> = {
  CIENCIA: 'Ciência da Operação',
  CONFIRMACAO: 'Confirmação da Operação',
  DESCONHECIMENTO: 'Desconhecimento da Operação',
  NAO_REALIZADA: 'Operação não Realizada',
};

/** Nota de entrada que ainda deve uma manifestação conclusiva. */
export interface ManifestationNoteDTO {
  chave: string;
  /** Nota guardada; null = a SEFAZ só entregou o resumo. */
  notaId?: string | null;
  numero?: string | null;
  serie?: string | null;
  emitenteNome?: string | null;
  emitenteDocumento?: string | null;
  dataEmissao?: string | null;
  valorTotal?: number | null;
  xmlCompleto: boolean;
  ciencia: boolean;
  /** Último dia para manifestar (180 dias da autorização). */
  prazo?: string | null;
  diasRestantes: number;
}

export interface ManifestationPendingDTO {
  /** O plano tem a Manifestação do destinatário. */
  habilitada: boolean;
  /** A empresa tem A1 válido para assinar. */
  certificado: boolean;
  notas: ManifestationNoteDTO[];
}

export interface ManifestationRequestDTO {
  companyId: string;
  tipo: ManifestationType;
  justificativa?: string;
  chaves: string[];
}

export interface ManifestationResultDTO {
  registradas: number;
  recusadas: number;
  itens: { chave: string; ok: boolean; codigo?: string | null; mensagem?: string | null }[];
}
