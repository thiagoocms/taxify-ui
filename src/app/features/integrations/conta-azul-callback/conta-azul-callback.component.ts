import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from '../../../shared/components/button/button';
import { ContaAzulService } from '../../../core/services/conta-azul.service';
import { CONTA_AZUL_CHANNEL, ContaAzulPopupMessage } from '../../../core/services/conta-azul-popup';

/**
 * Destino do redirect da Conta Azul após o login (é este endereço que vai em
 * CONTA_AZUL_REDIRECT_URI): pega ?code=&state= e envia ao backend com a sessão do usuário.
 * Avisa a aba de origem pelo BroadcastChannel; se ela responder, estamos na janela pop-up
 * e ela se fecha sozinha. Sem resposta (fluxo na mesma aba), mostra o resultado aqui.
 */
@Component({
  selector: 'app-conta-azul-callback',
  standalone: true,
  imports: [Button],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center gap-3 py-5 px-3 text-center min-vh-100">
      @if (status() === 'loading') {
        <span class="spinner-border" role="status"></span>
        <p class="mb-0">Concluindo a conexão com a Conta Azul...</p>
      } @else if (status() === 'success') {
        <h5 class="mb-0">Conta Azul conectada</h5>
        <p class="text-muted mb-0">
          {{ inPopup() ? 'Você já pode fechar esta janela.' : 'O Taxify já pode acessar os dados da sua conta Conta Azul.' }}
        </p>
        <app-button [label]="inPopup() ? 'Fechar janela' : 'Voltar ao início'" (onClick)="finish()"></app-button>
      } @else {
        <h5 class="mb-0">Não foi possível conectar a Conta Azul</h5>
        <p class="text-muted mb-0">{{ errorMessage() }}</p>
        <app-button [label]="inPopup() ? 'Fechar janela' : 'Voltar ao início'" (onClick)="finish()"></app-button>
      }
    </div>
  `,
})
export class ContaAzulCallbackComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contaAzulService = inject(ContaAzulService);
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CONTA_AZUL_CHANNEL) : null;

  readonly status = signal<'loading' | 'success' | 'error'>('loading');
  readonly errorMessage = signal('');
  readonly inPopup = signal(false);

  ngOnInit(): void {
    // A aba que abriu o pop-up responde "ack": então estamos na janela pequena e ela fecha.
    this.channel?.addEventListener('message', (event: MessageEvent<ContaAzulPopupMessage>) => {
      if (event.data?.type === 'ack') {
        this.inPopup.set(true);
        window.close();
      }
    });

    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error_description') || params.get('error');

    // Tira code/state da barra de endereço (não devem ficar no histórico do navegador).
    this.router.navigate([], { queryParams: {}, replaceUrl: true });

    if (providerError || !code || !state) {
      this.fail(providerError || 'A Conta Azul não retornou o código de autorização. Tente conectar novamente.');
      return;
    }

    this.contaAzulService.completeAuthorization(code, state).subscribe({
      next: () => {
        this.status.set('success');
        this.notify({ type: 'result', ok: true });
      },
      error: (err) => this.fail(err?.error?.message || 'A autorização expirou ou é inválida. Tente conectar novamente.'),
    });
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  finish(): void {
    if (this.inPopup()) {
      window.close();
      return;
    }
    this.router.navigate(['/home']);
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.status.set('error');
    this.notify({ type: 'result', ok: false, message });
  }

  private notify(message: ContaAzulPopupMessage): void {
    this.channel?.postMessage(message);
  }
}
