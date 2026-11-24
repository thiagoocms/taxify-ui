import { HelpTipComponent } from '../../shared/help/help-tip.component';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../core/models/company.model';
import {
  IntegrationHealthDTO,
  PENDENCY_TYPE_LABELS,
  PendencyDTO,
  PendencySeverity,
  PendencySummaryDTO,
  SEVERITY_LABELS,
} from '../../core/models/pendency.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { PendencyService } from '../../core/services/pendency.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page, PageButton } from '../../shared/components/page/page';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { monthLabel, shiftMonth, toMonth } from '../assessment/assessment-format';

type CloseAction = 'resolver' | 'desconsiderar';

/**
 * Painel de pendências (roadmap M13): o que falta em cada empresa da carteira, por prioridade,
 * com link para resolver e fechamento sempre com comentário; embaixo, a saúde das integrações.
 * Mesmo desenho da Apuração: filtros em chips, resumo, atalhos por tipo e tabela.
 */
@Component({
  selector: 'app-pendencies',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Pagination, Table, HelpTipComponent],
  templateUrl: './pendencies.component.html',
  styleUrl: './pendencies.component.scss',
})
export class PendenciesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly pendencyService = inject(PendencyService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly severityCell = viewChild.required<TemplateRef<unknown>>('severityCell');
  private readonly companyCell = viewChild.required<TemplateRef<unknown>>('companyCell');
  private readonly pendencyCell = viewChild.required<TemplateRef<unknown>>('pendencyCell');
  private readonly competenceCell = viewChild.required<TemplateRef<unknown>>('competenceCell');
  private readonly sinceCell = viewChild.required<TemplateRef<unknown>>('sinceCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');
  private readonly healthCompanyCell = viewChild.required<TemplateRef<unknown>>('healthCompanyCell');
  private readonly healthRunCell = viewChild.required<TemplateRef<unknown>>('healthRunCell');
  private readonly healthStatusCell = viewChild.required<TemplateRef<unknown>>('healthStatusCell');
  private readonly healthRunsCell = viewChild.required<TemplateRef<unknown>>('healthRunsCell');

  readonly statusChips = [
    { key: 'ABERTA', label: 'Abertas' },
    { key: 'RESOLVIDA', label: 'Resolvidas' },
    { key: 'DESCONSIDERADA', label: 'Desconsideradas' },
    { key: 'TODAS', label: 'Todas' },
  ];
  readonly severityChips = [
    { key: '', label: 'Toda severidade' },
    { key: 'ALTA', label: 'Alta' },
    { key: 'MEDIA', label: 'Média' },
    { key: 'BAIXA', label: 'Baixa' },
  ];

  readonly canClose = this.auth.can('INVOICES_AUDIT');
  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly companyId = signal<string | undefined>(undefined);
  readonly status = signal('ABERTA');
  readonly severity = signal('');
  readonly type = signal('');
  readonly competence = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly rows = signal<PendencyDTO[]>([]);
  readonly summary = signal<PendencySummaryDTO | null>(null);
  readonly health = signal<IntegrationHealthDTO[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly refreshing = signal(false);
  readonly closing = signal<{ pendency: PendencyDTO; action: CloseAction } | null>(null);
  comment = '';

  protected readonly formatDocument = formatDocument;
  protected readonly monthLabel = monthLabel;
  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Severidade', cellTemplate: this.severityCell(), width: '110px' },
    { name: 'Empresa', cellTemplate: this.companyCell(), width: '220px' },
    { name: 'Pendência', cellTemplate: this.pendencyCell() },
    { name: 'Competência', cellTemplate: this.competenceCell(), width: '110px' },
    { name: 'Desde', cellTemplate: this.sinceCell(), width: '100px' },
    { name: 'Ações', headerClass: 'justify-content-end', cellTemplate: this.actionsCell(), width: '96px' },
  ]);

  readonly healthColumns = computed<TableColumn[]>(() => [
    { name: 'Empresa', cellTemplate: this.healthCompanyCell() },
    { name: 'Coleta', property: 'service', width: '150px' },
    { name: 'Última execução', cellTemplate: this.healthRunCell(), width: '170px' },
    { name: 'Situação', cellTemplate: this.healthStatusCell() },
    { name: 'Execuções (7 dias)', cellTemplate: this.healthRunsCell(), headerClass: 'justify-content-end', width: '160px' },
  ]);

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      id: 'pendencies-refresh',
      label: this.refreshing() ? 'Atualizando...' : 'Atualizar agora',
      icon: 'cloud-arrow-down',
      variant: 'outlined',
      isDisabled: this.refreshing(),
      handler: () => this.refresh(),
    },
  ]);

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const id = company && typeof company === 'object' && company.id ? company.id : undefined;
      if (id !== this.companyId() && (id || !company)) {
        this.companyId.set(id);
        this.reloadAll();
      }
    });
    this.reloadAll();
  }

  private reloadAll(): void {
    this.page.set(0);
    this.load();
    this.pendencyService.summary(this.companyId()).subscribe({ next: (s) => this.summary.set(s), error: () => this.summary.set(null) });
    this.pendencyService.health(this.companyId()).subscribe({ next: (h) => this.health.set(h), error: () => this.health.set([]) });
  }

  private load(): void {
    this.loading.set(true);
    this.pendencyService
      .list({
        companyId: this.companyId(),
        status: this.status(),
        severity: (this.severity() || undefined) as PendencySeverity | undefined,
        type: this.type() || undefined,
        competence: this.competence() || undefined,
        page: this.page(),
        size: 50,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
          this.loaded.set(true);
        },
      });
  }

  severityTotal(level: 'alta' | 'media' | 'baixa'): number {
    return (this.summary()?.counters ?? []).reduce((sum, counter) => sum + counter[level], 0);
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.page.set(0);
    this.load();
  }

  setSeverity(value: string): void {
    this.severity.set(value);
    this.page.set(0);
    this.load();
  }

  setType(value: string): void {
    this.type.set(this.type() === value ? '' : value);
    this.page.set(0);
    this.load();
  }

  /** From "all" the arrows start at the current month. */
  shiftCompetence(delta: number): void {
    this.setCompetence(this.competence() ? shiftMonth(this.competence(), delta) : toMonth(new Date()));
  }

  setCompetence(value: string): void {
    this.competence.set(value ?? '');
    this.page.set(0);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  refresh(): void {
    this.refreshing.set(true);
    this.pendencyService.refresh(this.companyId()).subscribe({
      next: (result) => {
        this.refreshing.set(false);
        if (result.emSegundoPlano) {
          this.toastr.info('Atualizando a carteira em segundo plano — recarregue em alguns minutos.');
        } else {
          this.toastr.success('Pendências da empresa atualizadas.');
          this.reloadAll();
        }
      },
      error: () => this.refreshing.set(false),
    });
  }

  askClose(pendency: PendencyDTO, action: CloseAction): void {
    this.comment = '';
    this.closing.set({ pendency, action });
  }

  confirmClose(): void {
    const closing = this.closing();
    if (!closing) {
      return;
    }
    const request =
      closing.action === 'resolver'
        ? this.pendencyService.resolve(closing.pendency.id, this.comment.trim())
        : this.pendencyService.dismiss(closing.pendency.id, this.comment.trim());
    request.subscribe(() => {
      this.closing.set(null);
      this.toastr.success(closing.action === 'resolver' ? 'Pendência resolvida.' : 'Pendência desconsiderada.');
      this.reloadAll();
    });
  }

  reopen(pendency: PendencyDTO): void {
    this.pendencyService.reopen(pendency.id).subscribe(() => {
      this.toastr.success('Pendência reaberta.');
      this.reloadAll();
    });
  }

  /** Para onde a pendência leva: a nota, a nota de serviço, a manifestação (resumo sem XML) ou a empresa. */
  linkFor(p: PendencyDTO): { path: string[]; query?: Record<string, string> } | null {
    if (p.objectType === 'NOTE' && p.objectId) {
      return { path: ['/notas-fiscais', p.objectId] };
    }
    if (p.objectType === 'SERVICE_NOTE') {
      return { path: ['/notas-servico'] };
    }
    if (p.objectType === 'NOTE_KEY') {
      return { path: ['/manifestacao'] };
    }
    if (p.type === 'AUDIT_FINDING') {
      return { path: ['/auditoria'] };
    }
    if (p.objectType === 'COMPANY') {
      return { path: ['/cadastro/empresas'], query: { empresa: p.companyId } };
    }
    return null;
  }

  open(p: PendencyDTO): void {
    const link = this.linkFor(p);
    if (link) {
      this.router.navigate(link.path, { queryParams: link.query });
    }
  }

  typeLabel(p: PendencyDTO): string {
    return PENDENCY_TYPE_LABELS[p.type] ?? p.typeLabel;
  }

  severityLabel(severity: PendencySeverity): string {
    return SEVERITY_LABELS[severity] ?? severity;
  }

  severityClass(severity: PendencySeverity): string {
    return severity === 'ALTA' ? 'danger' : severity === 'MEDIA' ? 'warn' : '';
  }

  healthLabel(h: IntegrationHealthDTO): string {
    return h.lastStatus === 'OK' ? 'Notas recebidas' : h.lastStatus === 'SEM_MOVIMENTO' ? 'Sem movimento' : h.lastStatus === 'ERRO' ? 'Erro' : '—';
  }
}
