import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CertidaoDTO, certidaoBadge, CompanyCertidaoDTO } from '../../../core/models/certidao.model';
import { AuthService } from '../../../core/services/auth.service';
import { CertidaoService, openPdf } from '../../../core/services/certidao.service';
import { Button } from '../../../shared/components/button/button';
import { LoaderComponent } from '../../../shared/components/loader/loader';

/**
 * Certidão SEFAZ-PE da empresa (só PE, por CNPJ): a última certidão, o histórico, "Emitir agora" e o envio do PDF
 * emitido no e-Fisco. A emissão pública do e-Fisco pede a verificação "confirme que você é humano" — o Taxify não
 * resolve captcha, então a emissão é feita por uma pessoa na página do e-Fisco e o PDF vem para cá.
 */
@Component({
  selector: 'app-company-certidao',
  standalone: true,
  imports: [CommonModule, Button, LoaderComponent],
  template: `
    @if (data(); as d) {
      @if (d.aplicavel) {
        <section class="mt-4">
          <h6 class="section-title">Certidão SEFAZ-PE</h6>
          <p class="section-hint">
            Certidão estadual (CRF/CND) emitida pelo CNPJ no e-Fisco, válida por 90 dias. Toda segunda-feira o Taxify
            confere as empresas sem certidão ou com 15 dias ou menos de validade; certidão positiva vira pendência alta.
          </p>

          @if (d.atual; as c) {
            <div class="cert-card" [class.danger]="badge(c).cls === 'danger'" [class.warn]="badge(c).cls === 'warn'">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <strong>{{ c.tipoLabel }}</strong>
                <span [class]="'state-badge ' + badge(c).cls">{{ badge(c).label }}</span>
                @if (c.situacao !== 'NEGATIVA' && badge(c).label !== c.situacaoLabel) {
                  <span class="small muted">{{ c.situacaoLabel }}</span>
                }
              </div>
              <div class="small">
                @if (c.numero) { Nº {{ c.numero }} · }
                @if (c.emitidaEm) { Emitida em {{ c.emitidaEm | date: 'dd/MM/yyyy' }} · }
                Válida até <strong>{{ c.validaAte | date: 'dd/MM/yyyy' }}</strong>
                @if (c.status !== 'VENCIDA') { ({{ c.diasRestantes }} dia(s)) }
              </div>
              <div class="small muted">
                {{ c.origem === 'EFISCO' ? 'Emitida pelo Taxify' : 'PDF enviado por ' + c.importedBy }} em {{ c.importedAt | date: 'dd/MM/yyyy HH:mm' }}
              </div>
              @if (c.hasPdf) {
                <app-button label="Ver PDF" icon="file-pdf" variant="text" styleClass="p-0" (onClick)="open(c)"></app-button>
              }
            </div>
          } @else {
            <p class="muted">Nenhuma certidão ainda.</p>
          }

          @if (d.ultimaTentativa; as t) {
            <div class="small mt-2 attempt">
              Última tentativa de emissão: {{ t.at | date: 'dd/MM/yyyy HH:mm' }}
              <span [class]="'state-badge ' + (t.status === 'OK' ? 'ok' : 'danger')">{{ t.status === 'OK' ? 'Emitida' : 'Não emitida' }}</span>
              @if (t.status !== 'OK' && t.detail) { <div class="muted">{{ t.detail }}</div> }
            </div>
          }

          @if (canIssue) {
            <div class="actions mt-2">
              <app-button [label]="issuing() ? 'Consultando o e-Fisco...' : 'Emitir agora'" icon="file-signature" variant="outlined"
                [disabled]="issuing() || uploading()" [write]="true" (onClick)="issue()"></app-button>
              <a class="small" [href]="d.paginaEmissao" target="_blank" rel="noopener">Abrir a emissão no e-Fisco</a>
            </div>
            <div class="add-row mt-2">
              <input type="file" class="form-control form-control-sm" accept=".pdf,application/pdf" (change)="pick($event)" />
              <app-button [label]="uploading() ? 'Lendo a certidão...' : 'Enviar PDF da certidão'" icon="upload" variant="outlined"
                severity="secondary" [disabled]="!file || uploading()" [write]="true" (onClick)="upload()"></app-button>
            </div>
            <p class="small muted mt-1 mb-0">
              Emitiu no e-Fisco? Envie o PDF: o Taxify lê número, emissão, validade e situação, confere o CNPJ e guarda o arquivo.
            </p>
          }

          @if (d.historico.length) {
            <div class="small mt-3">
              <div class="fw-semibold">Anteriores</div>
              <ul class="history">
                @for (h of d.historico; track h.id) {
                  <li>
                    {{ h.situacaoLabel }} · válida até {{ h.validaAte | date: 'dd/MM/yyyy' }}
                    @if (h.numero) { · Nº {{ h.numero }} }
                    @if (h.hasPdf) {
                      <app-button label="PDF" variant="text" styleClass="p-0 ms-1" (onClick)="open(h)"></app-button>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }
    } @else if (loading()) {
      <app-loader variant="inline"></app-loader>
    }
  `,
  styleUrl: './company-certidao.component.scss',
})
export class CompanyCertidaoComponent implements OnChanges {
  private readonly certidaoService = inject(CertidaoService);
  private readonly toastr = inject(ToastrService);
  private readonly auth = inject(AuthService);

  @Input({ required: true }) companyId!: string;

  readonly data = signal<CompanyCertidaoDTO | null>(null);
  readonly loading = signal(false);
  readonly issuing = signal(false);
  readonly uploading = signal(false);
  /** Emitir e enviar o PDF: a mesma permissão de sincronizar notas. */
  readonly canIssue = this.auth.can('INVOICES_SYNC');

  file: File | null = null;

  ngOnChanges(): void {
    this.loading.set(true);
    this.certidaoService.ofCompany(this.companyId).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  badge(c: CertidaoDTO): { label: string; cls: string } {
    return certidaoBadge(c.status, c.situacao);
  }

  issue(): void {
    this.issuing.set(true);
    this.certidaoService.issue(this.companyId).subscribe({
      next: (result) => {
        this.data.set(result.certidao);
        this.issuing.set(false);
        if (result.status === 'OK') {
          this.toastr.success('Certidão emitida e guardada.');
        } else {
          this.toastr.warning(result.detail || 'O e-Fisco não emitiu a certidão.', 'Certidão SEFAZ-PE', { timeOut: 12000 });
        }
      },
      error: () => this.issuing.set(false),
    });
  }

  pick(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  upload(): void {
    if (!this.file) {
      return;
    }
    this.uploading.set(true);
    this.certidaoService.upload(this.companyId, this.file).subscribe({
      next: (data) => {
        this.data.set(data);
        this.uploading.set(false);
        this.file = null;
        const c = data.atual;
        this.toastr.success(c ? `${c.situacaoLabel}, válida até ${new Date(c.validaAte + 'T00:00').toLocaleDateString('pt-BR')}.` : 'Certidão guardada.',
          'Certidão SEFAZ-PE');
      },
      error: () => this.uploading.set(false),
    });
  }

  open(c: CertidaoDTO): void {
    this.certidaoService.pdf(c.id).subscribe((blob) => openPdf(blob));
  }
}
