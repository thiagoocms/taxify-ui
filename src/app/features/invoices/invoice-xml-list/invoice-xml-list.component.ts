import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { FiscalXmlDownloadResultDTO, FiscalXmlSummaryDTO } from '../../../core/models/fiscal-xml.model';
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
  summaryIssuerDocument,
  summaryIssuerName,
  summaryRecipientDocument,
  summaryRecipientName,
  tipoOperacaoLabel,
  toIsoDate,
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
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
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
  });

  readonly loading = signal(false);
  readonly exportingZip = signal(false);
  readonly hasSearched = signal(false);
  readonly xmls = signal<FiscalXmlSummaryDTO[]>([]);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;
  readonly queriedCompany = signal<CompanyDTO | null>(null);

  readonly pageTotal = computed(() =>
    this.xmls().reduce((sum, xml) => sum + (xml.valorTotalNota ?? 0), 0),
  );

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

  readonly xmlColumns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.noteCell() },
    { name: 'Emissão', cellTemplate: this.dateCell(), width: '120px' },
    { name: 'Emitente', property: 'emitente', cellTemplate: this.partyCell() },
    { name: 'Destinatário', property: 'destinatario', cellTemplate: this.partyCell() },
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
      handler: () => this.openImportModal(),
    },
  ]);

  // Formatting helpers exposed to the template.
  readonly documentTypeLabel = documentTypeLabel;
  readonly tipoOperacaoLabel = tipoOperacaoLabel;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly formatDocument = formatDocument;
  readonly formatTime = formatTime;
  readonly issuerName = summaryIssuerName;
  readonly issuerDocument = summaryIssuerDocument;
  readonly recipientName = summaryRecipientName;
  readonly recipientDocument = summaryRecipientDocument;

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  ngOnInit(): void {
    const saved = this.state.search();
    if (saved) {
      this.form.setValue({
        company: saved.company,
        dataEmissaoInicio: saved.dataEmissaoInicio,
        dataEmissaoFim: saved.dataEmissaoFim,
        numero: saved.numero,
      });
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

    // Typing a note number filters as you go, once a company is already picked.
    this.form.controls.numero.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroyed$))
      .subscribe(() => {
        if (this.queriedCompany()) {
          this.buscarXmls();
        }
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

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadXmls();
  }

  private loadXmls(): void {
    const { company, dataEmissaoInicio, dataEmissaoFim, numero } = this.form.getRawValue();
    const companyId = company!.id!;

    this.loading.set(true);

    this.fiscalXmlService
      .search({
        companyId,
        dataEmissaoInicio: dataEmissaoInicio || undefined,
        dataEmissaoFim: dataEmissaoFim || undefined,
        numero: numero.trim() || undefined,
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
    const { company, dataEmissaoInicio, dataEmissaoFim, numero } = this.form.getRawValue();
    this.state.search.set({
      company,
      dataEmissaoInicio,
      dataEmissaoFim,
      numero,
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
