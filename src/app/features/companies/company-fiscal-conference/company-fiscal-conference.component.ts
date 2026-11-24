import { DatePipe } from '@angular/common';
import { Component, computed, inject, Input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { DivergenceSeverity, FiscalCheckFindingDTO } from '../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../core/services/product-fiscal-rule.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { findingGroup, FINDING_GROUPS } from './finding-groups';

/** Primeiro e último dia do mês anterior, AAAA-MM-DD. */
function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}

/**
 * Conferência fiscal da empresa num período: todos os achados das checagens (regra do
 * produto, cálculo dos impostos, alíquota interestadual, IBS/CBS, totais...), um por linha,
 * com link para a nota. Acordeão da tela da empresa, carregado só quando aberto.
 */
@Component({
  selector: 'app-company-fiscal-conference',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, FaIconComponent, Button, InputComponent],
  templateUrl: './company-fiscal-conference.component.html',
  styleUrl: './company-fiscal-conference.component.scss',
})
export class CompanyFiscalConferenceComponent {
  private readonly service = inject(ProductFiscalRuleService);
  private readonly router = inject(Router);

  @Input() companyId = '';

  readonly chevronIcon = faChevronDown;
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly findings = signal<FiscalCheckFindingDTO[]>([]);

  private readonly range = previousMonthRange();
  readonly fromControl = new FormControl(this.range.from, { nonNullable: true });
  readonly toControl = new FormControl(this.range.to, { nonNullable: true });
  readonly severityControl = new FormControl('', { nonNullable: true });
  readonly groupControl = new FormControl('', { nonNullable: true });
  readonly severityFilter = signal('');
  readonly groupFilter = signal('');

  readonly severityOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    { value: 'ERROR', label: 'Erros' },
    { value: 'WARNING', label: 'Alertas' },
  ];
  readonly groupOptions: SelectOption[] = [{ value: '', label: 'Todas' }, ...FINDING_GROUPS.map((g) => ({ value: g.key, label: g.label }))];

  readonly filtered = computed(() =>
    this.findings().filter(
      (finding) =>
        (!this.severityFilter() || finding.severidade === this.severityFilter()) &&
        (!this.groupFilter() || findingGroup(finding.codigo) === this.groupFilter()),
    ),
  );
  readonly errorCount = computed(() => this.findings().filter((f) => f.severidade === 'ERROR').length);
  readonly warningCount = computed(() => this.findings().filter((f) => f.severidade === 'WARNING').length);
  readonly noteCount = computed(() => new Set(this.findings().map((f) => f.documentId)).size);

  constructor() {
    this.severityControl.valueChanges.subscribe((value) => this.severityFilter.set(value));
    this.groupControl.valueChanges.subscribe((value) => this.groupFilter.set(value));
  }

  toggle(): void {
    this.open.update((value) => !value);
    if (this.open() && !this.loaded()) {
      this.load();
    }
  }

  load(): void {
    if (!this.companyId) {
      return;
    }
    this.loading.set(true);
    this.service.conferencia(this.companyId, this.fromControl.value || undefined, this.toControl.value || undefined).subscribe({
      next: (findings) => {
        this.findings.set(findings);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => this.loading.set(false),
    });
  }

  /** "NF 473" - o número sai da chave de acesso (posições 26 a 34); sem chave, "Abrir nota". */
  noteLabel(finding: FiscalCheckFindingDTO): string {
    const key = (finding.accessKey ?? '').replace(/\D/g, '');
    return key.length === 44 ? `NF ${Number(key.substring(25, 34))}` : 'Abrir nota';
  }

  openNote(finding: FiscalCheckFindingDTO): void {
    this.router.navigate(['/notas-fiscais', finding.documentId]);
  }

  severityLabel(severity: DivergenceSeverity): string {
    return severity === 'ERROR' ? 'Erro' : 'Alerta';
  }
}
