import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { debounceTime } from 'rxjs/operators';
import { Page, PageButton } from '../../shared/components/page/page';
import { InputComponent } from '../../shared/components/input/input';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { downloadBlob } from '../../shared/utils/download-blob';
import { TaxAssessmentService } from '../../core/services/tax-assessment.service';
import { TAX_REGIME_LABELS, TaxAssessmentDTO, TaxRegime } from '../../core/models/tax-assessment.model';
import {
  actionableAlerts,
  formatCurrency,
  formatDocument,
  isClosed,
  isMonth,
  monthLabel,
  previousMonth,
  regimeLabel,
  shiftMonth,
  worstLevel,
} from './assessment-format';

type RegimeFilter = TaxRegime | 'ALL' | 'MISSING';
/** Atalhos dos cards de resumo. */
type QuickFilter = 'ALL' | 'ALERTS' | 'NO_INVOICES' | 'OPEN' | 'CLOSED';

const PAGE_SIZE = 20;

/**
 * Apuração do escritório: uma linha por empresa da carteira no mês, com faturamento,
 * RBT12, impostos estimados, alertas e fechamento. Clicar abre o detalhe da empresa.
 */
@Component({
  selector: 'app-tax-assessment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent, Page, InputComponent, Table, Pagination],
  templateUrl: './tax-assessment.component.html',
  styleUrl: './tax-assessment.component.scss',
})
export class TaxAssessmentComponent implements OnInit {
  private readonly service = inject(TaxAssessmentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly formatCurrency = formatCurrency;
  readonly formatDocument = formatDocument;
  readonly regimeLabel = regimeLabel;
  readonly monthLabel = monthLabel;
  readonly worstLevel = worstLevel;
  readonly actionableAlerts = actionableAlerts;
  readonly isClosed = isClosed;

  readonly regimeChips: { key: RegimeFilter; label: string }[] = [
    { key: 'ALL', label: 'Todos os regimes' },
    ...(['SIMPLES_NACIONAL', 'MEI', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'] as TaxRegime[]).map((key) => ({ key, label: TAX_REGIME_LABELS[key] })),
    { key: 'MISSING', label: 'Sem regime' },
  ];

  readonly month = signal(previousMonth());
  readonly rows = signal<TaxAssessmentDTO[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly regimeFilter = signal<RegimeFilter>('ALL');
  readonly quickFilter = signal<QuickFilter>('ALL');
  readonly pageIndex = signal(0);

  readonly form = this.fb.nonNullable.group({ search: [''] });
  private readonly search = signal('');

  private readonly companyCell = viewChild.required<TemplateRef<unknown>>('companyCell');
  private readonly regimeCell = viewChild.required<TemplateRef<unknown>>('regimeCell');
  private readonly revenueCell = viewChild.required<TemplateRef<unknown>>('revenueCell');
  private readonly baseCell = viewChild.required<TemplateRef<unknown>>('baseCell');
  private readonly taxesCell = viewChild.required<TemplateRef<unknown>>('taxesCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Empresa', cellTemplate: this.companyCell() },
    { name: 'Regime', cellTemplate: this.regimeCell(), width: '190px' },
    { name: 'Faturamento', cellTemplate: this.revenueCell(), headerClass: 'justify-content-end', width: '150px' },
    { name: 'RBT12 / ano', cellTemplate: this.baseCell(), headerClass: 'justify-content-end', width: '150px' },
    { name: 'Impostos est.', cellTemplate: this.taxesCell(), headerClass: 'justify-content-end', width: '140px' },
    { name: 'Situação', cellTemplate: this.statusCell(), width: '200px' },
  ]);

  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  /** Regime e busca - a base dos cards de resumo. */
  private readonly scoped = computed(() => {
    const term = this.search().trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const regime = this.regimeFilter();
    return this.rows().filter((row) => {
      if (term && !row.companyName.toLowerCase().includes(term) && !(digits && row.companyDocument?.includes(digits))) {
        return false;
      }
      if (regime === 'MISSING') {
        return !row.taxRegime || row.taxRegime === 'OTHER';
      }
      return regime === 'ALL' || row.taxRegime === regime;
    });
  });

  readonly summary = computed(() => {
    const rows = this.scoped();
    return {
      companies: rows.length,
      closed: rows.filter(isClosed).length,
      revenue: rows.reduce((sum, row) => sum + row.revenue.net, 0),
      taxes: rows.reduce((sum, row) => sum + row.totalTaxes, 0),
      alerts: rows.filter(hasActionableAlert).length,
      withoutInvoices: rows.filter((row) => row.invoicesIssued === 0).length,
      pendingReviews: rows.reduce((sum, row) => sum + (row.closing?.pendingReviews ?? 0), 0),
    };
  });

  readonly filtered = computed(() => {
    const quick = this.quickFilter();
    return this.scoped().filter((row) => {
      switch (quick) {
        case 'ALERTS':
          return hasActionableAlert(row);
        case 'NO_INVOICES':
          return row.invoicesIssued === 0;
        case 'OPEN':
          return !isClosed(row);
        case 'CLOSED':
          return isClosed(row);
        default:
          return true;
      }
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly pageRows = computed(() => {
    const start = this.pageIndex() * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      label: 'Exportar planilha',
      icon: 'download',
      variant: 'outlined',
      isShow: this.filtered().length > 0,
      handler: () => this.exportCsv(),
    },
  ]);

  ngOnInit(): void {
    const month = this.route.snapshot.queryParamMap.get('mes');
    if (isMonth(month)) {
      this.month.set(month);
    }
    this.form.controls.search.valueChanges.pipe(debounceTime(200)).subscribe((value) => {
      this.search.set(value);
      this.pageIndex.set(0);
    });
    this.load();
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.router.navigate([], { relativeTo: this.route, queryParams: { mes: this.month() }, replaceUrl: true });
    this.load();
  }

  selectRegime(key: RegimeFilter): void {
    this.regimeFilter.set(key);
    this.pageIndex.set(0);
  }

  /** Os cards de resumo são atalhos de filtro; clicar de novo volta para "todas". */
  toggleQuick(key: QuickFilter): void {
    this.quickFilter.set(this.quickFilter() === key ? 'ALL' : key);
    this.pageIndex.set(0);
  }

  open(row: TaxAssessmentDTO): void {
    this.router.navigate(['/apuracao', row.companyId], { queryParams: { mes: this.month() } });
  }

  private load(): void {
    this.loading.set(true);
    this.service.firm(this.month()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.pageIndex.set(0);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => this.loading.set(false),
    });
  }

  /** CSV com ponto e vírgula (abre direto no Excel) do que está filtrado. */
  private exportCsv(): void {
    const number = (value: number) => value.toFixed(2).replace('.', ',');
    const header = ['Empresa', 'CNPJ/CPF', 'Regime', 'Notas de saída', 'Faturamento', 'RBT12', 'Acumulado no ano', 'Impostos estimados', 'Fechamento', 'Alertas'];
    const lines = this.filtered().map((row) => [
      row.companyName,
      formatDocument(row.companyDocument),
      regimeLabel(row),
      String(row.invoicesIssued),
      number(row.revenue.net),
      number(row.rbt12),
      number(row.yearToDate),
      number(row.totalTaxes),
      isClosed(row) ? 'Fechado' : 'Aberto',
      actionableAlerts(row).map((alert) => alert.message).join(' | '),
    ]);
    const csv = [header, ...lines]
      .map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `apuracao-${this.month()}.csv`);
  }
}

function hasActionableAlert(row: TaxAssessmentDTO): boolean {
  const level = worstLevel(row);
  return level === 'DANGER' || level === 'WARNING';
}
