import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faBoxesStacked, faCircleInfo, faDownload, faEye, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { withJsonErrorBody } from '../../../core/models/api-error.model';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';
import {
  STOCK_CREDIT_CLASSIFICATION_HINTS,
  STOCK_CREDIT_CLASSIFICATION_LABELS,
  STOCK_CREDIT_CLASSIFICATION_ORDER,
  STOCK_CREDIT_CLASSIFICATION_TONES,
  STOCK_CREDIT_COVERAGE_HINTS,
  STOCK_CREDIT_COVERAGE_LABELS,
  STOCK_CREDIT_COVERAGE_ORDER,
  STOCK_CREDIT_COVERAGE_TONES,
  STOCK_CREDIT_NOTICE,
  STOCK_CREDIT_SEARCH_MIN,
  STOCK_CREDIT_SORT_LABELS,
  STOCK_CREDIT_SORT_OPTIONS,
  STOCK_CREDIT_STATUS_LABELS,
  STOCK_CREDIT_STATUS_ORDER,
  STOCK_CREDIT_STATUS_TONES,
  STOCK_CREDIT_YEAR,
  StockCreditClassification,
  StockCreditCoverage,
  StockCreditFilter,
  StockCreditRowDTO,
  StockCreditSort,
  StockCreditStatus,
  StockCreditSummaryDTO,
} from '../../../core/models/stock-credit.model';
import { AuthService } from '../../../core/services/auth.service';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { ReformFeaturesService } from '../../../core/services/reform-features.service';
import { StockCreditService } from '../../../core/services/stock-credit.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { formatDocument } from '../../../shared/utils/document-mask';
import { downloadBlob } from '../../../shared/utils/download-blob';
import { formatCurrency, formatLocalDate, formatLocalDateTime } from '../../../shared/utils/format';
import { StockCreditDetailComponent } from './stock-credit-detail.component';
import { EMPTY_FILTER, filterFromParams, hasActiveFilter, paramsFromFilter, sameFilter, toggleValue } from './stock-credit-url';
import { calculatedText, coverageText, csvFileName, regimeLabel, stockCreditErrorView } from './stock-credit-view';

/**
 * Reforma > Crédito de estoque (F-CE-2): quem pode ter direito ao crédito presumido de CBS sobre o estoque de
 * 31/12/2026, pelo regime cadastrado, com as compras de 2026 e a cobertura das notas. ADMIN vê o escritório; os demais
 * perfis, a carteira (o backend filtra). Filtros, ordem e página na URL; lista e resumo paginados no servidor.
 * Não é cálculo de crédito: o texto fixo da CE-RN-13 fica no topo.
 */
