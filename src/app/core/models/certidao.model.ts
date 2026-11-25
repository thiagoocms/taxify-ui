/** Certidão SEFAZ-PE (M5): a certidão estadual lida do PDF e o resumo da carteira. */

export type CertidaoSituacao = 'NEGATIVA' | 'POSITIVA' | 'POSITIVA_EFEITO_NEGATIVA';
/** SEM_CERTIDAO, VALIDA, A_VENCER (15 dias ou menos) ou VENCIDA. */
export type CertidaoStatus = 'SEM_CERTIDAO' | 'VALIDA' | 'A_VENCER' | 'VENCIDA';

export interface CertidaoDTO {
  id: string;
  uf: string;
  tipo: 'CRF' | 'CND';
  tipoLabel: string;
  numero?: string | null;
  situacao: CertidaoSituacao;
  situacaoLabel: string;
  emitidaEm?: string | null;
  validaAte?: string | null;
  status: CertidaoStatus;
  diasRestantes: number;
  origem: 'UPLOAD' | 'EFISCO';
  fileName?: string | null;
  importedAt: string;
  importedBy: string;
  hasPdf: boolean;
}

export interface CertidaoSummaryDTO {
  companyId: string;
  status: CertidaoStatus;
  situacao?: CertidaoSituacao | null;
  situacaoLabel?: string | null;
  validaAte?: string | null;
  certidaoId?: string | null;
  hasPdf: boolean;
}

export interface CompanyCertidaoDTO {
  aplicavel: boolean;
  motivo?: string | null;
  atual?: CertidaoDTO | null;
  historico: CertidaoDTO[];
  ultimaTentativa?: { at: string; status: string; detail?: string | null } | null;
  /** Página pública do e-Fisco onde a certidão é emitida (com a verificação humana). */
  paginaEmissao: string;
}

export interface CertidaoIssueResultDTO {
  status: 'OK' | 'ERRO';
  detail?: string | null;
  paginaEmissao: string;
  certidao: CompanyCertidaoDTO;
}

/** Selo da certidão: a situação manda (positiva = vermelho), depois a validade. */
export function certidaoBadge(status: CertidaoStatus, situacao?: CertidaoSituacao | null): { label: string; cls: string } {
  if (status === 'SEM_CERTIDAO') {
    return { label: 'Sem certidão', cls: '' };
  }
  if (status === 'VENCIDA') {
    return { label: 'Vencida', cls: 'danger' };
  }
  if (situacao === 'POSITIVA') {
    return { label: 'Positiva', cls: 'danger' };
  }
  if (status === 'A_VENCER') {
    return { label: 'A vencer', cls: 'warn' };
  }
  if (situacao === 'POSITIVA_EFEITO_NEGATIVA') {
    return { label: 'Positiva c/ efeito de negativa', cls: 'info' };
  }
  return { label: 'Negativa', cls: 'ok' };
}
