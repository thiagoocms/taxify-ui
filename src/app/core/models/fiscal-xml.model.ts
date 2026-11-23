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
}

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
