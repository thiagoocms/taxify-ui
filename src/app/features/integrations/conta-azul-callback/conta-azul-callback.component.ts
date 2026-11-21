import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Button } from '../../../shared/components/button/button';
import { ContaAzulService } from '../../../core/services/conta-azul.service';

/**
 * Destino do redirect da Conta Azul após o login (é este endereço que vai em
 * CONTA_AZUL_REDIRECT_URI): pega ?code=&state= e envia ao backend com a sessão do usuário.
 */
@Component({
  selector: 'app-conta-azul-callback',
  standalone: true,
  imports: [Button],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center gap-3 py-5 text-center">
      @if (status() === 'loading') {
        <span class="spinner-border" role="status"></span>
        <p class="mb-0">Concluindo a conexão com a Conta Azul...</p>
      } @else if (status() === 'success') {
        <h5 class="mb-0">Conta Azul conectada</h5>
        <p class="text-muted mb-0">O Taxify já pode acessar os dados da sua conta Conta Azul.</p>
        <app-button label="Voltar ao início" (onClick)="goHome()"></app-button>
      } @else {
        <h5 class="mb-0">Não foi possível conectar a Conta Azul</h5>
        <p class="text-muted mb-0">{{ errorMessage() }}</p>
        <app-button label="Voltar ao início" (onClick)="goHome()"></app-button>
      }
    </div>
  `,
})
export class ContaAzulCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly contaAzulService = inject(ContaAzulService);

  readonly status = signal<'loading' | 'success' | 'error'>('loading');
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error_description') || params.get('error');

    if (providerError || !code || !state) {
      this.fail(providerError || 'A Conta Azul não retornou o código de autorização. Tente conectar novamente.');
      return;
    }

    // Tira code/state da barra de endereço (não devem ficar no histórico do navegador).
    this.router.navigate([], { queryParams: {}, replaceUrl: true });

    this.contaAzulService.completeAuthorization(code, state).subscribe({
      next: () => {
        this.status.set('success');
        this.toastr.success('Conta Azul conectada.');
      },
      error: (err) => this.fail(err?.error?.message || 'A autorização expirou ou é inválida. Tente conectar novamente.'),
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.status.set('error');
  }
}