@Component({
  selector: 'app-stock-credit',
  standalone: true,
  imports: [NgTemplateOutlet, ReactiveFormsModule, FaIconComponent, Button, InputComponent, LoaderComponent, Page, Pagination, Table, StockCreditDetailComponent],
  templateUrl: './stock-credit.component.html',
  styleUrl: './stock-credit.component.scss',
})
export class StockCreditComponent implements OnInit {
  private readonly service = inject(StockCreditService);
  private readonly auth = inject(AuthService);
  private readonly firmAccess = inject(FirmAccessService);
  private readonly features = inject(ReformFeaturesService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Atualizar e mudar a situação (CE-RN-09 e CE-RN-10). */
  readonly canWrite = this.auth.can('TAX_ASSESSMENT_CLOSE');
  readonly isAdmin = this.auth.isAdmin;
  readonly closed = this.features.stockCreditClosed;
  readonly readOnly = this.firmAccess.readOnly;
  readonly year = STOCK_CREDIT_YEAR;
  readonly searchMin = STOCK_CREDIT_SEARCH_MIN;

  readonly classificationOrder = STOCK_CREDIT_CLASSIFICATION_ORDER;
  readonly statusOrder = STOCK_CREDIT_STATUS_ORDER;
  readonly coverageOrder = STOCK_CREDIT_COVERAGE_ORDER;
  readonly classificationLabels: Partial<Record<string, string>> = STOCK_CREDIT_CLASSIFICATION_LABELS;
  readonly classificationHints: Record<string, string> = STOCK_CREDIT_CLASSIFICATION_HINTS;
  readonly classificationTones: Record<string, string> = STOCK_CREDIT_CLASSIFICATION_TONES;
  readonly statusLabels: Partial<Record<string, string>> = STOCK_CREDIT_STATUS_LABELS;
  readonly statusTones: Record<string, string> = STOCK_CREDIT_STATUS_TONES;
  readonly coverageLabels: Partial<Record<string, string>> = STOCK_CREDIT_COVERAGE_LABELS;
  readonly coverageHints: Record<string, string> = STOCK_CREDIT_COVERAGE_HINTS;
  readonly coverageTones: Record<string, string> = STOCK_CREDIT_COVERAGE_TONES;

  readonly infoIcon = faCircleInfo;
  readonly warnIcon = faTriangleExclamation;
  readonly lockIcon = faLock;
  readonly emptyIcon = faBoxesStacked;
  readonly formatCurrency = formatCurrency;
  readonly formatDocument = formatDocument;
  readonly formatDate = formatLocalDate;
  readonly formatDateTime = formatLocalDateTime;
  readonly calculatedText = calculatedText;
  readonly coverageText = coverageText;
  readonly regimeLabel = regimeLabel;

  readonly coverageOptions: SelectOption[] = [
    { value: '', label: 'Toda cobertura' },
    ...STOCK_CREDIT_COVERAGE_ORDER.map((coverage) => ({ value: coverage, label: STOCK_CREDIT_COVERAGE_LABELS[coverage] })),
  ];
  readonly sortOptions: SelectOption[] = [
    { value: '', label: 'Padrão (classificação e compras)' },
    ...STOCK_CREDIT_SORT_OPTIONS.map((sort) => ({ value: sort, label: STOCK_CREDIT_SORT_LABELS[sort] })),
  ];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly coverageControl = new FormControl<string>('', { nonNullable: true });
  readonly sortControl = new FormControl<string>('', { nonNullable: true });

  // ------------------------------------------------------------- Estado --
  readonly filter = signal<StockCreditFilter>(EMPTY_FILTER);
  readonly rows = signal<StockCreditRowDTO[]>([]);
  readonly summary = signal<StockCreditSummaryDTO | null>(null);
  readonly notice = signal<string>(STOCK_CREDIT_NOTICE);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  /** Recurso desligado no ambiente (404 `error.reform.stock.disabled`). */
  readonly featureDisabled = signal(false);
  readonly exporting = signal(false);
  readonly selected = signal<StockCreditRowDTO | null>(null);
  private listSub: Subscription | null = null;

  readonly hasFilter = computed(() => hasActiveFilter(this.filter()));
  /** Busca com 1 ou 2 caracteres não vai para a API (mínimo 3): a tela avisa em vez de dizer "nenhuma empresa". */
  readonly searchTooShort = computed(() => {
    const length = this.filter().search.trim().length;
    return length > 0 && length < STOCK_CREDIT_SEARCH_MIN;
  });

  readonly classificationCards = computed(() => {
    const counts = this.summary()?.byClassification ?? {};
    const active = new Set(this.filter().classification);
    return STOCK_CREDIT_CLASSIFICATION_ORDER.map((key) => ({ key, count: counts[key] ?? 0, active: active.has(key) }));
  });

  readonly statusChips = computed(() => {
    const counts = this.summary()?.byStatus ?? {};
    const active = new Set(this.filter().status);
    return STOCK_CREDIT_STATUS_ORDER.map((key) => ({ key, count: counts[key] ?? 0, active: active.has(key) }));
  });

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      label: this.exporting() ? 'Gerando CSV...' : 'Exportar CSV',
      icon: 'download',
      variant: 'outlined',
      isShow: !this.featureDisabled(),
      isDisabled: this.exporting() || !this.loaded(),
      tooltip: 'Todas as empresas com os filtros e a ordem atuais (sem paginação)',
      handler: () => this.exportCsv(),
    },
  ]);

  private readonly companyCell = viewChild.required<TemplateRef<unknown>>('companyCell');
  private readonly classificationCell = viewChild.required<TemplateRef<unknown>>('classificationCell');
  private readonly purchasesCell = viewChild.required<TemplateRef<unknown>>('purchasesCell');
  private readonly coverageCell = viewChild.required<TemplateRef<unknown>>('coverageCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Empresa', cellTemplate: this.companyCell() },
    { name: 'Classificação', cellTemplate: this.classificationCell() },
    { name: `Compras ${this.year}`, cellTemplate: this.purchasesCell(), headerClass: 'justify-content-end' },
    { name: 'Cobertura', cellTemplate: this.coverageCell() },
    { name: 'Situação', cellTemplate: this.statusCell() },
    { name: 'Ações', cellTemplate: this.actionsCell(), headerClass: 'justify-content-end' },
  ]);

  readonly tableConfig: TableConfig = { headerVisible: true };

  constructor() {
    inject(FaIconLibrary).addIcons(faDownload, faEye);
  }

  ngOnInit(): void {
    // A URL manda: cada mudança (filtro, página, voltar do navegador, link colado) busca de novo.
    this.route.queryParamMap
      .pipe(map(filterFromParams), takeUntilDestroyed(this.destroyRef))
      .subscribe((filter) => {
        const first = !this.loaded() && !this.loading() && !this.listSub;
        if (!first && sameFilter(filter, this.filter())) return;
        this.filter.set(filter);
        this.syncControls(filter);
        this.load();
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.navigate({ search }));
    this.coverageControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((coverage) => this.navigate({ coverage: coverage ? [coverage as StockCreditCoverage] : [] }));
    this.sortControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sort) => this.navigate({ sort: (sort || null) as StockCreditSort | null }));
  }

  private syncControls(filter: StockCreditFilter): void {
    const options = { emitEvent: false };
    if (this.searchControl.value !== filter.search) this.searchControl.setValue(filter.search, options);
    // O seletor é de um valor; a URL pode trazer mais (link): o seletor mostra o primeiro.
    this.coverageControl.setValue(filter.coverage[0] ?? '', options);
    this.sortControl.setValue(filter.sort ?? '', options);
  }

  /** Muda o filtro pela URL (sem histórico novo). Mudar filtro volta para a primeira página. */
  navigate(change: Partial<StockCreditFilter>): void {
    const next: StockCreditFilter = { ...this.filter(), page: 0, ...change };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: paramsFromFilter(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  load(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.listSub = this.service.getAll(this.filter()).subscribe({
      next: (response) => {
        // Página além do total (link velho, filtro que encolheu a lista): volta para a última válida.
        const lastPage = Math.max(response.page.totalPages - 1, 0);
        if (this.filter().page > lastPage) {
          this.navigate({ ...this.filter(), page: lastPage });
          return;
        }
        this.notice.set(response.notice || STOCK_CREDIT_NOTICE);
        this.summary.set(response.summary);
        this.rows.set(response.page.content);
        this.totalPages.set(response.page.totalPages);
        this.totalElements.set(response.page.totalElements);
        this.featureDisabled.set(false);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        const view = stockCreditErrorView(error, 'list');
        if (view.disabled) {
          this.featureDisabled.set(true);
          this.features.reload(); // o menu some
          return;
        }
        this.loadError.set(view.message);
      },
    });
  }

  onPageIndexChange(index: number): void {
    this.navigate({ ...this.filter(), page: index });
  }

  toggleClassification(key: StockCreditClassification): void {
    this.navigate({ classification: toggleValue(this.filter().classification, key, STOCK_CREDIT_CLASSIFICATION_ORDER) });
  }

  toggleStatus(key: StockCreditStatus): void {
    this.navigate({ status: toggleValue(this.filter().status, key, STOCK_CREDIT_STATUS_ORDER) });
  }

  clearFilters(): void {
    this.navigate({ ...EMPTY_FILTER, sort: this.filter().sort });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.service.exportCsv(this.filter()).subscribe({
      next: (response) => {
        this.exporting.set(false);
        if (response.body) {
          downloadBlob(response.body, csvFileName(response.headers.get('Content-Disposition'), new Date()));
        }
      },
      error: async (error: unknown) => {
        // O CSV vem como Blob: o corpo do erro também, e precisa ser lido para achar o code.
        const view = stockCreditErrorView(await withJsonErrorBody(error), 'export');
        this.exporting.set(false);
        this.toastr.warning(view.message, 'Exportar CSV');
        if (view.reloadFirmAccess) this.firmAccess.reload();
        if (view.disabled) {
          this.featureDisabled.set(true);
          this.features.reload();
        }
      },
    });
  }

  // ------------------------------------------------------------ Detalhe --
  open(row: StockCreditRowDTO): void {
    this.selected.set(row);
  }

  close(): void {
    this.selected.set(null);
  }

  /** O detalhe gravou (situação ou recálculo): a linha e o resumo mudam. */
  onChanged(): void {
    this.load();
  }
}
