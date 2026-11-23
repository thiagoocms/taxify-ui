import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Component, computed, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { CompanyDTO } from '../../../core/models/company.model';
import {
  DIRECTION_LABELS,
  FiscalDirection,
  FiscalXmlDownloadResultDTO,
  FiscalXmlSummaryDTO,
  FiscalXmlTotalsDTO,
  ReviewStatus,
  FiscalXmlOrigin,
  ORIGIN_LABELS,
} from '../../../core/models/fiscal-xml.model';

import { downloadBlob } from '../../../shared/utils/download-blob';
import { CompanyService } from '../../../core/services/company.service';
import { FiscalXmlService } from '../../../core/services/fiscal-xml.service';
import { InvoiceStateService } from '../invoice-state.service';
import {
  copyToClipboard,
  documentTypeLabel,
  formatCurrency,
  formatDate,
  formatDocument,
  formatTime,
  toIsoDate,
  counterpartDocument,
  counterpartName,
  counterpartRole,
} from '../invoice-format';

type PeriodKey = 'current-month' | 'last-month' | 'last-90' | 'all' | 'custom';

interface PeriodOption {
  key: PeriodKey;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'current-month', label: 'Este mês' },
  { key: 'last-month', label: 'Mês anterior' },
  { key: 'last-90', label: 'Últimos 90 dias' },
  { key: 'all', label: 'Todo o período' },
  { key: 'custom', label: 'Personalizado' },
];

// The search endpoint ignores the document type (it only looks at what's already
// stored), but the ZIP export still validates it as required — any value works.
const EXPORT_XML_TYPE = 1;

function companySelected(control: AbstractControl): ValidationErrors | null {
  const value = control.value as CompanyDTO | string | null;
  return value && typeof value === 'object' && value.id ? null : { required: true };
}

function periodRange(key: PeriodKey): { inicio: string; fim: string } | null {
  const today = new Date();
  switch (key) {
    case 'current-month':
      return { inicio: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), fim: toIsoDate(today) };
    case 'last-month':
      return {
        inicio: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        fim: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'last-90': {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { inicio: toIsoDate(start), fim: toIsoDate(today) };
    }
    case 'all':
      return { inicio: '', fim: '' };
    default:
      return null;
  }
}

