/** Resumo de uma importação de empresas do Acessórias. */
export interface AcessoriasImportResultDTO {
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  linksCreated: number;
  /** Empresas não importadas, cada uma com o motivo. */
  skipped: string[];
  /**
   * Quantas ficaram de fora pelo limite do teste grátis (empresa nova sem vaga, ou inativa que voltou a "Ativa" e
   * continuou inativa). Também aparecem em `skipped`. Ausente em respostas de versões anteriores da API.
   */
  skippedByLimit?: number;
  /** Responsáveis ("Nome <email>") sem usuário com esse e-mail no Taxify. */
  responsiblesNotFound: string[];
  errors: string[];
}

/** Usuário do Acessórias, cruzado por e-mail com os usuários do escritório no Taxify. */
export interface AcessoriasUserSummaryDTO {
  acessoriasId: string;
  name: string | null;
  email: string | null;
  active: boolean;
  /** Usuário do Taxify com o mesmo e-mail; null quando ainda não existe. */
  taxifyUserId: string | null;
}
