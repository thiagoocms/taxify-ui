import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { CompanyDTO } from '../../../core/models/company.model';
import { InvoiceAuditLogDTO } from '../../../core/models/invoice-audit-log.model';
import { FiscalXmlDownloadResultDTO, FiscalXmlItemDTO } from '../../../core/models/fiscal-xml.model';
import { downloadBlob } from '../../../shared/utils/download-blob';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { FiscalXmlService } from '../../../core/services/fiscal-xml.service';
import { InvoiceAuditLogService } from '../../../core/services/invoice-audit-log.service';

const XML_TYPE_OPTIONS: SelectOption[] = [
  { value: 1, label: 'NFe' },
  { value: 2, label: 'CTe' },
  { value: 3, label: 'NFSe' },
  { value: 4, label: 'NFCe' },
  { value: 5, label: 'MDFe' },
];

const YES_NO_OPTIONS: SelectOption[] = [
  { value: '', label: 'Não' },
  { value: 'true', label: 'Sim' },
];

@Component({
  selector: 'app-invoice-xml-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Button, InputComponent, Modal, Page, Table],
  templateUrl: './invoice-xml-list.component.html',
  styleUrl: './invoice-xml-list.component.scss',
})
export class InvoiceXmlListComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly invoiceAuditLogService = inject(InvoiceAuditLogService);

  private readonly destroyed$ = new Subject<void>();

  readonly xmlTypeOptions = XML_TYPE_OPTIONS;
  readonly yesNoOptions = YES_NO_OPTIONS;

  readonly xmlColumns: TableColumn[] = [
    { name: 'Chave de acesso', property: 'accessKey' },
    { name: 'Tipo', property: 'documentType' },
    { name: 'Emitente', property: 'issuerCnpj' },
    { name: 'Destinatário', property: 'recipientCnpj' },
    { name: 'Emissão', property: 'issueDate' },
  ];

  readonly auditColumns: TableColumn[] = [
    { name: 'Status', property: 'status' },
    { name: 'Observações', property: 'notes' },
  ];

  readonly auditTableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.editAuditEntry(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.removeAuditEntry(row) },
    ],
  };

  readonly editingLog = signal<InvoiceAuditLogDTO | null>(null);
  readonly auditFormDialogOpen = signal(false);

  readonly auditForm = this.fb.group({
    status: this.fb.nonNullable.control('', Validators.required),
    notes: this.fb.nonNullable.control('', Validators.required),
  });

  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null, Validators.required),
    xmlType: this.fb.control<string | number | null>(null),
    dataEmissaoInicio: this.fb.nonNullable.control(''),
    dataEmissaoFim: this.fb.nonNullable.control(''),
    downloadEvent: this.fb.nonNullable.control(''),
  });

  readonly loading = signal(false);
  readonly exportingZip = signal(false);
  readonly result = signal<FiscalXmlDownloadResultDTO | null>(null);
  readonly queriedCompanyId = signal<string | null>(null);

  readonly selectedXml = signal<FiscalXmlItemDTO | null>(null);
  readonly noteAuditLogs = signal<InvoiceAuditLogDTO[]>([]);
  readonly noteAuditLoading = signal(false);

  readonly importModalOpen = signal(false);
  readonly importing = signal(false);
  readonly importResult = signal<FiscalXmlDownloadResultDTO | null>(null);
  readonly importFile = signal<File | null>(null);

  readonly importForm = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null, Validators.required),
  });

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      label: this.exportingZip() ? 'Exportando...' : 'Exportar XML em lote (ZIP)',
      icon: 'file-zipper',
      variant: 'outlined',
      severity: 'secondary',
      isDisabled: this.exportingZip(),
      handler: () => this.exportarZip(),
    },
    {
      label: 'Importar XML manualmente',
      icon: 'upload',
      variant: 'outlined',
      handler: () => this.openImportModal(),
    },
  ]);

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  buscarXmls(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { company, xmlType, dataEmissaoInicio, dataEmissaoFim, downloadEvent } = this.form.getRawValue();
    const companyId = company!.id!;

    this.loading.set(true);
    this.result.set(null);

    this.fiscalXmlService
      .download({
        companyId,
        xmlType: Number(xmlType),
        dataEmissaoInicio: dataEmissaoInicio || undefined,
        dataEmissaoFim: dataEmissaoFim || undefined,
        downloadEvent: downloadEvent === 'true',
      })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          this.result.set(result);
          this.queriedCompanyId.set(companyId);
        },
        error: () => this.loading.set(false),
      });
  }

  exportarZip(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { company, xmlType, dataEmissaoInicio, dataEmissaoFim } = this.form.getRawValue();
    const companyId = company!.id!;

    this.exportingZip.set(true);
    this.fiscalXmlService
      .exportarZip({
        companyId,
        xmlType: Number(xmlType),
        dataEmissaoInicio: dataEmissaoInicio || undefined,
        dataEmissaoFim: dataEmissaoFim || undefined,
      })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (blob) => {
          this.exportingZip.set(false);
          downloadBlob(blob, `notas-fiscais-${companyId}.zip`);
        },
        error: () => this.exportingZip.set(false),
      });
  }

  openImportModal(): void {
    this.importForm.reset({ company: null });
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

    const companyId = this.importForm.getRawValue().company!.id!;
    const file = this.importFile()!;

    this.importing.set(true);
    this.fiscalXmlService
      .importarManual(companyId, file)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.importResult.set(result);
        },
        error: () => this.importing.set(false),
      });
  }

  openNoteAudit(xml: FiscalXmlItemDTO): void {
    this.selectedXml.set(xml);
    this.resetAuditForm();
    this.loadNoteAuditLogs();
  }

  closeNoteAudit(): void {
    this.selectedXml.set(null);
    this.noteAuditLogs.set([]);
    this.closeAuditForm();
  }

  loadNoteAuditLogs(): void {
    const companyId = this.queriedCompanyId();
    const accessKey = this.selectedXml()?.accessKey;
    if (!companyId || !accessKey) {
      this.noteAuditLogs.set([]);
      return;
    }

    this.noteAuditLoading.set(true);
    this.invoiceAuditLogService
      .getAll({ page: 0, size: 50 }, { companyId, externalInvoiceKey: accessKey })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (page) => {
          this.noteAuditLogs.set(page.content);
          this.noteAuditLoading.set(false);
        },
        error: () => this.noteAuditLoading.set(false),
      });
  }

  openCreateAuditForm(): void {
    this.resetAuditForm();
    this.auditFormDialogOpen.set(true);
  }

  editAuditEntry(log: InvoiceAuditLogDTO): void {
    this.editingLog.set(log);
    this.auditForm.setValue({ status: log.status, notes: log.notes });
    this.auditFormDialogOpen.set(true);
  }

  closeAuditForm(): void {
    this.auditFormDialogOpen.set(false);
    this.resetAuditForm();
  }

  private resetAuditForm(): void {
    this.editingLog.set(null);
    this.auditForm.reset({ status: '', notes: '' });
  }

  saveAudit(): void {
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      return;
    }

    const { status, notes } = this.auditForm.getRawValue();
    const log = this.editingLog();

    if (log) {
      this.invoiceAuditLogService
        .update(log.id!, { ...log, status, notes })
        .pipe(takeUntil(this.destroyed$))
        .subscribe(() => {
          this.closeAuditForm();
          this.loadNoteAuditLogs();
        });
      return;
    }

    const xml = this.selectedXml();
    const companyId = this.queriedCompanyId();
    const userId = this.authService.userId();
    if (!xml?.accessKey || !companyId || !userId) {
      return;
    }

    const newLog: InvoiceAuditLogDTO = {
      externalInvoiceKey: xml.accessKey,
      userId,
      companyId,
      status,
      notes,
    };

    this.invoiceAuditLogService
      .create(newLog)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.closeAuditForm();
        this.loadNoteAuditLogs();
      });
  }

  removeAuditEntry(log: InvoiceAuditLogDTO): void {
    if (!confirm(`Remover o registro de auditoria da nota "${log.externalInvoiceKey}"?`)) {
      return;
    }

    this.invoiceAuditLogService
      .delete(log.id!)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.loadNoteAuditLogs());
  }
}
