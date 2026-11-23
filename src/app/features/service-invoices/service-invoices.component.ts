import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CompanyDTO } from '../../core/models/company.model';
import {
  ServiceInvoiceDetailDTO,
  ServiceInvoiceSummaryDTO,
  ServiceInvoiceTotalsDTO,
} from '../../core/models/service-invoice.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { ServiceInvoiceService } from '../../core/services/service-invoice.service';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page } from '../../shared/components/page/page';
import { Pagination } from '../../shared/components/pagination/pagination';
import { formatDocument } from '../../shared/utils/document-mask';
import { downloadBlob } from '../../shared/utils/download-blob';
import { formatCurrency } from '../../shared/utils/format';

function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Notas fiscais de serviço (NFS-e) prestadas e tomadas, com ISS e retenções. Vêm do SIEG
 * (uma vez por dia, os últimos 35 dias) ou de upload; "Buscar no SIEG" traz um mês anterior.
 */
@Component({
  selector: 'app-service-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputComponent, Modal, Page, Pagination],
  template: `
    <app-page pageTitle="Notas de serviço" pageDescription="NFS-e prestadas e tomadas, com ISS e retenções">
      <form [formGroup]="form" class="filters">
        <div class="company-field">
          <app-input formControlName="company" label="Empresa (nome ou CNPJ)" type="autocomplete" [searchFn]="searchCompanies"
            [displayFn]="companyLabel" displayField="name" displayFieldTooltip="documentNumber"></app-input>
        </div>
        <div class="participant-field">
          <app-input formControlName="participant" label="Prestador / tomador (nome ou CNPJ)"></app-input>
        </div>
        <label class="small month-label">Competência (emissão)
          <input type="month" class="form-control form-control-sm" formControlName="month" />
        </label>
      </form>

      @if (!companyId()) {
        <div class="empty">Escolha uma empresa para ver as notas de serviço.</div>
      } @else {
        @if (totals(); as t) {
          <div class="cards">
            <div class="card-box">
              <div class="card-title">Prestadas <span class="muted">({{ t.prestadas.count }})</span></div>
              <div class="card-value">{{ formatCurrency(t.prestadas.valorServico) }}</div>
              <div class="small">ISS {{ formatCurrency(t.prestadas.valorIss) }}</div>
              <div class="small">Retido pelo tomador: <strong>{{ formatCurrency(t.prestadas.totalRetido) }}</strong>
                <span class="muted">(a compensar)</span></div>
            </div>
            <div class="card-box">
              <div class="card-title">Tomadas <span class="muted">({{ t.tomadas.count }})</span></div>
              <div class="card-value">{{ formatCurrency(t.tomadas.valorServico) }}</div>
              <div class="small">ISS {{ formatCurrency(t.tomadas.valorIss) }}</div>
              <div class="small">Retido pela empresa: <strong>{{ formatCurrency(t.tomadas.totalRetido) }}</strong>
                <span class="muted">(a recolher)</span></div>
            </div>
          </div>
        }

        <div class="toolbar">
          <div class="tabs">
            <button type="button" [class.active]="direction() === ''" (click)="setDirection('')">Todas</button>
            <button type="button" [class.active]="direction() === 'PRESTADA'" (click)="setDirection('PRESTADA')">Prestadas</button>
            <button type="button" [class.active]="direction() === 'TOMADA'" (click)="setDirection('TOMADA')">Tomadas</button>
          </div>
          <label class="small form-check-label">
            <input type="checkbox" class="form-check-input me-1" [ngModel]="onlyRetained()" [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="setOnlyRetained($event)" />Só com retenção
          </label>
          <span class="small muted">{{ totalElements() }} nota(s)</span>
          @if (canSync) {
            <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" [disabled]="fetching()" (click)="fetchFromSieg()">
              {{ fetching() ? 'Pedindo ao SIEG...' : 'Buscar este mês no SIEG' }}
            </button>
          }
        </div>

        @if (loading()) {
          <p class="muted"><span class="spinner-border spinner-border-sm me-2"></span>Carregando...</p>
        } @else if (!rows().length) {
          <div class="empty">
            Nenhuma NFS-e no período. Elas chegam do SIEG uma vez por dia (os últimos 35 dias); para um mês anterior use
            "Buscar este mês no SIEG", ou importe o XML pela tela de Notas fiscais.
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle small">
              <thead>
                <tr><th>Nota</th><th>Emissão</th><th>Prestador / Tomador</th><th>Serviço</th>
                  <th class="text-end">Valor</th><th class="text-end">ISS</th><th class="text-end">Retido</th></tr>
              </thead>
              <tbody>
                @for (n of rows(); track n.id) {
                  <tr class="clickable" (click)="openDetail(n)">
                    <td>
                      <strong>Nº {{ n.numero || '—' }}</strong>
                      <div>
                        <span class="badge" [ngClass]="n.direction === 'PRESTADA' ? 'text-bg-primary' : 'text-bg-secondary'">
                          {{ n.direction === 'PRESTADA' ? 'Prestada' : n.direction === 'TOMADA' ? 'Tomada' : 'Terceiro' }}</span>
                        @if (n.canceled) { <span class="badge text-bg-danger ms-1">Cancelada</span> }
                        <span class="muted ms-1">{{ n.layout === 'NACIONAL' ? 'Nacional' : 'ABRASF' }}</span>
                      </div>
                    </td>
                    <td>{{ n.issueDate | date: 'dd/MM/yyyy' }}</td>
                    <td>
                      @if (n.direction === 'PRESTADA') {
                        {{ n.tomadorNome || '—' }}<div class="muted">Tomador · {{ formatDocument(n.tomadorDocumento) }}</div>
                      } @else {
                        {{ n.prestadorNome || '—' }}<div class="muted">Prestador · {{ formatDocument(n.prestadorDocumento) }}</div>
                      }
                    </td>
                    <td class="desc">{{ n.descricaoServico || '—' }}</td>
                    <td class="text-end">{{ formatCurrency(n.valorServico) }}</td>
                    <td class="text-end">{{ formatCurrency(n.valorIss) }} @if (n.issRetido) { <div class="badge text-bg-warning">retido</div> }</td>
                    <td class="text-end">{{ n.totalRetido ? formatCurrency(n.totalRetido) : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pagination [pageIndex]="page()" [totalPages]="totalPages()" (pageIndexChange)="goTo($event)"></app-pagination>
        }
      }
    </app-page>

    <app-modal [open]="!!detail()" [title]="'NFS-e nº ' + (detail()?.numero || '')" size="lg" (closed)="detail.set(null)">
      @if (detail(); as d) {
        <div class="detail-grid small">
          <div><span class="muted">Prestador</span><div>{{ d.prestadorNome }} · {{ formatDocument(d.prestadorDocumento) }}</div></div>
          <div><span class="muted">Tomador</span><div>{{ d.tomadorNome || '—' }} · {{ formatDocument(d.tomadorDocumento) }}</div></div>
          <div><span class="muted">Emissão / competência</span><div>{{ d.issueDate | date: 'dd/MM/yyyy HH:mm' }} · {{ d.competence | date: 'MM/yyyy' }}</div></div>
          <div><span class="muted">Layout / origem</span><div>{{ d.layout }} · {{ d.origem }}</div></div>
          <div><span class="muted">Serviço</span><div>{{ d.codigoServico || '—' }} {{ d.codigoTributacaoMunicipal ? '· ' + d.codigoTributacaoMunicipal : '' }}</div></div>
          <div><span class="muted">Município de incidência</span><div>{{ d.municipioIncidencia || '—' }}</div></div>
          @if (d.codigoVerificacao) { <div><span class="muted">Código de verificação</span><div>{{ d.codigoVerificacao }}</div></div> }
          <div class="full"><span class="muted">Chave</span><div class="mono">{{ d.accessKey }}</div></div>
          <div class="full"><span class="muted">Descrição</span><div>{{ d.descricaoServico || '—' }}</div></div>
        </div>
        <table class="table table-sm small mt-3">
          <tbody>
            <tr><td>Valor do serviço</td><td class="text-end">{{ formatCurrency(d.valorServico) }}</td></tr>
            <tr><td>Deduções</td><td class="text-end">{{ formatCurrency(d.valorDeducoes) }}</td></tr>
            <tr><td>Base de cálculo / alíquota ISS</td><td class="text-end">{{ formatCurrency(d.baseCalculo) }} · {{ d.aliquotaIss ?? '—' }}%</td></tr>
            <tr><td>ISS {{ d.issRetido ? '(retido)' : '' }}</td><td class="text-end">{{ formatCurrency(d.valorIss) }}</td></tr>
            <tr><td>IRRF retido</td><td class="text-end">{{ formatCurrency(d.valorIrrf) }}</td></tr>
            <tr><td>PIS / COFINS {{ d.pisCofinsRetidos ? '(retidos)' : '(informados)' }}</td>
              <td class="text-end">{{ formatCurrency(d.valorPis) }} / {{ formatCurrency(d.valorCofins) }}</td></tr>
            <tr><td>CSLL retida</td><td class="text-end">{{ formatCurrency(d.valorCsll) }}</td></tr>
            <tr><td>INSS retido</td><td class="text-end">{{ formatCurrency(d.valorInss) }}</td></tr>
            <tr class="fw-semibold"><td>Total retido</td><td class="text-end">{{ formatCurrency(d.totalRetido) }}</td></tr>
            <tr><td>Valor líquido</td><td class="text-end">{{ formatCurrency(d.valorLiquido) }}</td></tr>
          </tbody>
        </table>
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="downloadXml(d)">Baixar XML</button>
        </div>
      }
    </app-modal>
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 1rem; }
    .company-field { flex: 1 1 320px; max-width: 460px; }
    .participant-field { flex: 1 1 240px; max-width: 320px; }
    .month-label { display: flex; flex-direction: column; gap: 2px; }
    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 1rem; }
    .card-box { flex: 1 1 260px; max-width: 420px; border: 1px solid var(--bs-border-color, #dee2e6); border-radius: 8px; padding: 10px 14px; }
    .card-title { font-weight: 600; }
    .card-value { font-size: 1.3rem; font-weight: 600; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 8px; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { border: 1px solid var(--bs-border-color, #dee2e6); background: transparent; border-radius: 6px; padding: 2px 10px; font-size: 0.85rem; }
    .tabs button.active { border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
    .muted { opacity: 0.7; }
    .mono { font-family: var(--bs-font-monospace, monospace); font-size: 0.75rem; word-break: break-all; }
    .desc { max-width: 320px; }
    .clickable { cursor: pointer; }
    .empty { padding: 24px; text-align: center; opacity: 0.7; border: 1px dashed var(--bs-border-color, #dee2e6); border-radius: 6px; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .detail-grid .full { grid-column: 1 / -1; }
  `,
})
export class ServiceInvoicesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly service = inject(ServiceInvoiceService);
  private readonly toastr = inject(ToastrService);
  private readonly auth = inject(AuthService);

  readonly canSync = this.auth.can('INVOICES_SYNC');
  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null),
    participant: this.fb.nonNullable.control(''),
    month: this.fb.nonNullable.control(monthOf(new Date())),
  });
  readonly companyId = signal<string | null>(null);
  readonly direction = signal('');
  readonly onlyRetained = signal(false);
  readonly rows = signal<ServiceInvoiceSummaryDTO[]>([]);
  readonly totals = signal<ServiceInvoiceTotalsDTO | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly fetching = signal(false);
  readonly detail = signal<ServiceInvoiceDetailDTO | null>(null);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDocument = formatDocument;

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const id = company && typeof company === 'object' && company.id ? company.id : null;
      if (id && id !== this.companyId()) {
        this.companyId.set(id);
        this.reload(true);
      }
    });
    this.form.controls.month.valueChanges.subscribe(() => this.reload(true));
    this.form.controls.participant.valueChanges.pipe(debounceTime(300)).subscribe(() => this.reload(false));
  }

  private period(): { inicio: string; fim: string } {
    const month = this.form.controls.month.value || monthOf(new Date());
    const [year, m] = month.split('-').map(Number);
    const last = new Date(year, m, 0).getDate();
    return { inicio: `${month}-01`, fim: `${month}-${String(last).padStart(2, '0')}` };
  }

  private reload(withTotals: boolean): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.page.set(0);
    const { inicio, fim } = this.period();
    if (withTotals) {
      this.service.totals({ companyId, dataEmissaoInicio: inicio, dataEmissaoFim: fim }).subscribe({
        next: (totals) => this.totals.set(totals),
        error: () => this.totals.set(null),
      });
    }
    this.load();
  }

  private load(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    const { inicio, fim } = this.period();
    this.loading.set(true);
    this.service
      .search({
        companyId,
        dataEmissaoInicio: inicio,
        dataEmissaoFim: fim,
        direction: this.direction() || undefined,
        participant: this.form.controls.participant.value.trim() || undefined,
        somenteComRetencao: this.onlyRetained(),
        page: this.page(),
        size: 50,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setDirection(direction: string): void {
    this.direction.set(direction);
    this.page.set(0);
    this.load();
  }

  setOnlyRetained(value: boolean): void {
    this.onlyRetained.set(value);
    this.page.set(0);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  openDetail(row: ServiceInvoiceSummaryDTO): void {
    this.service.detail(row.id).subscribe((detail) => this.detail.set(detail));
  }

  downloadXml(detail: ServiceInvoiceDetailDTO): void {
    this.service.xml(detail.id).subscribe((blob) => downloadBlob(blob, `nfse-${detail.numero || detail.id}.xml`));
  }

  fetchFromSieg(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    const { inicio, fim } = this.period();
    this.fetching.set(true);
    this.service.fetchFromSieg(companyId, inicio, fim).subscribe({
      next: (result) => {
        this.fetching.set(false);
        this.toastr.info(
          result.iniciado
            ? 'Buscando as NFS-e do mês no SIEG em segundo plano (o SIEG libera 2 consultas por minuto) — atualize em alguns minutos.'
            : 'Já existe uma busca no SIEG rodando para esta empresa.',
        );
      },
      error: () => this.fetching.set(false),
    });
  }
}
