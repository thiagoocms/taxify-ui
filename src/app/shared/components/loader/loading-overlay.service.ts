import { computed, Injectable, signal } from '@angular/core';

/**
 * O carregando de tela, um só: cada <app-loader> de tela (e a troca de rota) pede o véu e devolve ao sair.
 * Vários pedidos ao mesmo tempo mostram um véu só, com a mensagem do mais recente.
 */
@Injectable({ providedIn: 'root' })
export class LoadingOverlayService {
  private readonly requests = signal<{ id: number; message: string }[]>([]);
  private nextId = 0;

  readonly visible = computed(() => this.requests().length > 0);
  readonly message = computed(() => this.requests().at(-1)?.message ?? 'Carregando...');

  /** Liga o véu; chame a função devolvida para desligar. */
  show(message = 'Carregando...'): () => void {
    const id = ++this.nextId;
    // fora do ciclo de detecção de quem pediu (ngOnInit/ngOnDestroy do loader)
    queueMicrotask(() => this.requests.update((list) => [...list, { id, message }]));
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      queueMicrotask(() => this.requests.update((list) => list.filter((r) => r.id !== id)));
    };
  }
}