@Component({
  selector: 'app-invoice-xml-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Pagination, Table],
  templateUrl: './invoice-xml-list.component.html',
  styleUrl: './invoice-xml-list.component.scss',
})
export class InvoiceXmlListComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastr = inject(ToastrService);
  private readonly companyService = inject(CompanyService);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly state = inject(InvoiceStateService);

  private readonly destroyed$ = new Subject<void>();

  readonly periodOptions = PERIOD_OPTIONS;
  readonly period = signal<PeriodKey>('current-month');

  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null, companySelected),
    dataEmissaoInicio: this.fb.nonNullable.control(''),
    dataEmissaoFim: this.fb.nonNullable.control(''),
    numero: this.fb.nonNullable.control(''),
    participant: this.fb.nonNullable.control(''),
  });

  /** Origem da nota ou confronto SIEG × SEFAZ ('' = tudo). */
  readonly sourceFilter = signal<string>('');
  /** Filtro de conferência (null = todas). */
  readonly reviewFilter = signal<ReviewStatus | null>(null);
  readonly reviewing = signal(false);
  readonly canReview = this.auth.can('INVOICES_AUDIT');
  /** Notas da página ainda a conferir (canceladas não precisam). */
  readonly pendingOnPage = computed(() =>
    this.xmls().filter((xml) => (xml.reviewStatus ?? 'PENDING') === 'PENDING' && xml.status !== 'CANCELED'),
  );

  /** Aba ativa: todas, só entradas ou só saídas. */
  readonly direction = signal<FiscalDirection | null>(null);
  readonly totals = signal<FiscalXmlTotalsDTO | null>(null);
  readonly directionLabel = (direction: FiscalDirection): string => DIRECTION_LABELS[direction];

  readonly loading = signal(false);
  readonly exportingZip = signal(false);
  readonly hasSearched = signal(false);
  readonly xmls = signal<FiscalXmlSummaryDTO[]>([]);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;
  readonly queriedCompany = signal<CompanyDTO | null>(null);


  readonly importModalOpen = signal(false);
  readonly importing = signal(false);
  readonly importResult = signal<FiscalXmlDownloadResultDTO | null>(null);
  readonly importFile = signal<File | null>(null);

  readonly importForm = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null, companySelected),
  });

  private readonly noteCell = viewChild.required<TemplateRef<unknown>>('noteCell');
  private readonly partyCell = viewChild.required<TemplateRef<unknown>>('partyCell');
  private readonly dateCell = viewChild.required<TemplateRef<unknown>>('dateCell');
  private readonly valueCell = viewChild.required<TemplateRef<unknown>>('valueCell');
  private readonly cfopCell = viewChild.required<TemplateRef<unknown>>('cfopCell');

  readonly xmlColumns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.noteCell() },
    { name: 'Emissão', cellTemplate: this.dateCell(), width: '120px' },
    { name: 'Participante', cellTemplate: this.partyCell() },
    { name: 'CFOP', cellTemplate: this.cfopCell(), width: '110px' },
    { name: 'Valor total', cellTemplate: this.valueCell(), headerClass: 'justify-content-end', width: '150px' },
  ]);

  readonly xmlTableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'copy', icon: 'copy', tooltip: 'Copiar chave de acesso', variant: 'text', severity: 'secondary', handler: (row) => this.copyKey(row) },
      { name: 'download', icon: 'download', tooltip: 'Baixar XML', variant: 'text', severity: 'secondary', handler: (row) => this.downloadXml(row) },
    ],
  };

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      label: this.exportingZip() ? 'Exportando...' : 'Exportar ZIP',
      icon: 'file-zipper',
      variant: 'outlined',
      severity: 'secondary',
      isDisabled: this.exportingZip() || !this.queriedCompany(),
      handler: () => this.exportarZip(),
    },
    {
      label: 'Importar XML',
      icon: 'upload',
      isShow: this.auth.can('INVOICES_SYNC'),
      handler: () => this.openImportModal(),
    },
  ]);

  // Formatting helpers exposed to the template.
  readonly documentTypeLabel = documentTypeLabel;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly formatDocument = formatDocument;
  readonly formatTime = formatTime;
  readonly counterpartName = counterpartName;
  readonly counterpartDocument = counterpartDocument;
  readonly counterpartRole = counterpartRole;

  /** Busca a empresa pelo nome ou pelo CNPJ (com ou sem pontuação) no mesmo campo. */
  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  /** "NOME - 11.473.118/0001-53" na lista do autocomplete e no campo depois de escolher. */
  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    const saved = this.state.search();
    const linkedCompanyId = this.route.snapshot.queryParamMap.get('empresa');
    if (linkedCompanyId) {
      this.openLinkedCompany(linkedCompanyId, this.route.snapshot.queryParamMap.get('mes'));
    } else if (saved) {
      this.form.setValue({
        company: saved.company,
        dataEmissaoInicio: saved.dataEmissaoInicio,
        dataEmissaoFim: saved.dataEmissaoFim,
        numero: saved.numero,
        participant: saved.participant ?? '',
      });
      this.direction.set(saved.direction ?? null);
      this.totals.set(saved.totals ?? null);
      this.period.set(saved.period as PeriodKey);
      this.pageIndex.set(saved.pageIndex);
      this.totalPages.set(saved.totalPages);
      this.totalElements.set(saved.totalElements);
      this.xmls.set(saved.xmls);
      this.queriedCompany.set(saved.company);
      this.hasSearched.set(true);
    } else {
      this.applyPeriod('current-month', false);
    }

    // Picking a company from the autocomplete searches right away — no extra click.
    // The group's status isn't recalculated yet when a child's valueChanges fires,
    // so this checks the company itself instead of going through buscarXmls().
    this.form.controls.company.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe((company) => {
      if (company && typeof company === 'object' && company.id && company.id !== this.queriedCompany()?.id) {
        this.pageIndex.set(0);
        this.loadXmls();
      }
    });

    // Typing a note number or a supplier/customer filters as you go, once a company is picked.
    for (const control of [this.form.controls.numero, this.form.controls.participant]) {
      control.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroyed$))
        .subscribe(() => {
          if (this.queriedCompany()) {
            this.buscarXmls();
          }
        });
    }
  }

  /**
   * Opened from another screen (Apuração → "Ver notas"): that company, that month
   * ("2026-10"), searched right away - instead of the last search.
   */
  private openLinkedCompany(companyId: string, month: string | null): void {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, value] = month.split('-').map(Number);
      this.period.set('custom');
      this.form.patchValue(
        {
          dataEmissaoInicio: toIsoDate(new Date(year, value - 1, 1)),
          dataEmissaoFim: toIsoDate(new Date(year, value, 0)),
        },
        { emitEvent: false },
      );
    } else {
      this.applyPeriod('current-month', false);
    }
    this.companyService.getById(companyId).subscribe((company) => {
      this.form.controls.company.setValue(company, { emitEvent: false });
      this.pageIndex.set(0);
      this.loadXmls();
    });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  selectPeriod(key: PeriodKey): void {
    this.applyPeriod(key, key !== 'custom');
  }

  private applyPeriod(key: PeriodKey, search: boolean): void {
    this.period.set(key);
    const range = periodRange(key);
    if (range) {
      this.form.patchValue({ dataEmissaoInicio: range.inicio, dataEmissaoFim: range.fim }, { emitEvent: false });
    }
    if (search && this.form.valid) {
      this.buscarXmls();
    }
  }

  buscarXmls(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pageIndex.set(0);
    this.loadXmls();
  }

  /** Origem (SIEG / SEFAZ / upload) ou confronto entre as fontes (SO_SIEG / SO_SEFAZ); vazio = tudo. */
  selectSourceFilter(value: string): void {
    this.sourceFilter.set(value ?? '');
    if (this.queriedCompany()) {
      this.pageIndex.set(0);
      this.loadXmls(false);
    }
  }

  originLabel(origin: FiscalXmlOrigin): string {
    return ORIGIN_LABELS[origin] ?? origin;
  }

  selectReviewFilter(value: string): void {
    this.reviewFilter.set((value || null) as ReviewStatus | null);
    if (this.queriedCompany()) {
      this.pageIndex.set(0);
      this.loadXmls();
    }
  }

  /** Marca como conferidas as notas a conferir desta página. */
  reviewPage(): void {
    const ids = this.pendingOnPage().map((xml) => xml.id);
    if (!ids.length) {
      return;
    }
    this.reviewing.set(true);
    this.fiscalXmlService.reviewMany(ids, 'REVIEWED').subscribe({
      next: (count) => {
        this.reviewing.set(false);
        this.toastr.success(`${count} ${count === 1 ? 'nota conferida' : 'notas conferidas'}.`);
        this.loadXmls();
      },
      error: () => this.reviewing.set(false),
    });
  }

  /** Troca a aba (todas / entradas / saídas) e volta para a primeira página. */
  selectDirection(direction: FiscalDirection | null): void {
    if (direction === this.direction()) {
      return;
    }
    this.direction.set(direction);
    if (this.queriedCompany()) {
      this.pageIndex.set(0);
      this.loadXmls(false);
    }
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadXmls(false);
  }

  /** {@code withTotals}: the cards only change with company/period, not with tab, page or text filters. */
  private loadXmls(withTotals = true): void {
    const { company, dataEmissaoInicio, dataEmissaoFim, numero, participant } = this.form.getRawValue();
    const companyId = company!.id!;
    const period = {
      companyId,
      dataEmissaoInicio: dataEmissaoInicio || undefined,
      dataEmissaoFim: dataEmissaoFim || undefined,
    };

    this.loading.set(true);

    if (withTotals || company?.id !== this.queriedCompany()?.id) {
      this.fiscalXmlService
        .totals(period)
        .pipe(takeUntil(this.destroyed$))
        .subscribe({ next: (totals) => this.totals.set(totals), error: () => this.totals.set(null) });
    }

    this.fiscalXmlService
      .search({
        ...period,
        numero: numero.trim() || undefined,
        participant: participant.trim() || undefined,
        direction: this.direction() ?? undefined,
        reviewStatus: this.reviewFilter() ?? undefined,
        origem: ['SIEG', 'SEFAZ_DIST', 'UPLOAD'].includes(this.sourceFilter())
          ? (this.sourceFilter() as FiscalXmlOrigin)
          : undefined,
        fonte: ['SO_SIEG', 'SO_SEFAZ'].includes(this.sourceFilter()) ? (this.sourceFilter() as 'SO_SIEG' | 'SO_SEFAZ') : undefined,
        pagination: { page: this.pageIndex(), size: this.pageSize },
      })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (page) => {
          this.loading.set(false);
          this.hasSearched.set(true);
          this.xmls.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.queriedCompany.set(company);
          this.saveState();
        },
        error: () => this.loading.set(false),
      });
  }

  private saveState(): void {
    const { company, dataEmissaoInicio, dataEmissaoFim, numero, participant } = this.form.getRawValue();
    this.state.search.set({
      company,
      dataEmissaoInicio,
      dataEmissaoFim,
      numero,
      participant,
      direction: this.direction(),
      totals: this.totals(),
      period: this.period(),
      pageIndex: this.pageIndex(),
      totalPages: this.totalPages(),
      totalElements: this.totalElements(),
      xmls: this.xmls(),
    });
  }

  openDetail(xml: FiscalXmlSummaryDTO): void {
    this.router.navigate(['/notas-fiscais', xml.id]);
  }

  copyKey(xml: FiscalXmlSummaryDTO): void {
    if (!xml.accessKey) {
      this.toastr.warning('Esta nota não possui chave de acesso.');
      return;
    }
    copyToClipboard(xml.accessKey).then(() => this.toastr.success('Chave de acesso copiada.'));
  }

  downloadXml(xml: FiscalXmlSummaryDTO): void {
    this.fiscalXmlService
      .downloadXml(xml.id)
      .pipe(takeUntil(this.destroyed$))
      .subscribe((blob) => downloadBlob(blob, `${xml.accessKey || 'nota-fiscal'}.xml`));
  }

  exportarZip(): void {
    const company = this.queriedCompany();
    if (!company?.id) {
      return;
    }

    const { dataEmissaoInicio, dataEmissaoFim } = this.form.getRawValue();
    this.exportingZip.set(true);
    this.fiscalXmlService
      .exportarZip({
        companyId: company.id,
        xmlType: EXPORT_XML_TYPE,
        dataEmissaoInicio: dataEmissaoInicio || undefined,
        dataEmissaoFim: dataEmissaoFim || undefined,
      })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (blob) => {
          this.exportingZip.set(false);
          downloadBlob(blob, `notas-fiscais-${company.documentNumber || company.id}.zip`);
        },
        error: () => this.exportingZip.set(false),
      });
  }

  openImportModal(): void {
    this.importForm.reset({ company: this.queriedCompany() });
    this.importFile.set(null);
    this.importResult.set(null);
    this.importModalOpen.set(true);
  }

  closeImportModal(): void {
    this.importModalOpen.set(false);
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
  }

  importarXml(): void {
    if (this.importForm.invalid || !this.importFile()) {
      this.importForm.markAllAsTouched();
      return;
    }

    const company = this.importForm.getRawValue().company!;
    const file = this.importFile()!;

    this.importing.set(true);
    this.fiscalXmlService
      .importarManual(company.id!, file)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.importResult.set(result);
          // Refresh the list when the import landed in the company being viewed.
          if (company.id === this.queriedCompany()?.id && result.totalPersistedNew) {
            this.loadXmls();
          }
        },
        error: () => this.importing.set(false),
      });
  }
}
