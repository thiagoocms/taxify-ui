import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../core/models/company.model';
import {
  FRONTEIRA_FLAG_HINTS,
  FRONTEIRA_FLAG_LABELS,
  FronteiraFlag,
  FronteiraItemCalcDTO,
  FronteiraLineDTO,
  FronteiraNoteCalcDTO,
  FronteiraReportDTO,
  FronteiraResultado,
  FronteiraRuleDTO,
  FronteiraRuleInput,
  FronteiraRuleKind,
  FronteiraUnchargedDTO,
  RESULTADO_HINTS,
  RESULTADO_LABELS,
  RULE_KIND_LABELS,
} from '../../core/models/fronteira.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { FronteiraService } from '../../core/services/fronteira.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { formatCurrency } from '../../shared/utils/format';
import { monthLabel } from '../assessment/assessment-format';

type LineFilter = FronteiraResultado | FronteiraFlag | null;

interface RuleForm extends FronteiraRuleInput {
  id?: string | null;
  global: boolean;
}

interface CalcView {
  title: string;
  calc: FronteiraNoteCalcDTO;
  cnpjFornecedor?: string | null;
  charged?: number | null;
}

const STANDARD_FORMULAS: Record<string, string> = {
  ST: 'partida * (1 + mva_ajustada) * interna - icms_origem',
  SIMPLES: 'partida * percentual',
  SEM_ENCERRAMENTO: '(partida - icms_origem) / (1 - interna) * interna - icms_origem',
  USO_CONSUMO: '(partida - icms_origem) / (1 - interna) * interna - icms_origem',
};

/**
 * Fronteira PE: o extrato do ICMS antecipado que o e-Fisco cobra (importado à mão, em PDF), nota a nota
 * ao lado do cálculo do Taxify — pela tabela de ICMS (alíquotas, ST, percentual do Simples) ou pela
 * fórmula própria que a contadora registrar, que passa a valer para as próximas notas.
 */
