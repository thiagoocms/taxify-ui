export interface AccountingFirmDTO {
  id?: string;
  name: string;
  siegApiKey?: string;
  acessoriasApiToken?: string;
  /** Somente leitura: quando rodou a última importação do Acessórias. */
  acessoriasLastSyncAt?: string;
  deleted?: boolean;
}

export interface AccountingFirmFilterDTO {
  id?: string;
  name?: string;
  deleted?: boolean;
}
