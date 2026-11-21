import { IntegrationType } from './integration.model';

export type SyncStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** Job em segundo plano de uma integração (sincronização de cobrança, importação do Acessórias). */
export interface SyncJobStatusDTO<R> {
  type: IntegrationType | null;
  /** null quando o job nunca rodou. */
  status: SyncStatus | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  processed?: number | null;
  /** null enquanto o job ainda não sabe quantos itens vai processar. */
  total?: number | null;
  /** Resumo da última execução concluída (continua disponível enquanto uma nova roda). */
  result?: R | null;
  /** Motivo da falha da última execução. */
  error?: string | null;
}

export function isRunning(job: SyncJobStatusDTO<unknown> | null | undefined): boolean {
  return job?.status === 'RUNNING';
}

/** "45 de 200" / "45" / "" — para o texto de andamento. */
export function progressLabel(job: SyncJobStatusDTO<unknown> | null | undefined): string {
  if (!isRunning(job)) {
    return '';
  }
  const processed = job?.processed ?? 0;
  return job?.total != null ? `${processed} de ${job.total}` : `${processed}`;
}
