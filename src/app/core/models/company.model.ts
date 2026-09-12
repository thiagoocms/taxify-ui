export interface CompanyDTO {
  id?: string;
  documentNumber: string;
  documentType: string;
  name: string;
  deleted?: boolean;
}

export interface CompanyFilterDTO {
  id?: string;
  documentNumber?: string;
  documentType?: string;
  name?: string;
  deleted?: boolean;
}
