import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { CompanyCertificateDTO, NfseAdnStatusDTO, SefazNotesDTO, SefazNoteSummaryDTO } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';

/**
 * Certificado A1 da empresa e captura de XML direto da SEFAZ (NFeDistribuicaoDFe). O .pfx
 * vai cifrado para o S3 e a senha cifrada para o banco; a captura roda de hora em hora para
 * as empresas com certificado e o serviço de importação de XML no plano.
 */
@Component({
  selector: 'app-company-certificate',
  standalone: true,
  imports: [LoaderComponent, CommonModule, FormsModule, Button, InputComponent],
  template: `
    <section class="mt-4">
      <h6 class="section-title">Certificado A1 e captura pela SEFAZ</h6>
      <p class="section-hint">
        Com o certificado (e-CNPJ) da empresa e a "Integração SEFAZ" no plano, as notas são buscadas direto na SEFAZ
        de hora em hora — junto com o SIEG se o plano tiver os dois.
        Uma filial usa o certificado da matriz (mesma raiz de CNPJ).
      </p>

      @if (loading()) {
        <app-loader variant="inline"></app-loader>
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

        @if (adn(); as a) {
          <div class="sefaz small mt-3">
            <div class="fw-semibold">Captura de NFS-e pelo Ambiente Nacional</div>
            @if (!a.inPlan) {
              <div class="muted">O plano não inclui "Integração NFS-e Nacional" — as NFS-e vêm só pelo SIEG ou por upload.</div>
            } @else {
              Última captura:
              @if (a.lastRunAt) {
                {{ a.lastRunAt | date: 'dd/MM/yyyy HH:mm' }}
                <span class="badge ms-1" [ngClass]="statusClass(a.lastStatus)">{{ statusLabel(a.lastStatus) }}</span>
                @if (a.lastNewNotes) { · {{ a.lastNewNotes }} NFS-e nova(s) }
              } @else {
                ainda não rodou
              }
              @if (a.lastDetail) {
                <div class="muted">{{ a.lastDetail }}</div>
              }
              @if (a.nextQueryAt && isFuture(a.nextQueryAt)) {
                <div class="muted">Próxima consulta às {{ a.nextQueryAt | date: 'HH:mm' }}.</div>
              }
              @if (!readonly && s.present) {
                <div class="mt-1">
                  <app-button [label]="capturingAdn() ? 'Consultando o Ambiente Nacional...' : 'Capturar NFS-e agora'" icon="cloud-arrow-down"
                    variant="outlined" severity="secondary" [disabled]="capturingAdn()" (onClick)="captureAdn()"></app-button>
                </div>
              }
            }
          </div>
        }

        @if (notes(); as n) {
          @if (n.notas.length || n.soSieg || n.soSefaz) {
            <div class="summaries mt-3">
              <div class="small fw-semibold">Entradas que a SEFAZ entregou só como resumo</div>
              <p class="small muted mb-1">
                Sem a Ciência da Operação a SEFAZ não libera o XML completo (itens, CFOP, NCM) — sem ele a nota não entra
                nas regras nem na retificação.
                @if (n.autoCiencia) {
                  O Taxify envia a ciência sozinho e busca o XML na consulta seguinte.
                } @else {
                  O plano não inclui "Manifestação do destinatário" (junto com a Integração SEFAZ): a ciência não é
                  enviada pelo Taxify — as notas só ficam completas se vierem pelo SIEG ou por upload.
                }
              </p>
              <div class="counters small">
                <span class="badge text-bg-secondary">{{ n.aguardandoCiencia }} aguardando ciência</span>
                <span class="badge text-bg-info">{{ n.aguardandoXml }} com ciência, aguardando XML</span>
                @if (n.comErro) {
                  <span class="badge text-bg-danger">{{ n.comErro }} com ciência recusada</span>
                }
                @if (n.soSieg != null) {
                  <span class="badge text-bg-light border" title="Notas de terceiros que o SIEG trouxe há mais de 48h e a SEFAZ não entregou">
                    Só no SIEG: {{ n.soSieg }}
                  </span>
                  <span class="badge text-bg-light border" title="Notas que a SEFAZ entregou há mais de 48h e o SIEG não trouxe">
                    Só na SEFAZ: {{ n.soSefaz }}
                  </span>
                }
              </div>
              @if (n.notas.length) {
                <div class="table-responsive mt-2">
                  <table class="table table-sm small mb-0">
                    <thead>
                      <tr><th>Emissão</th><th>Emitente</th><th class="text-end">Valor</th><th>Ciência</th><th></th></tr>
                    </thead>
                    <tbody>
                      @for (nota of n.notas; track nota.chave) {
                        <tr>
                          <td>{{ nota.dataEmissao | date: 'dd/MM/yyyy' }}</td>
                          <td>
                            {{ nota.emitenteNome || '—' }}
                            <div class="muted mono">{{ nota.chave }}</div>
                          </td>
                          <td class="text-end">{{ nota.valorTotal | currency: 'BRL' }}</td>
                          <td>
                            <span class="badge" [ngClass]="cienciaClass(nota)">{{ cienciaLabel(nota) }}</span>
                            @if (nota.cienciaDetalhe || nota.buscaDetalhe) {
                              <div class="muted">{{ nota.cienciaDetalhe || nota.buscaDetalhe }}</div>
                            }
                          </td>
                          <td class="text-end">
                            @if (!readonly && nota.ciencia === 'ERRO') {
                              <app-button label="Reenviar ciência" variant="text" styleClass="p-0" [disabled]="retrying() === nota.chave"
                                (onClick)="retry(nota.chave)"></app-button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        }

        @if (!readonly) {
          @if (!s.encryptionConfigured) {
            <p class="small muted mt-2 mb-1">
              Sem chave de criptografia no servidor: o certificado é guardado só com a criptografia padrão do S3.
            </p>
          }
          <div class="add-row mt-2">
              <input type="file" class="form-control form-control-sm" accept=".pfx,.p12" (change)="pick($event)" />
              <app-input size="sm" type="password" label="Senha do certificado" autocomplete="new-password" [(ngModel)]="password"></app-input>
              <app-button [label]="saving() ? 'Enviando...' : s.present && !s.inherited ? 'Trocar certificado' : 'Enviar certificado'"
                icon="upload" variant="outlined" [disabled]="!file || !password || saving()" (onClick)="upload()"></app-button>
          </div>
          <div class="d-flex gap-2 mt-2">
            @if (s.present && s.sefazInPlan) {
              <app-button [label]="capturing() ? 'Consultando a SEFAZ...' : 'Capturar agora'" icon="cloud-arrow-down" variant="outlined"
                severity="secondary" [disabled]="capturing()" (onClick)="capture()"></app-button>
            }
            @if (s.present && !s.inherited) {
              @if (confirmingDelete()) {
                <app-button label="Confirmar remoção" severity="danger" (onClick)="remove()"></app-button>
                <app-button label="Cancelar" variant="text" severity="secondary" (onClick)="confirmingDelete.set(false)"></app-button>
              } @else {
                <app-button label="Remover certificado" variant="text" severity="danger" (onClick)="confirmingDelete.set(true)"></app-button>
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
    .add-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 900px; }
    .add-row input[type='file'] { max-width: 320px; }
    .add-row app-input { flex: 0 1 220px; }
    .summaries { max-width: 900px; }
    .counters { display: flex; flex-wrap: wrap; gap: 6px; }
    .mono { font-family: var(--bs-font-monospace, monospace); font-size: 0.75rem; }
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
  readonly notes = signal<SefazNotesDTO | null>(null);
  readonly adn = signal<NfseAdnStatusDTO | null>(null);
  readonly capturingAdn = signal(false);
  readonly retrying = signal<string | null>(null);

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
    this.loadNotes();
    this.companyService.getNfseAdnStatus(this.companyId).subscribe({
      next: (status) => this.adn.set(status),
      error: () => this.adn.set(null),
    });
  }

  captureAdn(): void {
    this.capturingAdn.set(true);
    this.companyService.captureNfseAdn(this.companyId).subscribe({
      next: (status) => {
        this.adn.set(status);
        this.capturingAdn.set(false);
      },
      error: () => this.capturingAdn.set(false),
    });
  }

  private loadNotes(): void {
    this.companyService.getSefazSummaries(this.companyId).subscribe({
      next: (notes) => this.notes.set(notes),
      error: () => this.notes.set(null),
    });
  }

  retry(chave: string): void {
    this.retrying.set(chave);
    this.companyService.retryCiencia(this.companyId, chave).subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.retrying.set(null);
        this.toastr.success('Ciência recolocada na fila — vai na próxima captura.');
      },
      error: () => this.retrying.set(null),
    });
  }

  cienciaLabel(nota: SefazNoteSummaryDTO): string {
    if (nota.situacao === '3') {
      return 'Cancelada';
    }
    if (nota.situacao === '2') {
      return 'Denegada';
    }
    return nota.ciencia === 'ENVIADA' ? 'Enviada — aguardando XML' : nota.ciencia === 'ERRO' ? 'Recusada' : 'Aguardando envio';
  }

  cienciaClass(nota: SefazNoteSummaryDTO): string {
    if (nota.situacao === '2' || nota.situacao === '3') {
      return 'text-bg-secondary';
    }
    return nota.ciencia === 'ENVIADA' ? 'text-bg-info' : nota.ciencia === 'ERRO' ? 'text-bg-danger' : 'text-bg-light border';
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
        this.loadNotes();
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
