import { BusinessActivity, SimplesAnnex, TaxRegime } from './tax-assessment.model';

export interface CompanyDTO {
  id?: string;
  documentNumber: string;
  documentType: string;
  name: string;
  // Dados cadastrais opcionais (preenchidos à mão ou pela importação do Acessórias).
  tradeName?: string | null;
  phone?: string | null;
  uf?: string | null;
  /** Rótulo do regime (como vem do Acessórias); o que vale são os campos estruturados abaixo. */
  taxRegime?: string | null;
  taxRegimeType?: TaxRegime | null;
  businessActivity?: BusinessActivity | null;
  /** Anexo do Simples para serviços (III, IV ou V); vazio = III. */
  simplesServiceAnnex?: SimplesAnnex | null;
  /** "IE/UF; IE/UF" */
  stateRegistration?: string | null;
  /** Data de abertura (AAAA-MM-DD) — início de atividade para o RBT12 proporcional. */
  openingDate?: string | null;
  email?: string | null;
  municipalRegistration?: string | null;
  /** Só dígitos. */
  mainCnae?: string | null;
  /** Só dígitos, separados por vírgula. */
  secondaryCnaes?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  /** Código IBGE do município. */
  addressCityCode?: string | null;
  addressCity?: string | null;
  addressZipCode?: string | null;
  /** Só no envio: mês ("2026-01") em que a mudança de regime passa a valer; vazio = mês atual. */
  taxRegimeValidFrom?: string | null;
  companyGroup?: string | null;
  active?: boolean | null;
  clientSince?: string | null;
  clientUntil?: string | null;
  /** Somente leitura: ID da empresa no Acessórias, definido pela importação. */
  acessoriasId?: string | null;
  deleted?: boolean;
}

export interface CompanyFilterDTO {
  id?: string;
  documentNumber?: string;
  documentType?: string;
  name?: string;
  deleted?: boolean;
  /** Busca livre: parte do nome OU do CNPJ/CPF (com ou sem pontuação). */
  search?: string;
}

/** Um período do histórico de regime; validFrom/validUntil em "AAAA-MM", null = sempre / atual. */
export interface CompanyTaxRegimeDTO {
  id?: string;
  taxRegime: TaxRegime;
  businessActivity?: BusinessActivity | null;
  simplesServiceAnnex?: SimplesAnnex | null;
  validFrom?: string | null;
  validUntil?: string | null;
  label?: string | null;
}

/** Uma nota que a SEFAZ entregou só como resumo (a empresa é destinatária e o XML completo ainda não veio). */
export interface SefazNoteSummaryDTO {
  chave: string;
  emitenteDocumento?: string | null;
  emitenteNome?: string | null;
  dataEmissao?: string | null;
  valorTotal?: number | null;
  /** cSitNFe: 1 autorizada, 2 denegada, 3 cancelada. */
  situacao?: string | null;
  ciencia: 'PENDENTE' | 'ENVIADA' | 'ERRO';
  cienciaEm?: string | null;
  cienciaDetalhe?: string | null;
  cienciaTentativas: number;
  ultimaBuscaEm?: string | null;
  buscaDetalhe?: string | null;
  recebidoEm?: string | null;
}

/** Notas só com resumo, a Ciência da Operação delas e o confronto SIEG × SEFAZ. */
export interface SefazNotesDTO {
  autoCiencia: boolean;
  aguardandoCiencia: number;
  aguardandoXml: number;
  comErro: number;
  /** null = o plano não tem as duas fontes. */
  soSieg?: number | null;
  soSefaz?: number | null;
  notas: SefazNoteSummaryDTO[];
}

/** Situação da última captura de XML pela SEFAZ (NFeDistribuicaoDFe). */
export interface SefazDistStatusDTO {
  lastRunAt?: string | null;
  lastStatus?: 'OK' | 'SEM_MOVIMENTO' | 'ERRO' | null;
  lastDetail?: string | null;
  lastNewNotes?: number | null;
  lastSummaries?: number | null;
  nextQueryAt?: string | null;
  ultNsu?: string | null;
  maxNsu?: string | null;
}

/** Certificado A1 usado na captura da SEFAZ: o da empresa ou, numa filial, o da mesma raiz de CNPJ. */
export interface CompanyCertificateDTO {
  present: boolean;
  inherited: boolean;
  ownerCompanyId?: string | null;
  ownerCompanyName?: string | null;
  subjectName?: string | null;
  cnpj?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  expired: boolean;
  encryptionConfigured: boolean;
  /** O plano de hoje tem "Importação de XML fiscal" + "Integração SEFAZ". */
  sefazInPlan: boolean;
  sefaz?: SefazDistStatusDTO | null;
}
