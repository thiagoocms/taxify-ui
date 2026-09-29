export interface FiscalXmlSearchFilterDTO {
  companyId: string;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  numero?: string;
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
