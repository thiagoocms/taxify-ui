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
  sefaz?: SefazDistStatusDTO | null;
}
