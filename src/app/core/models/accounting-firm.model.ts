export interface AccountingFirmDTO {
  id?: string;
  name: string;
  siegApiKey?: string;
  deleted?: boolean;
}

export interface AccountingFirmFilterDTO {
  id?: string;
  name?: string;
  deleted?: boolean;
}
