import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page } from '../../shared/components/page/page';
import { Pagination } from '../../shared/components/pagination/pagination';
import { formatDocument } from '../../shared/utils/document-mask';

type CloseAction = 'resolver' | 'desconsiderar';

/**
 * Painel de pendências (roadmap M13): o que falta em cada empresa da carteira, por prioridade,
 * com link para resolver e fechamento sempre com comentário; embaixo, a saúde das integrações.
 */
@Component({
  selector: 'app-pendencies',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputComponent, Modal, Page, Pagination],
  template: `
    <app-page pageTitle="Pendências" pageDescription="O que falta em cada empresa da carteira, por prioridade">
      <form [formGroup]="form" class="filters">
        <div class="company-field">
          <app-input
            formControlName="company"
            label="Empresa (vazio = toda a carteira)"
            type="autocomplete"
            [searchFn]="searchCompanies"
            [displayFn]="companyLabel"
            displayField="name"
            displayFieldTooltip="documentNumber"
          ></app-input>
        </div>
        <select class="form-select form-select-sm" [ngModel]="status()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="setStatus($event)">
          <option value="ABERTA">Abertas</option>
          <option value="RESOLVIDA">Resolvidas</option>
          <option value="DESCONSIDERADA">Desconsideradas</option>
          <option value="TODAS">Todas</option>
        </select>
        <select class="form-select form-select-sm" [ngModel]="severity()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="setSeverity($event)">
          <option value="">Toda severidade</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Média</option>
          <option value="BAIXA">Baixa</option>
        </select>
        <input type="month" class="form-control form-control-sm month" [ngModel]="competence()" [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="setCompetence($event)" title="Competência" />
        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ refreshing() ? 'Atualizando...' : 'Atualizar agora' }}
        </button>
      </form>

      @if (summary(); as s) {
        <div class="counters">
          <button type="button" class="counter" [class.active]="!type()" (click)="setType('')">
            <span class="counter-total">{{ s.totalOpen }}</span>
            <span class="counter-label">Abertas</span>
          </button>
          @for (c of s.counters; track c.type) {
            <button type="button" class="counter" [class.active]="type() === c.type" (click)="setType(c.type)">
              <span class="counter-total">{{ c.total }}</span>
              <span class="counter-label">{{ c.label }}</span>
              <span class="counter-sev">
                @if (c.alta) { <span class="badge text-bg-danger">{{ c.alta }} alta</span> }
                @if (c.media) { <span class="badge text-bg-warning">{{ c.media }} média</span> }
                @if (c.baixa) { <span class="badge text-bg-light border">{{ c.baixa }} baixa</span> }
              </span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <p class="muted"><span class="spinner-border spinner-border-sm me-2"></span>Carregando...</p>
      } @else if (!rows().length) {
        <div class="empty">Nenhuma pendência {{ status() === 'ABERTA' ? 'aberta' : '' }} com esses filtros.</div>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle small">
            <thead>
              <tr>
                <th>Severidade</th>
                <th>Empresa</th>
                <th>Pendência</th>
                <th>Competência</th>
                <th>Desde</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr>
                  <td><span class="badge" [ngClass]="severityClass(p.severity)">{{ severityLabel(p.severity) }}</span></td>
                  <td>
                    {{ p.companyName }}
                    <div class="muted">{{ formatDocument(p.companyDocument) }}</div>
                  </td>
                  <td>
                    <div class="muted">{{ typeLabel(p) }}</div>
                    <strong>{{ p.title }}</strong>
                    @if (p.detail) { <div>{{ p.detail }}</div> }
                    @if (p.status !== 'ABERTA') {
                      <div class="muted fst-italic">
                        {{ p.status === 'RESOLVIDA' ? 'Resolvida' : 'Desconsiderada' }}
                        {{ p.autoClosed ? 'automaticamente' : 'por ' + p.closedBy }} em {{ p.closedAt | date: 'dd/MM/yyyy HH:mm' }}
                        @if (p.closeComment && !p.autoClosed) { — "{{ p.closeComment }}" }
                      </div>
                    }
                  </td>
                  <td>{{ p.competence ? (p.competence + '-01' | date: 'MM/yyyy') : '—' }}</td>
                  <td>{{ p.firstSeenAt | date: 'dd/MM/yyyy' }}</td>
                  <td class="text-end actions">
                    @if (linkFor(p)) {
                      <button type="button" class="btn btn-sm btn-link p-0" (click)="open(p)">Abrir</button>
                    }
                    @if (canClose) {
                      @if (p.status === 'ABERTA') {
                        <button type="button" class="btn btn-sm btn-link p-0 text-success" (click)="askClose(p, 'resolver')">Resolver</button>
                        <button type="button" class="btn btn-sm btn-link p-0 text-secondary" (click)="askClose(p, 'desconsiderar')">Desconsiderar</button>
                      } @else {
                        <button type="button" class="btn btn-sm btn-link p-0" (click)="reopen(p)">Reabrir</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [pageIndex]="page()" [totalPages]="totalPages()" (pageIndexChange)="goTo($event)"></app-pagination>
      }

      @if (health().length) {
        <h6 class="mt-4 section-title">Saúde das integrações — captura SEFAZ</h6>
        <div class="table-responsive">
          <table class="table table-sm small align-middle">
            <thead>
              <tr><th>Empresa</th><th>Última execução</th><th>Situação</th><th class="text-end">Execuções (7 dias)</th><th class="text-end">Com erro</th></tr>
            </thead>
            <tbody>
              @for (h of health(); track h.companyId) {
                <tr>
                  <td>{{ h.companyName }}</td>
                  <td>{{ h.lastRunAt ? (h.lastRunAt | date: 'dd/MM/yyyy HH:mm') : 'ainda não rodou' }}</td>
                  <td>
                    <span class="badge" [ngClass]="h.lastStatus === 'ERRO' ? 'text-bg-danger' : h.lastStatus === 'OK' ? 'text-bg-success' : 'text-bg-secondary'">
                      {{ healthLabel(h) }}
                    </span>
                    @if (h.lastStatus === 'ERRO' && h.lastDetail) { <div class="muted">{{ h.lastDetail }}</div> }
                  </td>
                  <td class="text-end">{{ h.runsLast7Days }}</td>
                  <td class="text-end" [class.text-danger]="h.errorsLast7Days > 0">{{ h.errorsLast7Days }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-page>

    <app-modal [open]="!!closing()" [title]="closing()?.action === 'resolver' ? 'Resolver pendência' : 'Desconsiderar pendência'" (closed)="closing.set(null)">
      @if (closing(); as c) {
        <p class="small"><strong>{{ c.pendency.title }}</strong> — {{ c.pendency.companyName }}</p>
        <textarea class="form-control" rows="3" maxlength="500" [(ngModel)]="comment"
          [placeholder]="c.action === 'resolver' ? 'O que foi feito' : 'Por que não se aplica'"></textarea>
        <div class="small muted mt-1">Comentário obrigatório. Se a causa sumir e voltar depois, a pendência reabre.</div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-sm btn-link" (click)="closing.set(null)">Cancelar</button>
          <button type="button" class="btn btn-sm btn-primary" [disabled]="comment.trim().length < 3" (click)="confirmClose()">Salvar</button>
        </div>
      }
    </app-modal>
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; margin-bottom: 1rem; }
    .filters .company-field { flex: 1 1 320px; max-width: 480px; }
    .filters select { width: auto; }
    .filters .month { width: 160px; }
    .counters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1rem; }
    .counter { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 150px; padding: 8px 12px;
      border: 1px solid var(--bs-border-color, #dee2e6); border-radius: 8px; background: var(--bs-body-bg, #fff); text-align: left; }
    .counter.active { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .counter-total { font-size: 1.25rem; font-weight: 600; }
    .counter-label { font-size: 0.8rem; opacity: 0.8; }
    .counter-sev { display: flex; gap: 4px; flex-wrap: wrap; }
    .muted { opacity: 0.7; }
    .actions { white-space: nowrap; }
    .actions .btn + .btn { margin-left: 10px; }
    .empty { padding: 24px; text-align: center; opacity: 0.7; border: 1px dashed var(--bs-border-color, #dee2e6); border-radius: 6px; }
    .section-title { font-weight: 600; }
  `,
})
export class PendenciesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly pendencyService = inject(PendencyService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly canClose = this.auth.can('INVOICES_AUDIT');
  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
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
  readonly refreshing = signal(false);
  readonly closing = signal<{ pendency: PendencyDTO; action: CloseAction } | null>(null);
  comment = '';

  protected readonly formatDocument = formatDocument;

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  private readonly companyId = computed(() => this.selectedCompany()?.id ?? undefined);
  private readonly selectedCompany = signal<CompanyDTO | null>(null);

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const picked = company && typeof company === 'object' && company.id ? company : null;
      if (picked?.id !== this.selectedCompany()?.id && (picked || !company)) {
        this.selectedCompany.set(picked);
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
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
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

  /** Para onde a pendência leva: a nota, a manifestação (resumo sem XML) ou o cadastro da empresa. */
  linkFor(p: PendencyDTO): { path: string[]; query?: Record<string, string> } | null {
    if (p.objectType === 'NOTE' && p.objectId) {
      return { path: ['/notas-fiscais', p.objectId] };
    }
    if (p.objectType === 'NOTE_KEY') {
      return { path: ['/manifestacao'] };
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
    return severity === 'ALTA' ? 'text-bg-danger' : severity === 'MEDIA' ? 'text-bg-warning' : 'text-bg-light border';
  }

  healthLabel(h: IntegrationHealthDTO): string {
    return h.lastStatus === 'OK' ? 'Notas recebidas' : h.lastStatus === 'SEM_MOVIMENTO' ? 'Sem movimento' : h.lastStatus === 'ERRO' ? 'Erro' : '—';
  }
}
