import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { AcessoriasImportResultDTO } from '../../../core/models/acessorias.model';
import { CompanyDTO } from '../../../core/models/company.model';
import { isRunning, progressLabel, SyncJobStatusDTO } from '../../../core/models/sync-job.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { AcessoriasService } from '../../../core/services/acessorias.service';
import { CompanyService } from '../../../core/services/company.service';
import { pollUntilDone } from '../../../core/services/sync-job-polling';
import { CompanyFormComponent } from '../company-form/company-form.component';

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputComponent, Modal, Page, Pagination, Table, CompanyFormComponent],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss',
})
export class CompanyListComponent implements OnInit {
  readonly columns: TableColumn[] = [
    { name: 'Nome', property: 'name' },
    { name: 'Tipo doc.', property: 'documentType' },
    { name: 'Documento', property: 'documentNumber' },
    { name: 'UF', property: 'uf' },
    { name: 'Regime', property: 'taxRegime' },
    { name: 'Situação', property: 'situacao' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

  private readonly acessoriasService = inject(AcessoriasService);
  private readonly accountingFirmService = inject(AccountingFirmService);
  private readonly toastr = inject(ToastrService);

  readonly companies = signal<(CompanyDTO & { situacao: string })[]>([]);
  private readonly destroyRef = inject(DestroyRef);
  /** Importação em segundo plano: acompanhada até terminar; o resumo abre no fim. */
  readonly importJob = signal<SyncJobStatusDTO<AcessoriasImportResultDTO> | null>(null);
  readonly importing = computed(() => isRunning(this.importJob()));
  readonly importResult = signal<AcessoriasImportResultDTO | null>(null);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly viewMode = signal<ViewMode>('list');
  readonly editingCompany = signal<CompanyDTO | null>(null);

  readonly pageTitle = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Empresas';
    }
    return this.editingCompany() ? 'Editar empresa' : 'Nova empresa';
  });

  readonly pageDescription = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Gerencie as empresas cadastradas na plataforma';
    }
    return this.editingCompany() ? 'Atualize os dados da empresa' : 'Preencha os dados da nova empresa';
  });

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      return [
        {
          label: this.importing() ? `Importando ${progressLabel(this.importJob())}...` : 'Importar do Acessórias',
          icon: 'cloud-arrow-down',
          variant: 'outlined',
          isDisabled: this.importing(),
          isShow: this.accountingFirmService.hasAcessoriasToken(),
          handler: () => this.importFromAcessorias(),
        },
        { label: 'Nova empresa', icon: 'plus', handler: () => this.openCreateForm() },
      ];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly companyService: CompanyService) {}

  ngOnInit(): void {
    this.loadCompanies();
    this.accountingFirmService.loadCurrent();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.loadCompanies();
      });
  }

  loadCompanies(): void {
    this.loading.set(true);
    this.companyService
      .getAll(
        { page: this.pageIndex(), size: this.pageSize },
        { name: this.searchControl.value || undefined },
      )
      .subscribe({
        next: (page) => {
          this.companies.set(page.content.map((company) => ({ ...company, situacao: this.situacao(company) })));
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private situacao(company: CompanyDTO): string {
    if (company.active == null) {
      return '';
    }
    return company.active ? 'Ativa' : 'Inativa';
  }

  importFromAcessorias(): void {
    // A mensagem de erro da API (ex.: token não configurado) já é exibida pelo interceptor.
    this.acessoriasService.startImport().subscribe((job) => {
      this.importJob.set(job);
      this.followImport();
    });
  }

  private followImport(): void {
    pollUntilDone(() => this.acessoriasService.importStatus())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((job) => {
        this.importJob.set(job);
        if (isRunning(job)) {
          return;
        }
        if (job.status === 'FAILED' || !job.result) {
          this.toastr.error(job.error || 'A importação do Acessórias falhou.', 'Importação do Acessórias');
          return;
        }
        this.importResult.set(job.result);
        this.toastr.success(`${job.result.created} criada(s), ${job.result.updated} atualizada(s).`, 'Importação do Acessórias');
        this.loadCompanies();
      });
  }

  closeImportResult(): void {
    this.importResult.set(null);
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadCompanies();
  }

  openCreateForm(): void {
    this.editingCompany.set(null);
    this.viewMode.set('form');
  }

  openEditForm(company: CompanyDTO & { situacao?: string }): void {
    const { situacao, ...dto } = company;
    this.editingCompany.set(dto);
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
  }

  onSaved(): void {
    this.viewMode.set('list');
    this.loadCompanies();
  }

  remove(company: CompanyDTO): void {
    if (!confirm(`Deseja realmente excluir a empresa "${company.name}"?`)) {
      return;
    }

    this.companyService.delete(company.id!).subscribe(() => this.loadCompanies());
  }
}
