import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { AUDIT_GROUP_LABELS, AuditFindingDTO, AuditGroup, AuditReportDTO, AuditRuleDTO } from '../../core/models/audit.model';
import { CompanyDTO } from '../../core/models/company.model';
import { SEVERITY_LABELS, PendencySeverity } from '../../core/models/pendency.model';
import { AuditService } from '../../core/services/audit.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { PendencyService } from '../../core/services/pendency.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { downloadBlob } from '../../shared/utils/download-blob';
import { monthLabel, previousMonth, shiftMonth } from '../assessment/assessment-format';

type CloseAction = 'resolver' | 'desconsiderar';

/**
 * Auditoria tipo malha (roadmap M9): os achados do mês de uma empresa — integridade das notas,
 * coerência dos itens emitidos e anomalias —, o laudo em PDF/CSV e o catálogo de regras com a
 * conferência do time fiscal. Mesmo desenho da Apuração.
 */
import { MonthNavComponent } from '../../shared/components/month-nav/month-nav.component';
import { LoaderComponent } from '../../shared/components/loader/loader';
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [LoaderComponent, MonthNavComponent, CommonModule, FormsModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Table],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
})
export class AuditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly auditService = inject(AuditService);
  private readonly pendencyService = inject(PendencyService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly severityCell = viewChild.required<TemplateRef<unknown>>('severityCell');
  private readonly findingCell = viewChild.required<TemplateRef<unknown>>('findingCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');
  private readonly ruleCell = viewChild.required<TemplateRef<unknown>>('ruleCell');
  private readonly basisCell = viewChild.required<TemplateRef<unknown>>('basisCell');
  private readonly ruleStatusCell = viewChild.required<TemplateRef<unknown>>('ruleStatusCell');
  private readonly ruleActionsCell = viewChild.required<TemplateRef<unknown>>('ruleActionsCell');

  readonly groups: AuditGroup[] = ['INTEGRIDADE', 'COERENCIA', 'ANOMALIA'];
  readonly canRun = this.auth.can('INVOICES_AUDIT');
  readonly canClose = this.auth.can('INVOICES_AUDIT');
  readonly canManageRules = this.auth.can('FISCAL_RULES_MANAGE');
  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly month = signal(previousMonth());
  readonly companyId = signal<string | null>(null);
  readonly view = signal<'findings' | 'rules'>('findings');
  readonly report = signal<AuditReportDTO | null>(null);
  readonly rules = signal<AuditRuleDTO[]>([]);
  readonly loading = signal(false);
  readonly running = signal(false);
  readonly groupFilter = signal<AuditGroup | null>(null);
  readonly showClosed = signal(false);
  readonly closing = signal<{ finding: AuditFindingDTO; action: CloseAction } | null>(null);
  comment = '';

  protected readonly monthLabel = monthLabel;
  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  readonly filtered = computed(() =>
    (this.report()?.findings ?? [])
      .filter((finding) => this.showClosed() || finding.status === 'ABERTA')
      .filter((finding) => !this.groupFilter() || finding.group === this.groupFilter()),
  );
  readonly openCount = computed(() => (this.report()?.findings ?? []).filter((finding) => finding.status === 'ABERTA').length);

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Severidade', cellTemplate: this.severityCell(), width: '110px' },
    { name: 'Achado', cellTemplate: this.findingCell() },
    { name: 'Ações', headerClass: 'justify-content-end', cellTemplate: this.actionsCell(), width: '96px' },
  ]);

  readonly ruleColumns = computed<TableColumn[]>(() => [
    { name: 'Regra', cellTemplate: this.ruleCell(), width: '300px' },
    { name: 'Fundamento', cellTemplate: this.basisCell() },
    { name: 'Situação', cellTemplate: this.ruleStatusCell(), width: '170px' },
    { name: 'Ações', headerClass: 'justify-content-end', cellTemplate: this.ruleActionsCell(), width: '96px' },
  ]);

  readonly pageButtons = computed<PageButton[]>(() => {
    const hasCompany = !!this.companyId() && this.view() === 'findings';
    return [
      { id: 'audit-run', label: this.running() ? 'Auditando...' : 'Rodar auditoria', icon: 'magnifying-glass',
        isShow: hasCompany && this.canRun, isDisabled: this.running(), handler: () => this.run() },
      { id: 'audit-pdf', label: 'Laudo PDF', icon: 'file-pdf', variant: 'outlined', isShow: hasCompany,
        isDisabled: !this.report()?.run, handler: () => this.download('pdf') },
      { id: 'audit-csv', label: 'Exportar CSV', icon: 'download', variant: 'outlined', isShow: hasCompany,
        isDisabled: !this.report()?.run, handler: () => this.download('csv') },
    ];
  });

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const id = company && typeof company === 'object' && company.id ? company.id : null;
      if (id && id !== this.companyId()) {
        this.companyId.set(id);
        this.report.set(null);
        this.load();
      }
    });
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.load();
  }

  private load(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.loading.set(true);
    this.auditService.report(companyId, this.month()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  run(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.running.set(true);
    this.loading.set(true);
    this.auditService.run(companyId, this.month()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.running.set(false);
        this.loading.set(false);
        const open = report.findings.filter((finding) => finding.status === 'ABERTA').length;
        this.toastr.success(open ? `Auditoria concluída: ${open} achado(s) aberto(s).` : 'Auditoria concluída sem achados.');
      },
      error: () => {
        this.running.set(false);
        this.loading.set(false);
      },
    });
  }

  download(kind: 'pdf' | 'csv'): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    const request = kind === 'pdf' ? this.auditService.pdf(companyId, this.month()) : this.auditService.csv(companyId, this.month());
    request.subscribe((blob) => downloadBlob(blob, `laudo-auditoria-${this.month()}.${kind}`));
  }

  openRules(): void {
    this.view.set('rules');
    this.auditService.rules().subscribe((rules) => this.rules.set(rules));
  }

  reviewRule(rule: AuditRuleDTO): void {
    this.auditService.review(rule.code, !rule.reviewed).subscribe((updated) => {
      this.rules.set(this.rules().map((item) => (item.code === updated.code ? updated : item)));
      this.toastr.success(updated.reviewed ? 'Regra marcada como conferida — vale a partir da próxima auditoria.' : 'Conferência desfeita.');
    });
  }

  enableRule(rule: AuditRuleDTO): void {
    this.auditService.enable(rule.code, !rule.enabled).subscribe((updated) => {
      this.rules.set(this.rules().map((item) => (item.code === updated.code ? updated : item)));
    });
  }

  toggleGroup(group: AuditGroup): void {
    this.groupFilter.set(this.groupFilter() === group ? null : group);
  }

  groupCount(group: AuditGroup): number {
    return (this.report()?.findings ?? []).filter((finding) => finding.group === group && finding.status === 'ABERTA').length;
  }

  severityCount(severity: string): number {
    return (this.report()?.findings ?? []).filter((finding) => finding.severity === severity && finding.status === 'ABERTA').length;
  }

  askClose(finding: AuditFindingDTO, action: CloseAction): void {
    this.comment = '';
    this.closing.set({ finding, action });
  }

  confirmClose(): void {
    const closing = this.closing();
    if (!closing) {
      return;
    }
    const request =
      closing.action === 'resolver'
        ? this.pendencyService.resolve(closing.finding.pendencyId, this.comment.trim())
        : this.pendencyService.dismiss(closing.finding.pendencyId, this.comment.trim());
    request.subscribe(() => {
      this.closing.set(null);
      this.toastr.success(closing.action === 'resolver' ? 'Achado resolvido.' : 'Achado desconsiderado.');
      this.load();
    });
  }

  reopen(finding: AuditFindingDTO): void {
    this.pendencyService.reopen(finding.pendencyId).subscribe(() => this.load());
  }

  openNote(finding: AuditFindingDTO): void {
    if (finding.objectId) {
      this.router.navigate(['/notas-fiscais', finding.objectId]);
    }
  }

  groupLabel(group?: AuditGroup | null): string {
    return group ? AUDIT_GROUP_LABELS[group] ?? group : '—';
  }

  severityLabel(severity: string): string {
    return SEVERITY_LABELS[severity as PendencySeverity] ?? severity;
  }

  severityClass(severity: string): string {
    return severity === 'ALTA' ? 'danger' : severity === 'MEDIA' ? 'warn' : '';
  }
}
