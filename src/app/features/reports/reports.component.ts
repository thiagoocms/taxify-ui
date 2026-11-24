import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../core/models/company.model';
import { AbcDTO, MonthlyReportDTO, SimulationDTO } from '../../core/models/report.model';
import { NATURE_LABELS, RetentionNature } from '../../core/models/retention.model';
import { CompanyService } from '../../core/services/company.service';
import { CurrentCompanyService } from '../../core/services/current-company.service';
import { ReportService } from '../../core/services/report.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { downloadBlob } from '../../shared/utils/download-blob';
import { formatCurrency } from '../../shared/utils/format';
import { monthLabel, previousMonth, shiftMonth } from '../assessment/assessment-format';

type View = 'monthly' | 'abc' | 'simulation';

/**
 * Relatórios e simulação (roadmap M12): relatório mensal para o cliente (com PDF), curva ABC de compras
 * e simulação de Simples × Presumido × Real com os números das notas. Mesmo desenho da Apuração.
 */
import { MonthNavComponent } from '../../shared/components/month-nav/month-nav.component';
import { LoaderComponent } from '../../shared/components/loader/loader';
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [LoaderComponent, MonthNavComponent, CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Page, Table],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly currentCompany = inject(CurrentCompanyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reportService = inject(ReportService);

  private readonly curveCell = viewChild.required<TemplateRef<unknown>>('curveCell');
  private readonly abcItemCell = viewChild.required<TemplateRef<unknown>>('abcItemCell');
  private readonly abcValueCell = viewChild.required<TemplateRef<unknown>>('abcValueCell');

  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly premises = this.fb.nonNullable.group({ margem: 10, iss: 5 });
  readonly month = signal(previousMonth());
  readonly companyId = signal<string | null>(null);
  readonly view = signal<View>('monthly');
  readonly loading = signal(false);
  readonly monthly = signal<MonthlyReportDTO | null>(null);
  readonly abc = signal<AbcDTO | null>(null);
  readonly abcBy = signal<'PRODUTO' | 'FORNECEDOR'>('PRODUTO');
  readonly abcMonths = signal(12);
  readonly simulation = signal<SimulationDTO | null>(null);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDocument = formatDocument;
  protected readonly monthLabel = monthLabel;
  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  readonly taxColumns: TableColumn[] = [
    { name: 'Imposto', property: 'label' },
    { name: 'Base', property: 'base', format: (value: number | null) => formatCurrency(value), headerClass: 'justify-content-end', cellClass: 'text-end' },
    { name: 'Alíquota', property: 'rate', format: (value: number | null) => (value == null ? '—' : `${Number(value).toLocaleString('pt-BR')}%`), width: '110px' },
    { name: 'Valor', property: 'amount', format: (value: number | null) => formatCurrency(value), headerClass: 'justify-content-end', cellClass: 'text-end' },
    { name: 'Observação', property: 'note', cellTextLength: 80 },
  ];
  readonly cfopColumns: TableColumn[] = [
    { name: 'Tipo', property: 'direction', format: (value: string) => (value === 'ENTRADA' ? 'Entrada' : 'Saída'), width: '100px' },
    { name: 'CFOP', property: 'cfop', width: '90px' },
    { name: 'Valor dos itens', property: 'total', format: (value: number) => formatCurrency(value), headerClass: 'justify-content-end', cellClass: 'text-end' },
  ];
  readonly historyColumns: TableColumn[] = [
    { name: 'Mês', property: 'month', format: (value: string) => { const label = monthLabel(value); return label.charAt(0).toUpperCase() + label.slice(1); } },
    { name: 'Faturamento líquido', property: 'net', format: (value: number) => formatCurrency(value), headerClass: 'justify-content-end', cellClass: 'text-end' },
  ];
  readonly abcColumns = computed<TableColumn[]>(() => [
    { name: 'Curva', cellTemplate: this.curveCell(), width: '80px' },
    { name: this.abcBy() === 'PRODUTO' ? 'Produto' : 'Fornecedor', cellTemplate: this.abcItemCell() },
    { name: 'Notas', property: 'notes', width: '80px' },
    { name: 'Valor', cellTemplate: this.abcValueCell(), headerClass: 'justify-content-end', width: '220px' },
  ]);

  readonly openPendencies = computed(() => (this.monthly()?.pendencies ?? []).reduce((sum, item) => sum + item.count, 0));

  readonly pageButtons = computed<PageButton[]>(() => [
    { id: 'report-pdf', label: 'Relatório PDF', icon: 'file-pdf', variant: 'outlined',
      isShow: !!this.companyId() && this.view() === 'monthly', isDisabled: !this.monthly(), handler: () => this.downloadPdf() },
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
        this.reload();
      }
    });
    this.currentCompany.bind(this.form.controls.company, this.destroyRef);
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.reload();
  }

  setView(view: View): void {
    this.view.set(view);
    this.reload();
  }

  setAbcBy(by: 'PRODUTO' | 'FORNECEDOR'): void {
    this.abcBy.set(by);
    this.reload();
  }

  setAbcMonths(months: number): void {
    this.abcMonths.set(months);
    this.reload();
  }

  private reload(): void {
    switch (this.view()) {
      case 'monthly':
        return this.loadMonthly();
      case 'abc':
        return this.loadAbc();
      default:
        return this.loadSimulation();
    }
  }

  private loadMonthly(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.loading.set(true);
    this.reportService.monthly(companyId, this.month()).subscribe({
      next: (report) => {
        this.monthly.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadAbc(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.loading.set(true);
    this.reportService.abc(companyId, this.month(), this.abcBy(), this.abcMonths()).subscribe({
      next: (abc) => {
        this.abc.set(abc);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSimulation(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    const { margem, iss } = this.premises.getRawValue();
    this.loading.set(true);
    this.reportService.simulate(companyId, this.month(), Number(margem) || 0, Number(iss) || 0).subscribe({
      next: (simulation) => {
        this.simulation.set(simulation);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  downloadPdf(): void {
    const companyId = this.companyId();
    if (companyId) {
      this.reportService.monthlyPdf(companyId, this.month()).subscribe((blob) => downloadBlob(blob, `relatorio-${this.month()}.pdf`));
    }
  }

  natureLabel(nature: string): string {
    return NATURE_LABELS[nature as RetentionNature] ?? nature;
  }

  formatPercent(value?: number | null): string {
    return value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
}
