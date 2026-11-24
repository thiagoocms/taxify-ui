import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingOverlayService } from '../../shared/components/loader/loading-overlay.service';

/** Marque a requisição com `new HttpContext().set(SKIP_ACTION_LOADING, true)` para não ligar o véu. */
export const SKIP_ACTION_LOADING = new HttpContextToken<boolean>(() => false);

/** Só liga o véu se a ação passar disso: salvar rápido não pisca a tela. */
const DELAY_MS = 400;

/**
 * POST/PUT/DELETE que não são ação do usuário, ou que a tela já mostra o andamento do próprio jeito:
 * buscas e totais (listas por POST), teste da fórmula enquanto digita, registro de auditoria, login,
 * e as ações com véu próprio sobre a tabela (manifestação, auditar, atualizar pendências).
 */
const SKIP = [
  /\/integrations\/xmls\/?$/, /\/integrations\/xmls\/totais$/, /\/notas-servico\/(buscar|totais)$/, /\/regras\/testar$/,
  /\/invoice-audit-log/, /\/auth(\/|$)/, /\/manifestacao$/, /\/auditoria\/executar$/, /\/pendencias\/atualizar$/,
];

function messageFor(method: string, url: string): string {
  if (/importar/.test(url)) return 'Importando...';
  if (/exportar|relatorio/.test(url)) return 'Gerando o arquivo...';
  if (/sincronizar|\/sync$|capturar|\/import$/.test(url)) return 'Sincronizando...';
  if (/memoria\/buscar/.test(url)) return 'Buscando no e-Fisco...';
  if (/reenviar-ciencia/.test(url)) return 'Enviando à SEFAZ...';
  if (/fechamento/.test(url)) return method === 'DELETE' ? 'Reabrindo o mês...' : 'Fechando o mês...';
  if (method === 'DELETE') return 'Excluindo...';
  if (method === 'PUT') return 'Salvando...';
  return 'Processando...';
}

/** As ações do usuário (salvar, excluir, enviar, importar...) que demoram ligam o véu de carregando por cima da tela. */
export const actionLoadingInterceptor: HttpInterceptorFn = (req, next) => {
  const isAction = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH';
  const path = req.url.split('?')[0];
  if (!isAction || req.context.get(SKIP_ACTION_LOADING) || SKIP.some((pattern) => pattern.test(path))) {
    return next(req);
  }
  const overlay = inject(LoadingOverlayService);
  let release: (() => void) | null = null;
  const timer = setTimeout(() => (release = overlay.show(messageFor(req.method, path))), DELAY_MS);
  return next(req).pipe(
    finalize(() => {
      clearTimeout(timer);
      release?.();
    }),
  );
};
