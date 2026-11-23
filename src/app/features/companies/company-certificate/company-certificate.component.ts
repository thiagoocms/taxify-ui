import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { CompanyCertificateDTO } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';

/**
 * Certificado A1 da empresa e captura de XML direto da SEFAZ (NFeDistribuicaoDFe). O .pfx
 * vai cifrado para o S3 e a senha cifrada para o banco; a captura roda de hora em hora para
 * as empresas com certificado e o serviço de importação de XML no plano.
 */
@Component({
  selector: 'app-company-certificate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mt-4">
      <h6 class="section-title">Certificado A1 e captura pela SEFAZ</h6>
      <p class="section-hint">
        Com o certificado (e-CNPJ) da empresa e a "Integração SEFAZ" no plano, as notas são buscadas direto na SEFAZ
        de hora em hora (por enquanto, empresas de Pernambuco) — junto com o SIEG se o plano tiver os dois.
        Uma filial usa o certificado da matriz (mesma raiz de CNPJ).
      </p>

      @if (loading()) {
        <p class="muted">Carregando...</p>
      }
      @if (!loading() && status(); as s) {
        @if (!s.sefazInPlan) {
          <p class="small text-warning-emphasis plan-note">
            O plano atual não inclui "Importação de XML fiscal" + "Integração SEFAZ" — a captura pela SEFAZ não roda para esta empresa.
          </p>
        }
        @if (s.present) {
          <div class="cert-card" [class.expired]="s.expired">
            <div><strong>{{ s.subjectName ? holder(s.subjectName) : 'Certificado A1' }}</strong></div>
            <div class="small">
              @if (s.cnpj) { CNPJ {{ formatCnpj(s.cnpj) }} · }
              Válido até <strong>{{ s.validUntil | date: 'dd/MM/yyyy' }}</strong>
              @if (s.expired) {
                <span class="badge text-bg-danger ms-1">Vencido</span>
              } @else if (expiresSoon(s.validUntil)) {
                <span class="badge text-bg-warning ms-1">Vence em breve</span>
              }
            </div>
            @if (s.inherited) {
              <div class="small muted">Certificado de {{ s.ownerCompanyName }} (mesma raiz de CNPJ).</div>
            }
          </div>
        } @else {
          <p class="muted">Nenhum certificado — a empresa fica fora da captura pela SEFAZ.</p>
        }

        @if (s.sefaz; as sefaz) {
          <div class="sefaz small mt-2">
            Última captura:
            @if (sefaz.lastRunAt) {
              {{ sefaz.lastRunAt | date: 'dd/MM/yyyy HH:mm' }}
              <span class="badge ms-1" [ngClass]="statusClass(sefaz.lastStatus)">{{ statusLabel(sefaz.lastStatus) }}</span>
              @if (sefaz.lastNewNotes) { · {{ sefaz.lastNewNotes }} nota(s) nova(s) }
            } @else {
              ainda não rodou
            }
            @if (sefaz.lastDetail) {
              <div class="muted">{{ sefaz.lastDetail }}</div>
            }
            @if (sefaz.nextQueryAt && isFuture(sefaz.nextQueryAt)) {
              <div class="muted">Próxima consulta liberada pela SEFAZ às {{ sefaz.nextQueryAt | date: 'HH:mm' }}.</div>
            }
          </div>
        }

        @if (!readonly) {
          @if (!s.encryptionConfigured) {
            <p class="small muted mt-2 mb-1">
              Sem chave de criptografia no servidor: o certificado é guardado só com a criptografia padrão do S3.
            </p>
          }
          <div class="add-row mt-2">
              <input type="file" class="form-control form-control-sm" accept=".pfx,.p12" (change)="pick($event)" />
              <input
                type="password"
                class="form-control form-control-sm"
                placeholder="Senha do certificado"
                autocomplete="new-password"
                [(ngModel)]="password"
              />
              <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="!file || !password || saving()" (click)="upload()">
                {{ saving() ? 'Enviando...' : s.present && !s.inherited ? 'Trocar certificado' : 'Enviar certificado' }}
              </button>
          </div>
          <div class="d-flex gap-2 mt-2">
            @if (s.present && s.sefazInPlan) {
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="capturing()" (click)="capture()">
                {{ capturing() ? 'Consultando a SEFAZ...' : 'Capturar agora' }}
              </button>
            }
            @if (s.present && !s.inherited) {
              @if (confirmingDelete()) {
                <button type="button" class="btn btn-sm btn-danger" (click)="remove()">Confirmar remoção</button>
                <button type="button" class="btn btn-sm btn-link" (click)="confirmingDelete.set(false)">Cancelar</button>
              } @else {
                <button type="button" class="btn btn-sm btn-link text-danger" (click)="confirmingDelete.set(true)">Remover certificado</button>
              }
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .section-title { font-weight: 600; margin-bottom: 0.25rem; }
    .section-hint { font-size: 0.85rem; opacity: 0.75; margin-bottom: 0.5rem; max-width: 900px; }
    .muted { opacity: 0.7; font-size: 0.9rem; }
    .cert-card { max-width: 900px; border: 1px solid var(--bs-border-color, #dee2e6); border-left: 4px solid var(--color-primary); border-radius: 6px; padding: 8px 12px; }
    .cert-card.expired { border-left-color: var(--bs-danger, #dc3545); }
    .sefaz { max-width: 900px; }
    .plan-note { max-width: 900px; }
    .add-row { display: flex; flex-wrap: wrap; gap: 6px; max-width: 900px; }
    .add-row input[type='file'] { max-width: 320px; }
    .add-row input[type='password'] { max-width: 220px; }
  `,
})
export class CompanyCertificateComponent implements OnChanges {
  private readonly companyService = inject(CompanyService);
  private readonly toastr = inject(ToastrService);

  @Input({ required: true }) companyId!: string;
  @Input() readonly = false;

  readonly status = signal<CompanyCertificateDTO | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly capturing = signal(false);
  readonly confirmingDelete = signal(false);

  file: File | null = null;
  password = '';

  ngOnChanges(): void {
    this.loading.set(true);
    this.companyService.getCertificate(this.companyId).subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.file || !this.password) {
      return;
    }
    this.saving.set(true);
    this.companyService.uploadCertificate(this.companyId, this.file, this.password).subscribe({
      next: (status) => {
        this.status.set(status);
        this.saving.set(false);
        this.password = '';
        this.toastr.success('Certificado salvo. A captura pela SEFAZ começa na próxima rodada.');
      },
      error: () => {
        this.saving.set(false);
        this.password = '';
      },
    });
  }

  capture(): void {
    this.capturing.set(true);
    this.companyService.captureFromSefaz(this.companyId).subscribe({
      next: (status) => {
        this.status.set(status);
        this.capturing.set(false);
      },
      error: () => this.capturing.set(false),
    });
  }

  remove(): void {
    this.confirmingDelete.set(false);
    this.companyService.deleteCertificate(this.companyId).subscribe((status) => this.status.set(status));
  }

  /** "CN=EMPRESA LTDA:12345678000199,OU=..." → "EMPRESA LTDA". */
  holder(subject: string): string {
    const cn = /CN=([^,]+)/.exec(subject)?.[1] ?? subject;
    return cn.replace(/:\d{11,14}$/, '');
  }

  formatCnpj(cnpj: string): string {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  expiresSoon(validUntil?: string | null): boolean {
    return !!validUntil && new Date(validUntil).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
  }

  isFuture(value: string): boolean {
    return new Date(value).getTime() > Date.now();
  }

  statusLabel(status?: string | null): string {
    return status === 'OK' ? 'Notas recebidas' : status === 'SEM_MOVIMENTO' ? 'Sem movimento' : status === 'ERRO' ? 'Erro' : '—';
  }

  statusClass(status?: string | null): string {
    return status === 'OK' ? 'text-bg-success' : status === 'ERRO' ? 'text-bg-danger' : 'text-bg-secondary';
  }
}
