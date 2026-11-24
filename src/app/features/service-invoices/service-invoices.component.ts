import { HelpTipComponent } from '../../shared/help/help-tip.component';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CompanyDTO } from '../../core/models/company.model';
import {
  ServiceInvoiceDetailDTO,
  ServiceInvoiceSummaryDTO,
  ServiceInvoiceTotalsDTO,
  SERVICE_INVOICE_ORIGINS,
} from '../../core/models/service-invoice.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { CurrentCompanyService } from '../../core/services/current-company.service';
import { ServiceInvoiceService } from '../../core/services/service-invoice.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page, PageButton } from '../../shared/components/page/page';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { downloadBlob } from '../../shared/utils/download-blob';
import { formatCurrency } from '../../shared/utils/format';
import { monthLabel, shiftMonth, toMonth } from '../assessment/assessment-format';

/**
 * Notas fiscais de serviço (NFS-e) prestadas e tomadas, com ISS e retenções. Vêm do SIEG
 * (uma vez por dia, os últimos 35 dias) ou de upload; "Buscar este mês no SIEG" traz um mês anterior.
 * Mesmo desenho da Apuração: navegação de mês, resumo, atalhos e tabela.
 */
import { MonthNavComponent } from '../../shared/components/month-nav/month-nav.component';
@Component({
  selector: 'app-service-invoices',
  standalone: true,
  imports: [MonthNavComponent, CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Pagination, Table, HelpTipComponent],
  templateUrl: './service-invoices.component.html',
  styleUrl: './service-invoices.component.scss',
})
export class ServiceInvoicesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly currentCompany = inject(CurrentCompanyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ServiceInvoiceService);
  private readonly toastr = inject(ToastrService);
  private readonly auth = inject(AuthService);

  private readonly noteCell = viewChild.required<TemplateRef<unknown>>('noteCell');
  private readonly dateCell = viewChild.required<TemplateRef<unknown>>('dateCell');
  private readonly partyCell = viewChild.required<TemplateRef<unknown>>('partyCell');
  private readonly serviceCell = viewChild.required<TemplateRef<unknown>>('serviceCell');
  private readonly valueCell = viewChild.required<TemplateRef<unknown>>('valueCell');
  private readonly issCell = viewChild.required<TemplateRef<unknown>>('issCell');
  private readonly retainedCell = viewChild.required<TemplateRef<unknown>>('retainedCell');

  readonly canSync = this.auth.can('INVOICES_SYNC');
  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null),
    participant: this.fb.nonNullable.control(''),
  });
  readonly month = signal(toMonth(new Date()));
  readonly companyId = signal<string | null>(null);
  readonly direction = signal('');
  readonly onlyRetained = signal(false);
  /** Confronto SIEG × Ambiente Nacional ('' = desligado). */
  readonly source = signal<'' | 'SO_SIEG' | 'SO_ADN'>('');
  readonly rows = signal<ServiceInvoiceSummaryDTO[]>([]);
  readonly totals = signal<ServiceInvoiceTotalsDTO | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly fetching = signal(false);
  readonly detail = signal<ServiceInvoiceDetailDTO | null>(null);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDocument = formatDocument;
  protected readonly monthLabel = monthLabel;
  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.noteCell(), width: '150px' },
    { name: 'Emissão', cellTemplate: this.dateCell(), width: '110px' },
    { name: 'Prestador / tomador', cellTemplate: this.partyCell() },
    { name: 'Serviço', cellTemplate: this.serviceCell() },
    { name: 'Valor', cellTemplate: this.valueCell(), headerClass: 'justify-content-end', width: '130px' },
    { name: 'ISS', cellTemplate: this.issCell(), headerClass: 'justify-content-end', width: '110px' },
    { name: 'Retido', cellTemplate: this.retainedCell(), headerClass: 'justify-content-end', width: '120px' },
  ]);

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      id: 'service-invoices-fetch',
      label: this.fetching() ? 'Pedindo ao SIEG...' : 'Buscar este mês no SIEG',
      icon: 'cloud-arrow-down',
      variant: 'outlined',
      isShow: this.canSync && !!this.companyId(),
      isDisabled: this.fetching(),
      handler: () => this.fetchFromSieg(),
    },
  ]);

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const id = company && typeof company === 'object' && company.id ? company.id : null;
      if (id && id !== this.companyId()) {
        this.companyId.set(id);
        this.loaded.set(false);
        this.reload(true);
      }
    });
    this.currentCompany.bind(this.form.controls.company, this.destroyRef);
    this.form.controls.participant.valueChanges.pipe(debounceTime(300)).subscribe(() => this.reload(false));
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.reload(true);
  }

  private period(): { inicio: string; fim: string } {
    const [year, m] = this.month().split('-').map(Number);
    const last = new Date(year, m, 0).getDate();
    return { inicio: `${this.month()}-01`, fim: `${this.month()}-${String(last).padStart(2, '0')}` };
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
        fonte: this.source() || undefined,
        page: this.page(),
        size: 50,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
        },
      });
  }

  setDirection(direction: string): void {
    this.direction.set(direction);
    this.page.set(0);
    this.load();
  }

  toggleRetained(): void {
    this.onlyRetained.set(!this.onlyRetained());
    this.page.set(0);
    this.load();
  }

  toggleSource(source: 'SO_SIEG' | 'SO_ADN'): void {
    this.source.set(this.source() === source ? '' : source);
    this.page.set(0);
    this.load();
  }

  originLabel(origin: string): string {
    return SERVICE_INVOICE_ORIGINS[origin] ?? origin;
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