@Component({
  selector: 'app-fronteira',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Table],
  templateUrl: './fronteira.component.html',
  styleUrl: './fronteira.component.scss',
})
export class FronteiraComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly fronteiraService = inject(FronteiraService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly noteCell = viewChild.required<TemplateRef<unknown>>('noteCell');
  private readonly chargedCell = viewChild.required<TemplateRef<unknown>>('chargedCell');
  private readonly calcCell = viewChild.required<TemplateRef<unknown>>('calcCell');
  private readonly resultCell = viewChild.required<TemplateRef<unknown>>('resultCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');
  private readonly unchargedNoteCell = viewChild.required<TemplateRef<unknown>>('unchargedNoteCell');
  private readonly unchargedValueCell = viewChild.required<TemplateRef<unknown>>('unchargedValueCell');
  private readonly unchargedCalcCell = viewChild.required<TemplateRef<unknown>>('unchargedCalcCell');
  private readonly unchargedActionsCell = viewChild.required<TemplateRef<unknown>>('unchargedActionsCell');
  private readonly ruleKindCell = viewChild.required<TemplateRef<unknown>>('ruleKindCell');
  private readonly ruleScopeCell = viewChild.required<TemplateRef<unknown>>('ruleScopeCell');
  private readonly ruleValueCell = viewChild.required<TemplateRef<unknown>>('ruleValueCell');
  private readonly ruleStatusCell = viewChild.required<TemplateRef<unknown>>('ruleStatusCell');
  private readonly ruleActionsCell = viewChild.required<TemplateRef<unknown>>('ruleActionsCell');

  readonly canImport = this.auth.can('INVOICES_AUDIT');
  readonly canWriteRules = this.auth.can('INVOICES_AUDIT');
  readonly canManageRules = this.auth.can('FISCAL_RULES_MANAGE');
  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly companyId = signal<string | null>(null);
  readonly report = signal<FronteiraReportDTO | null>(null);
  readonly loading = signal(false);
  readonly filter = signal<LineFilter>(null);
  readonly view = signal<'conferencia' | 'regras'>('conferencia');

  readonly importOpen = signal(false);
  readonly importing = signal(false);
  readonly importFile = signal<File | null>(null);

  readonly rules = signal<FronteiraRuleDTO[]>([]);
  readonly ruleForm = signal<RuleForm | null>(null);
  readonly savingRule = signal(false);
  readonly formulaMessage = signal<{ ok: boolean; text: string } | null>(null);
  readonly variables = signal<Record<string, string>>({});
  readonly calcView = signal<CalcView | null>(null);

  readonly flagLabels = FRONTEIRA_FLAG_LABELS;
  readonly resultLabels = RESULTADO_LABELS;
  readonly resultHints = RESULTADO_HINTS;
  readonly kindLabels = RULE_KIND_LABELS;
  readonly kinds: FronteiraRuleKind[] = ['ALIQUOTA_INTERNA', 'ST_MVA', 'SIMPLES_PERCENTUAL', 'FORMULA'];
  readonly quickResults: FronteiraResultado[] = ['COBROU_A_MAIS', 'COBROU_A_MENOS', 'NAO_CALCULOU', 'SEM_REGRA', 'PENDENTE', 'CONFERE'];
  readonly quickFlags: FronteiraFlag[] = ['SEM_XML', 'SO_RESUMO', 'NOTA_CANCELADA', 'VALOR_DIFERENTE', 'DIVERGENCIA_FISCAL', 'FORA_DA_TAXA'];
  readonly tableConfig: TableConfig = { headerVisible: true, actions: [] };

  protected readonly monthLabel = monthLabel;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDocument = formatDocument;

  readonly filtered = computed(() => {
    const lines = this.report()?.lines ?? [];
    const filter = this.filter();
    if (!filter) {
      return lines;
    }
    return lines.filter((line) => line.resultado === filter || line.flags.includes(filter as FronteiraFlag));
  });

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.noteCell() },
    { name: 'Cobrado no e-Fisco', cellTemplate: this.chargedCell(), headerClass: 'justify-content-end', width: '160px' },
    { name: 'Cálculo do Taxify', cellTemplate: this.calcCell(), headerClass: 'justify-content-end', width: '170px' },
    { name: 'Resultado', cellTemplate: this.resultCell(), width: '230px' },
    { name: '', cellTemplate: this.actionsCell(), width: '190px' },
  ]);

  readonly unchargedColumns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.unchargedNoteCell() },
    { name: 'Valor', cellTemplate: this.unchargedValueCell(), headerClass: 'justify-content-end', width: '140px' },
    { name: 'Prévia do ICMS', cellTemplate: this.unchargedCalcCell(), headerClass: 'justify-content-end', width: '170px' },
    { name: '', cellTemplate: this.unchargedActionsCell(), width: '190px' },
  ]);

  readonly ruleColumns = computed<TableColumn[]>(() => [
    { name: 'Tipo', cellTemplate: this.ruleKindCell(), width: '230px' },
    { name: 'Vale para', cellTemplate: this.ruleScopeCell() },
    { name: 'Valor', cellTemplate: this.ruleValueCell(), width: '280px' },
    { name: 'Situação', cellTemplate: this.ruleStatusCell(), width: '170px' },
    { name: '', cellTemplate: this.ruleActionsCell(), width: '250px' },
  ]);

  readonly pageButtons = computed<PageButton[]>(() => [
    {
      id: 'fronteira-rule',
      label: 'Nova regra',
      icon: 'plus',
      variant: 'outlined',
      isShow: this.view() === 'regras' && (this.canWriteRules || this.canManageRules),
      handler: () => this.newRule(),
    },
    {
      id: 'fronteira-import',
      label: 'Importar extrato do e-Fisco',
      icon: 'upload',
      isShow: this.view() === 'conferencia' && !!this.companyId() && this.canImport,
      handler: () => this.openImport(),
    },
  ]);

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
        this.filter.set(null);
        this.load(null);
        if (this.view() === 'regras') {
          this.loadRules();
        }
      }
    });
  }

  // ---------------------------------------------------------------- conferência

  load(periodo: string | null): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.loading.set(true);
    this.fronteiraService.report(companyId, periodo).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectPeriod(periodo: string): void {
    if (periodo) {
      this.filter.set(null);
      this.load(periodo);
    }
  }

  toggleFilter(filter: LineFilter): void {
    this.filter.set(this.filter() === filter ? null : filter);
  }

  resultCount(result: FronteiraResultado): number {
    return (this.report()?.lines ?? []).filter((line) => line.resultado === result).length;
  }

  flagCount(flag: FronteiraFlag): number {
    return (this.report()?.lines ?? []).filter((line) => line.flags.includes(flag)).length;
  }

  resultClass(result: string): string {
    switch (result) {
      case 'CONFERE':
        return 'ok';
      case 'COBROU_A_MAIS':
        return 'danger';
      case 'COBROU_A_MENOS':
      case 'NAO_CALCULOU':
        return 'warn';
      case 'SEM_REGRA':
      case 'PENDENTE':
        return 'info';
      default:
        return '';
    }
  }

  resultLabel(result: string): string {
    return RESULTADO_LABELS[result as FronteiraResultado] ?? result;
  }

  resultHint(result: string): string {
    return RESULTADO_HINTS[result as FronteiraResultado] ?? '';
  }

  flagLabel(flag: string): string {
    return FRONTEIRA_FLAG_LABELS[flag as FronteiraFlag] ?? flag;
  }

  flagHint(flag: string): string {
    return FRONTEIRA_FLAG_HINTS[flag as FronteiraFlag] ?? '';
  }

  /** "5,50%" */
  formatRate(value?: number | null): string {
    return value == null ? '—' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  openNote(documentId?: string | null): void {
    if (documentId) {
      this.router.navigate(['/notas-fiscais', documentId]);
    }
  }

  lineTitle(line: FronteiraLineDTO): string {
    return line.nota?.emitenteNome || formatDocument(line.cnpjEmitente);
  }

  unchargedTitle(row: FronteiraUnchargedDTO): string {
    return row.emitenteNome || formatDocument(row.emitenteCnpj ?? '');
  }

  showCalc(line: FronteiraLineDTO): void {
    if (line.calculo) {
      this.calcView.set({ title: `NF ${line.numeroNota} · ${this.lineTitle(line)}`, calc: line.calculo,
        cnpjFornecedor: line.cnpjEmitente, charged: line.icmsDevido });
    }
  }

  showUnchargedCalc(row: FronteiraUnchargedDTO): void {
    if (row.calculo) {
      this.calcView.set({ title: `NF ${row.numero ?? ''} · ${this.unchargedTitle(row)}`, calc: row.calculo,
        cnpjFornecedor: row.emitenteCnpj });
    }
  }

  // ---------------------------------------------------------------- import

  openImport(): void {
    this.importFile.set(null);
    this.importOpen.set(true);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
  }

  importExtract(): void {
    const companyId = this.companyId();
    const file = this.importFile();
    if (!companyId || !file) {
      return;
    }
    this.importing.set(true);
    this.fronteiraService.importExtract(companyId, file).subscribe({
      next: (report) => {
        this.importing.set(false);
        this.importOpen.set(false);
        this.filter.set(null);
        this.report.set(report);
        const s = report.summary;
        this.toastr.success(
          `Extrato de ${monthLabel(report.periodo)} importado: ${s?.notas ?? 0} nota(s), ${formatCurrency(s?.icmsDevido ?? 0)} de ICMS.`,
        );
      },
      error: () => this.importing.set(false),
    });
  }

  // ---------------------------------------------------------------- tabela de ICMS e fórmulas

  openRules(): void {
    this.view.set('regras');
    this.loadRules();
  }

  loadRules(): void {
    this.fronteiraService.rules(this.companyId()).subscribe((rules) => this.rules.set(rules));
  }

  newRule(kind: FronteiraRuleKind = 'ALIQUOTA_INTERNA'): void {
    this.openRuleForm({ kind, companyId: this.companyId(), global: !this.companyId() });
  }

  editRule(rule: FronteiraRuleDTO): void {
    this.openRuleForm({ ...rule, global: !rule.companyId });
  }

  /** "Usar fórmula própria" no item: a regra já vem com o produto, o fornecedor e a fórmula do cálculo padrão. */
  formulaFromItem(item: FronteiraItemCalcDTO): void {
    const view = this.calcView();
    this.calcView.set(null);
    this.openRuleForm({
      kind: 'FORMULA',
      companyId: this.companyId(),
      global: false,
      codigoProduto: item.codigo,
      cnpjFornecedor: view?.cnpjFornecedor,
      ncm: null,
      descricao: item.descricao ? `Fórmula para ${item.descricao}`.slice(0, 255) : null,
      formula: STANDARD_FORMULAS[item.tratamento] ?? 'partida * interna',
    });
  }

  private openRuleForm(form: Partial<RuleForm> & { kind: FronteiraRuleKind; global: boolean }): void {
    this.formulaMessage.set(null);
    this.ruleForm.set({
      id: form.id ?? null,
      companyId: form.global ? null : form.companyId ?? this.companyId(),
      global: form.global,
      kind: form.kind,
      descricao: form.descricao ?? null,
      ncm: form.ncm ?? null,
      cest: form.cest ?? null,
      codigoProduto: form.codigoProduto ?? null,
      cnpjFornecedor: form.cnpjFornecedor ?? null,
      aliquota: form.aliquota ?? null,
      mva: form.mva ?? null,
      percentual: form.percentual ?? null,
      formula: form.formula ?? null,
      fundamento: form.fundamento ?? null,
      link: form.link ?? null,
      validFrom: form.validFrom ?? null,
      validUntil: form.validUntil ?? null,
    });
    if (!Object.keys(this.variables()).length) {
      this.fronteiraService.checkFormula('partida').subscribe((check) => this.variables.set(check.variables));
    }
  }

  setScope(global: boolean): void {
    const form = this.ruleForm();
    if (form) {
      this.ruleForm.set({ ...form, global, companyId: global ? null : this.companyId() });
    }
  }

  testFormula(): void {
    const formula = this.ruleForm()?.formula ?? '';
    this.fronteiraService.checkFormula(formula).subscribe((check) => {
      this.variables.set(check.variables);
      this.formulaMessage.set(check.ok ? { ok: true, text: 'Fórmula válida.' } : { ok: false, text: check.message ?? 'Fórmula inválida.' });
    });
  }

  insertVariable(name: string): void {
    const form = this.ruleForm();
    if (form) {
      this.ruleForm.set({ ...form, formula: `${form.formula ?? ''}${form.formula ? ' ' : ''}${name}` });
    }
  }

  saveRule(): void {
    const form = this.ruleForm();
    if (!form) {
      return;
    }
    const { id, global, ...input } = form;
    this.savingRule.set(true);
    this.fronteiraService.saveRule({ ...input, companyId: global ? null : input.companyId }, id).subscribe({
      next: () => {
        this.savingRule.set(false);
        this.ruleForm.set(null);
        this.toastr.success(id ? 'Regra alterada — volta a ficar "a conferir".' : 'Regra salva — vale para as próximas notas.');
        this.loadRules();
        this.load(this.report()?.periodo ?? null);
      },
      error: () => this.savingRule.set(false),
    });
  }

  reviewRule(rule: FronteiraRuleDTO): void {
    this.fronteiraService.reviewRule(rule.id, !rule.reviewed).subscribe(() => {
      this.loadRules();
      this.load(this.report()?.periodo ?? null);
    });
  }

  enableRule(rule: FronteiraRuleDTO): void {
    this.fronteiraService.enableRule(rule.id, !rule.enabled).subscribe(() => {
      this.loadRules();
      this.load(this.report()?.periodo ?? null);
    });
  }

  deleteRule(rule: FronteiraRuleDTO): void {
    this.fronteiraService.deleteRule(rule).subscribe(() => {
      this.toastr.success('Regra excluída.');
      this.loadRules();
      this.load(this.report()?.periodo ?? null);
    });
  }

  canEdit(rule: FronteiraRuleDTO): boolean {
    return rule.companyId ? this.canWriteRules : this.canManageRules;
  }

  kindLabel(kind: string): string {
    return RULE_KIND_LABELS[kind as FronteiraRuleKind] ?? kind;
  }

  ruleScope(rule: FronteiraRuleDTO): string {
    const parts: string[] = [];
    if (rule.codigoProduto) parts.push(`produto ${rule.codigoProduto}`);
    if (rule.cnpjFornecedor) parts.push(`fornecedor ${formatDocument(rule.cnpjFornecedor)}`);
    if (rule.cest) parts.push(`CEST ${rule.cest}`);
    if (rule.ncm) parts.push(`NCM ${rule.ncm}`);
    if (!parts.length) parts.push(rule.kind === 'ALIQUOTA_INTERNA' ? 'todos os NCM (modal)' : 'todos os itens');
    return parts.join(' · ');
  }

  objectKeys(record: Record<string, string>): string[] {
    return Object.keys(record);
  }

  updateForm(patch: Partial<RuleForm>): void {
    const form = this.ruleForm();
    if (form) {
      this.ruleForm.set({ ...form, ...patch });
    }
  }
}
