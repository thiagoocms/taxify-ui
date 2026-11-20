export interface CompanyDTO {
  id?: string;
  documentNumber: string;
  documentType: string;
  name: string;
  // Dados cadastrais opcionais (preenchidos à mão ou pela importação do Acessórias).
  tradeName?: string | null;
  phone?: string | null;
  uf?: string | null;
  taxRegime?: string | null;
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
