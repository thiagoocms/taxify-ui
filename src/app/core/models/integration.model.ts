export type IntegrationType = 'SIEG' | 'ACESSORIAS' | 'CONTA_AZUL';

/** O que o front vê de uma integração — nunca a credencial em si. */
export interface FirmIntegrationStatusDTO {
  type: IntegrationType;
  /** Configurada colando uma chave de API (SIEG, Acessórias) em vez de login OAuth. */
  apiKeyBased: boolean;
  configured: boolean;
  /** Chave mascarada ("••••1234") quando há uma salva. */
  apiKeyHint?: string | null;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
}

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  SIEG: 'SIEG',
  ACESSORIAS: 'Acessórias',
  CONTA_AZUL: 'Conta Azul',
};
