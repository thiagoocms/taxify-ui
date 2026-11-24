import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { EfiscoService, FirmCertificateDTO } from '../../../core/services/efisco.service';
import { Button } from '../../../shared/components/button/button';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';

/**
 * Integrações → e-Fisco PE: o certificado A1 do contador (e-CPF). Com ele, o Taxify busca sozinho no e-Fisco o
 * extrato do Fronteira das empresas de PE da carteira - de tempos em tempos e pelo "Sincronizar" da tela.
 */
@Component({
  selector: 'app-efisco-certificate-card',
  standalone: true,
  imports: [DatePipe, FormsModule, Button],
  template: `
    <div class="integration-card">
      <div class="integration-head">
        <div>
          <div class="fw-semibold">e-Fisco PE · certificado do contador</div>
          @if (status(); as s) {
            @if (s.present) {
              <small [class]="s.expired ? 'text-danger' : 'text-success'">
                {{ s.holder }} · CPF {{ s.cpf }} · {{ s.expired ? 'vencido em' : 'válido até' }} {{ s.validUntil | date: 'dd/MM/yyyy' }}
              </small>
              @if (s.lastSyncAt) {
                <small class="text-muted d-block">
                  Última sincronização: {{ s.lastSyncAt | date: 'dd/MM/yyyy HH:mm' }} · {{ syncLabel(s.lastSyncStatus) }}
                </small>
              }
            } @else {
              <small class="text-muted">
                Não configurado. Com o e-CPF A1 do contador (vinculado às empresas no "Controle de Acesso" do e-Fisco), o Taxify
                busca sozinho o extrato do Fronteira das empresas de PE.
              </small>
            }
          }
        </div>
        @if (!editing()) {
          <div class="d-flex gap-2">
            @if (status()?.present) {
              <app-button label="Remover" variant="text" severity="danger" [disabled]="busy()" (onClick)="remove()"></app-button>
            }
            <app-button [label]="status()?.present ? 'Trocar certificado' : 'Enviar certificado'" variant="outlined" icon="upload"
              (onClick)="editing.set(true)"></app-button>
          </div>
        }
      </div>
      @if (editing()) {
        <div class="key-edit">
          <input class="form-control form-control-sm" type="file" accept=".pfx,.p12" (change)="pick($event)" />
          <input class="form-control form-control-sm" type="password" autocomplete="new-password" placeholder="Senha do certificado"
            [(ngModel)]="password" />
          <app-button label="Cancelar" variant="text" severity="secondary" (onClick)="cancel()"></app-button>
          <app-button [label]="busy() ? 'Enviando...' : 'Salvar'" [disabled]="busy() || !file" (onClick)="upload()"></app-button>
        </div>
        <small class="text-muted d-block mt-2">
          O arquivo e a senha ficam guardados cifrados; a tela nunca mostra os dois de volta. Só e-CPF (pessoa física).
        </small>
      }
    </div>
  `,
  styleUrl: './firm-integrations.component.scss',
})
export class EfiscoCertificateCardComponent implements OnInit {
  private readonly efisco = inject(EfiscoService);
  private readonly toastr = inject(ToastrService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly status = signal<FirmCertificateDTO | null>(null);
  readonly editing = signal(false);
  readonly busy = signal(false);
  file: File | null = null;
  password = '';

  ngOnInit(): void {
    this.efisco.certificate().subscribe({ next: (s) => this.status.set(s), error: () => this.status.set(null) });
  }

  syncLabel(status?: string | null): string {
    switch (status) {
      case 'OK': return 'tudo importado';
      case 'PARCIAL': return 'parte das empresas com problema';
      case 'BLOQUEADO': return 'e-Fisco recusou o acesso';
      case 'ERRO': return 'falhou';
      default: return status ?? '';
    }
  }

  pick(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  cancel(): void {
    this.editing.set(false);
    this.file = null;
    this.password = '';
  }

  upload(): void {
    if (!this.file) {
      return;
    }
    this.busy.set(true);
    this.efisco.uploadCertificate(this.file, this.password).subscribe({
      next: (s) => {
        this.status.set(s);
        this.busy.set(false);
        this.cancel();
        this.toastr.success('Certificado do contador salvo.');
      },
      error: () => this.busy.set(false),
    });
  }

  async remove(): Promise<void> {
    const ok = await this.confirmDialog.ask('Sem ele, o Taxify para de buscar os extratos do Fronteira no e-Fisco.',
      { title: 'Remover o certificado do contador', confirmLabel: 'Remover', danger: true });
    if (!ok) {
      return;
    }
    this.busy.set(true);
    this.efisco.deleteCertificate().subscribe({
      next: (s) => {
        this.status.set(s);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}
