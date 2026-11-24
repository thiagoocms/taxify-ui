import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../core/models/company.model';
import {
  APLICA_EM_LABELS,
  FormulaCheckDTO,
  FronteiraAplicaEm,
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
import { CurrentCompanyService } from '../../core/services/current-company.service';
import { FronteiraService } from '../../core/services/fronteira.service';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Modal } from '../../shared/components/modal/modal';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { formatCurrency } from '../../shared/utils/format';
import { FormulaEditorComponent, formulaIssues } from './formula-editor/formula-editor.component';
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
  ST: 'partida * (1 + mva_ajustada) * interna - credito',
  CARGA_LIQUIDA: 'partida * percentual',
  SEM_ENCERRAMENTO: 'partida * interna - credito',
  USO_CONSUMO: 'partida * interna - credito',
  MERCADORIA: 'partida * (1 + agregacao) * interna - credito',
};

/**
 * Fronteira PE: o extrato do ICMS antecipado que o e-Fisco cobra (importado à mão, em PDF), nota a nota
 * ao lado do cálculo do Taxify — pela tabela de ICMS (alíquotas, ST, percentual do Simples) ou pela
 * fórmula própria que a contadora registrar, que passa a valer para as próximas notas.
 */
import { MonthNavComponent } from '../../shared/components/month-nav/month-nav.component';
import { EfiscoService, FirmCertificateDTO } from '../../core/services/efisco.service';
@Component({
  selector: 'app-fronteira',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Table, FormulaEditorComponent, MonthNavComponent],
  templateUrl: './fronteira.component.html',
  styleUrl: './fronteira.component.scss',
})
export class FronteiraComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly currentCompany = inject(CurrentCompanyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fronteiraService = inject(FronteiraService);
  private readonly efisco = inject(EfiscoService);
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
  /** O último "Testar fórmula": resultado e os valores usados. */
  readonly formulaCheck = signal<FormulaCheckDTO | null>(null);
  /** Quando a regra vem de um item ("Usar fórmula própria"): os valores dele, para testar a fórmula na nota de verdade. */
  readonly formulaContext = signal<{ label: string; values: Record<string, number> } | null>(null);
  readonly calcView = signal<CalcView | null>(null);
  /** O certificado do contador (Integrações): sem ele, nada de "Sincronizar com e-Fisco". */
  readonly efiscoCertificate = signal<FirmCertificateDTO | null>(null);
  readonly syncing = signal(false);
  /** Uma fórmula com nome que não existe (ou parêntese aberto, ou que o servidor recusou) não é salva. */
  readonly formulaOk = computed(() => {
    const form = this.ruleForm();
    if (form?.kind !== 'FORMULA') {
      return true;
    }
    const names = Object.keys(this.variables());
    return !formulaIssues(form.formula, names).length && this.formulaMessage()?.ok !== false;
  });

  readonly flagLabels = FRONTEIRA_FLAG_LABELS;
  readonly resultLabels = RESULTADO_LABELS;
  readonly resultHints = RESULTADO_HINTS;
  readonly kindLabels = RULE_KIND_LABELS;
  readonly kinds: FronteiraRuleKind[] = ['ALIQUOTA_INTERNA', 'AGREGACAO', 'ST_MVA', 'SIMPLES_PERCENTUAL', 'FORMULA'];
  readonly aplicaEmOptions: FronteiraAplicaEm[] = ['SEM_ENCERRAMENTO', 'MERCADORIA', 'ST', 'CARGA_LIQUIDA', 'USO_CONSUMO'];
  readonly aplicaEmLabels = APLICA_EM_LABELS;
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
    { name: '', cellTemplate: this.actionsCell(), width: '56px' },
  ]);

  readonly unchargedColumns = computed<TableColumn[]>(() => [
    { name: 'Nota', cellTemplate: this.unchargedNoteCell() },
    { name: 'Valor', cellTemplate: this.unchargedValueCell(), headerClass: 'justify-content-end', width: '140px' },
    { name: 'Prévia do ICMS', cellTemplate: this.unchargedCalcCell(), headerClass: 'justify-content-end', width: '170px' },
    { name: '', cellTemplate: this.unchargedActionsCell(), width: '56px' },
  ]);

  readonly ruleColumns = computed<TableColumn[]>(() => [
    { name: 'Tipo', cellTemplate: this.ruleKindCell(), width: '230px' },
    { name: 'Vale para', cellTemplate: this.ruleScopeCell() },
    { name: 'Valor', cellTemplate: this.ruleValueCell(), width: '280px' },
    { name: 'Situação', cellTemplate: this.ruleStatusCell(), width: '170px' },
    { name: '', cellTemplate: this.ruleActionsCell(), width: '170px' },
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
      id: 'fronteira-efisco-sync',
      label: this.syncing() ? 'Buscando no e-Fisco...' : 'Sincronizar com e-Fisco',
      icon: 'cloud-arrow-down',
      variant: 'outlined',
      isDisabled: this.syncing(),
      isShow: this.view() === 'conferencia' && !!this.companyId() && this.canImport && !!this.efiscoCertificate()?.present,
      handler: () => this.syncWithEfisco(),
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
    this.efisco.certificate().subscribe({ next: (c) => this.efiscoCertificate.set(c), error: () => this.efiscoCertificate.set(null) });
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
    // Só traz a empresa em uso se ela for de PE (ou sem UF no cadastro).
    this.currentCompany.bind(this.form.controls.company, this.destroyRef, (company) => !company.uf || company.uf.toUpperCase() === "PE");
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

  /** O botão "Sincronizar com e-Fisco": a empresa e o mês da tela, agora - a rotina agendada faz o mesmo sozinha. */
  syncWithEfisco(): void {
    const companyId = this.companyId();
    if (!companyId || this.syncing()) {
      return;
    }
    const periodo = this.report()?.periodo ?? null;
    this.syncing.set(true);
    this.fronteiraService.syncWithEfisco(companyId, periodo).subscribe({
      next: ({ sync, report }) => {
        this.syncing.set(false);
        this.report.set(report);
        this.efisco.certificate().subscribe((c) => this.efiscoCertificate.set(c));
        const company = sync.companies[0];
        if (company?.status === 'IMPORTADO') {
          this.toastr.success(`${company.detail} (${monthLabel(company.period)})`, 'e-Fisco');
        } else if (company?.status === 'SEM_MUDANCA') {
          this.toastr.info('O extrato no e-Fisco é o mesmo já importado - nada mudou.', 'e-Fisco');
        } else if (company?.status === 'SEM_EXTRATO') {
          this.toastr.info(company.detail ?? 'O e-Fisco não tem extrato para o período.', 'e-Fisco');
        } else if (sync.status === 'OK') {
          this.toastr.success(sync.detail ?? 'Sincronizado.', 'e-Fisco');
        } else {
          this.toastr.warning(company?.detail ?? sync.detail ?? 'Não foi possível sincronizar.', 'e-Fisco');
        }
      },
      error: () => this.syncing.set(false),
    });
  }

  /** "OK" → "tudo importado"... - a linha da última sincronização. */
  efiscoStatusLabel(status?: string | null): string {
    switch (status) {
      case 'OK': return 'tudo certo';
      case 'PARCIAL': return 'parte das empresas com problema';
      case 'BLOQUEADO': return 'o e-Fisco recusou o acesso';
      case 'ERRO': return 'falhou';
      default: return status ?? '';
    }
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
    this.openRuleForm({ kind, companyId: this.companyId(), global: !this.companyId() }, false);
  }

  editRule(rule: FronteiraRuleDTO): void {
    this.openRuleForm({ ...rule, global: !rule.companyId }, false);
  }

  /** "Usar fórmula própria" no item: a regra já vem com o produto, o fornecedor e a fórmula do cálculo padrão. */
  formulaFromItem(item: FronteiraItemCalcDTO): void {
    const view = this.calcView();
    this.calcView.set(null);
    this.formulaContext.set(item.variaveis && Object.keys(item.variaveis).length
      ? { label: `${view?.title ?? 'nota'} · item ${item.numeroItem}`, values: item.variaveis }
      : null);
    this.openRuleForm({
      kind: 'FORMULA',
      companyId: this.companyId(),
      global: false,
      codigoProduto: item.codigo,
      cnpjFornecedor: view?.cnpjFornecedor,
      ncm: null,
      descricao: item.descricao ? `Fórmula para ${item.descricao}`.slice(0, 255) : null,
      formula: STANDARD_FORMULAS[item.tratamento] ?? 'partida * interna',
      aplicaEm: (this.aplicaEmOptions as string[]).includes(item.tratamento) ? (item.tratamento as FronteiraAplicaEm) : null,
    });
  }

  private openRuleForm(form: Partial<RuleForm> & { kind: FronteiraRuleKind; global: boolean }, keepContext = true): void {
    this.formulaMessage.set(null);
    this.formulaCheck.set(null);
    if (!keepContext) {
      this.formulaContext.set(null);
    }
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
      agregacao: form.agregacao ?? null,
      regiaoOrigem: form.regiaoOrigem ?? null,
      fornecedorSimples: form.fornecedorSimples ?? null,
      formula: form.formula ?? null,
      aplicaEm: form.aplicaEm ?? null,
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
    this.fronteiraService.checkFormula(formula, this.formulaContext()?.values).subscribe((check) => {
      this.variables.set(check.variables);
      this.formulaCheck.set(check);
      this.formulaMessage.set(check.ok
        ? { ok: true, text: `Fórmula válida · resultado ${formatCurrency(check.resultado ?? 0)}` }
        : { ok: false, text: check.message ?? 'Fórmula inválida.' });
    });
  }

  /** Fórmula nova: o teste anterior não vale mais - o editor pede outro assim que parar de digitar. */
  onFormulaChange(formula: string | null | undefined): void {
    this.updateForm({ formula: formula ?? null });
    this.formulaMessage.set(null);
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
        this.formulaContext.set(null);
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

  /** "20% · Sul/Sudeste · fornecedor do Simples" */
  agregacaoScope(rule: FronteiraRuleDTO): string {
    const parts = [rule.regiaoOrigem === 'SUL_SUDESTE' ? 'origem Sul/Sudeste' : rule.regiaoOrigem === 'DEMAIS' ? 'origem N/NE/CO' : 'qualquer origem'];
    parts.push(rule.fornecedorSimples === true ? 'fornecedor do Simples' : rule.fornecedorSimples === false ? 'fornecedor fora do Simples' : 'qualquer fornecedor');
    return parts.join(' · ');
  }

  /** O select manda texto: '' = qualquer, 'true' / 'false'. */
  setFornecedorSimples(value: string): void {
    this.updateForm({ fornecedorSimples: value === '' ? null : value === 'true' });
  }

  aplicaEmLabel(value?: string | null): string {
    return value ? APLICA_EM_LABELS[value as FronteiraAplicaEm] ?? value : 'qualquer cálculo';
  }


  /** Uma linha do que cada tipo faz - nos cartões do modal. */
  readonly kindHints: Record<FronteiraRuleKind, string> = {
    ALIQUOTA_INTERNA: 'A alíquota de PE: a modal ou a de um NCM.',
    AGREGACAO: 'Partida × (1 + agregação), por NCM e origem.',
    ST_MVA: 'Produto com ST: a MVA original do NCM/CEST.',
    SIMPLES_PERCENTUAL: '% fixo sobre a partida: credenciamento ou Simples.',
    FORMULA: 'Sua própria conta, no lugar de um cálculo padrão.',
  };

  hasFilters(f: RuleForm): boolean {
    return !!(f.ncm || f.cest || f.codigoProduto || f.cnpjFornecedor || f.validFrom || f.validUntil);
  }

  /** "NCM 8504 · fornecedor 11.111..." ou "todas as notas, sem vigência". */
  filterSummary(f: RuleForm): string {
    const parts: string[] = [];
    if (f.ncm) parts.push(`NCM ${f.ncm}`);
    if (f.cest) parts.push(`CEST ${f.cest}`);
    if (f.codigoProduto) parts.push(`produto ${f.codigoProduto}`);
    if (f.cnpjFornecedor) parts.push(`fornecedor ${f.cnpjFornecedor}`);
    if (f.validFrom || f.validUntil) parts.push('com vigência');
    return parts.length ? parts.join(' · ') : 'todas as notas, sem vigência';
  }

  /** Carga líquida: o credenciamento e a taxa que o extrato aberto aplica. */
  fillFromExtract(): void {
    const report = this.report();
    this.updateForm({
      descricao: report?.extract?.credenciamentoInterno ?? null,
      percentual: report?.summary?.taxaPredominante ?? this.ruleForm()?.percentual ?? null,
    });
  }

  updateForm(patch: Partial<RuleForm>): void {
    const form = this.ruleForm();
    if (form) {
      this.ruleForm.set({ ...form, ...patch });
    }
  }
}
