import { Observable, switchMap, takeWhile, timer } from 'rxjs';
import { isRunning, SyncJobStatusDTO } from '../models/sync-job.model';

const POLL_INTERVAL_MS = 3000;

/**
 * Consulta o status de um job a cada poucos segundos até ele sair de RUNNING. Emite cada
 * status (para mostrar o andamento) e, por último, o final (SUCCEEDED / FAILED).
 */
export function pollUntilDone<R>(
  fetchStatus: () => Observable<SyncJobStatusDTO<R>>,
  intervalMs = POLL_INTERVAL_MS,
): Observable<SyncJobStatusDTO<R>> {
  return timer(0, intervalMs).pipe(
    switchMap(() => fetchStatus()),
    takeWhile((job) => isRunning(job), true),
  );
}
