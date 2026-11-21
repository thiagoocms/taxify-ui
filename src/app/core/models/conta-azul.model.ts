export interface ContaAzulConnectionStatusDTO {
  /** As credenciais do app Taxify (client id/secret) estão configuradas no servidor. */
  configured: boolean;
  /** O escritório já autorizou o Taxify na conta Conta Azul dele. */
  connected: boolean;
  connectedAt?: string | null;
}

export interface ContaAzulAuthorizeUrlDTO {
  url: string;
}
