import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';
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
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { formatDocument } from '../../../shared/utils/document-mask';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { Button } from '../../../shared/components/button/button';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { certidaoBadge, CertidaoSummaryDTO } from '../../../core/models/certidao.model';
import { CertidaoService, openPdf } from '../../../core/services/certidao.service';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { planNameInSentence } from '../../../core/models/api-error.model';

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [LoaderComponent, Button, FaIconComponent, CommonModule, ReactiveFormsModule, InputComponent, Modal, Page, Pagination, Table, CompanyFormComponent],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss',
})
export class CompanyListComponent implements OnInit {
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly auth = inject(AuthService);
  /** Somente leitura e limite do teste: desabilitam "Nova empresa", importar e excluir. */
  protected readonly firmAccess = inject(FirmAccessService);

  private readonly certidaoCell = viewChild.required<TemplateRef<unknown>>('certidaoCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Nome', property: 'name' },
    { name: 'Tipo doc.', property: 'documentType' },
    { name: 'Documento', property: 'documentNumber', format: formatDocument },
    { name: 'UF', property: 'uf' },
    { name: 'Regime', property: 'taxRegime' },
    { name: 'Situação', property: 'situacao' },
    { name: 'Certidão PE', cellTemplate: this.certidaoCell(), width: '190px' },
  ]);

  private readonly certidaoService = inject(CertidaoService);
  /** Certidão SEFAZ-PE da carteira, por empresa (só as de PE com CNPJ aparecem). */
  readonly certidoes = signal<Record<string, CertidaoSummaryDTO>>({});

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    // Só o administrador altera o cadastro; os demais abrem a empresa para ver as seções do perfil deles.
    // Em somente leitura, editar continua abrindo a ficha (o Salvar fica desabilitado); excluir fica desabilitado.
    actions: this.auth.isAdmin
      ? [
          { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
          { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', write: true, handler: (row) => this.remove(row) },
        ]
      : [{ name: 'open', icon: 'eye', tooltip: 'Abrir', variant: 'text', handler: (row) => this.openEditForm(row) }],
  };

  /** Limite do teste atingido: "Nova empresa" desabilitado, com a explicação acima da lista. */
  readonly companyLimitMessage = computed(() => {
    const limits = this.firmAccess.limits();
    if (!this.auth.isAdmin || !limits || !this.firmAccess.companyLimitReached()) {
      return null;
    }
    return `O ${planNameInSentence(limits.planName)} permite ${limits.maxCompanies} empresas e o escritório já tem ` +
      `${limits.companiesInUse} em uso. Empresas inativas não contam. Fale com a CS Hub para contratar.`;
  });

  private readonly acessoriasService = inject(AcessoriasService);
  private readonly accountingFirmService = inject(AccountingFirmService);
  private readonly toastr = inject(ToastrService);

  readonly companies = signal<(CompanyDTO & { situacao: string })[]>([]);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
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
    if (!this.auth.isAdmin) {
      return this.editingCompany()?.name ?? 'Empresa';
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
          write: true,
          isShow: this.auth.isAdmin && this.accountingFirmService.hasAcessoriasToken(),
          handler: () => this.importFromAcessorias(),
        },
        {
          label: 'Nova empresa',
          icon: 'plus',
          isShow: this.auth.isAdmin,
          isDisabled: this.firmAccess.companyLimitReached(),
          tooltip: this.companyLimitMessage() ?? undefined,
          write: true,
          handler: () => this.openCreateForm(),
        },
      ];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly companyService: CompanyService) {}

  ngOnInit(): void {
    this.loadCompanies();
    this.loadCertidoes();
    this.accountingFirmService.loadCurrent();

    // Opened from another screen (Pendências → "Abrir"): goes straight to that company.
    const linkedCompanyId = this.route.snapshot.queryParamMap.get('empresa');
    if (linkedCompanyId) {
      this.companyService.getById(linkedCompanyId).subscribe((company) => this.openEditForm(company));
    }

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

  private loadCertidoes(): void {
    this.certidaoService.carteira().subscribe({
      next: (list) => this.certidoes.set(Object.fromEntries(list.map((item) => [item.companyId, item]))),
      error: () => this.certidoes.set({}),
    });
  }

  certidaoOf(companyId?: string | null): CertidaoSummaryDTO | undefined {
    return companyId ? this.certidoes()[companyId] : undefined;
  }

  certidaoBadge(item: CertidaoSummaryDTO): { label: string; cls: string } {
    return certidaoBadge(item.status, item.situacao);
  }

  openCertidao(item: CertidaoSummaryDTO, event?: Event): void {
    event?.stopPropagation();
    if (item.certidaoId) {
      this.certidaoService.pdf(item.certidaoId).subscribe((blob) => openPdf(blob));
    }
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
        const skippedByLimit = job.result.skippedByLimit ?? 0;
        const limitNote = skippedByLimit ? ` ${skippedByLimit} fora por limite do teste.` : '';
        this.toastr.success(
          `${job.result.created} criada(s), ${job.result.updated} atualizada(s).${limitNote}`,
          'Importação do Acessórias',
        );
        this.loadCompanies();
        this.firmAccess.reload();
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
    // Criar ou reativar empresa muda o uso do limite do teste.
    this.firmAccess.reload();
  }

  async remove(company: CompanyDTO): Promise<void> {
    if (!(await this.confirmDialog.ask(`Deseja realmente excluir a empresa "${company.name}"?`, { title: 'Excluir empresa', confirmLabel: 'Excluir', danger: true }))) {
      return;
    }

    this.companyService.delete(company.id!).subscribe({
      next: () => {
        this.loadCompanies();
        this.firmAccess.reload();
      },
      // O interceptor já mostrou o toast (somente leitura, não encontrado...); a linha continua na lista.
      error: () => undefined,
    });
  }
}
