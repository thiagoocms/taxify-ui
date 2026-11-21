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
  stateRegistration?: string | null;
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
