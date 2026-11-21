export interface AccountingFirmDTO {
  id?: string;
  name: string;
  // Credenciais (SIEG, Acessórias, Conta Azul) ficam em /integrations — ver IntegrationService.
  deleted?: boolean;
}

export interface AccountingFirmFilterDTO {
  id?: string;
  name?: string;
  deleted?: boolean;
}
