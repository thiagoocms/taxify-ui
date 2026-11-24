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
  /** O registro da nota no extrato: com ele dá para buscar a memória de cálculo do e-Fisco. */
  registro?: string | null;
}

/** Uma etapa da comparação e-Fisco × Taxify de um item. */
interface CompareRow {
  etapa: string;
  efisco: string;
  taxify: string;
  difere: boolean;
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
import { EfiscoMemoryDTO, EfiscoMemoryItemDTO } from '../../core/models/fronteira.model';
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
  /** A memória do e-Fisco da nota aberta em "Ver cálculo". */
  readonly efiscoMemory = signal<EfiscoMemoryDTO | null>(null);
  readonly efiscoMemoryLoading = signal(false);
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
    // só empresas de Pernambuco: o Fronteira é o ICMS antecipado de PE
    this.companyService.getAll({ page: 0, size: 10 }, { search: term, uf: 'PE' }).pipe(map((page) => page.content));

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

  /** "Ver PDF": o extrato guardado, numa aba nova. */
  openExtractPdf(): void {
    const companyId = this.companyId();
    const periodo = this.report()?.periodo;
    if (!companyId || !periodo) {
      return;
    }
    // a aba abre já no clique (o navegador bloqueia janela aberta depois de uma resposta)
    const tab = window.open('', '_blank');
    this.fronteiraService.extractPdf(companyId, periodo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (tab) {
          tab.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => tab?.close(),
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
        cnpjFornecedor: line.cnpjEmitente, charged: line.icmsDevido, registro: line.registro });
      this.loadEfiscoMemory(line.registro);
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

  // ---------------------------------------------------------------- e-Fisco × Taxify

  private loadEfiscoMemory(registro?: string | null): void {
    this.efiscoMemory.set(null);
    const companyId = this.companyId();
    if (!companyId || !registro) {
      return;
    }
    this.fronteiraService.efiscoMemory(companyId, registro).subscribe({
      next: (memory) => this.efiscoMemory.set(memory ?? null),
      error: () => this.efiscoMemory.set(null),
    });
  }

  /** "Buscar cálculo do e-Fisco": a memória de cálculo da nota, agora, com o certificado do contador. */
  fetchEfiscoMemory(): void {
    const companyId = this.companyId();
    const registro = this.calcView()?.registro;
    if (!companyId || !registro || this.efiscoMemoryLoading()) {
      return;
    }
    this.efiscoMemoryLoading.set(true);
    this.fronteiraService.fetchEfiscoMemory(companyId, registro).subscribe({
      next: (memory) => {
        this.efiscoMemory.set(memory);
        this.efiscoMemoryLoading.set(false);
      },
      error: () => this.efiscoMemoryLoading.set(false),
    });
  }

  /**
   * O e-Fisco não calcula item a item da nota: agrupa os itens pela mercadoria dele ("Cálculo Mercadoria: 258 - ...").
   * Com um grupo só, ele equivale à nota inteira do Taxify (a soma dos itens); com vários, cada grupo aparece com os
   * números do e-Fisco e a nota é comparada pelo total.
   */
  efiscoGroups(): EfiscoMemoryItemDTO[] {
    return this.efiscoMemory()?.itens ?? [];
  }

  /** Os itens do Taxify somados, para comparar com o grupo do e-Fisco que cobre a nota toda. */
  taxifyAsOne(items: FronteiraItemCalcDTO[]): FronteiraItemCalcDTO {
    const first = items[0];
    const sum = (pick: (i: FronteiraItemCalcDTO) => number | null | undefined) =>
      items.reduce((total, i) => total + (pick(i) ?? 0), 0);
    const labels = [...new Set(items.map((i) => i.tratamentoLabel ?? i.tratamento))];
    const variaveis: Record<string, number> = { ...(first?.variaveis ?? {}) };
    variaveis['credito'] = sum((i) => i.variaveis?.['credito']);
    return {
      ...first,
      tratamento: labels.length === 1 ? first.tratamento : 'MISTO',
      tratamentoLabel: labels.join(' + '),
      partida: sum((i) => i.partida),
      valor: sum((i) => (i.tratamento === 'SEM_REGRA' ? 0 : i.valor)),
      variaveis,
    };
  }

  /**
   * As etapas de um grupo do e-Fisco: com um grupo só, lado a lado com a nota do Taxify; com vários, só os números do
   * e-Fisco (o Taxify não sabe a mercadoria do e-Fisco de cada item) - a nota se compara pelo total, no resumo.
   */
  groupRows(group: EfiscoMemoryItemDTO, items: FronteiraItemCalcDTO[]): CompareRow[] {
    const rows = this.compareRows(group, this.taxifyAsOne(items));
    return this.efiscoGroups().length === 1 ? rows : rows.map((row) => ({ ...row, taxify: '—', difere: false }));
  }

  /** O resumo do topo do modal: Taxify, o cobrado no extrato, o cálculo do e-Fisco e a diferença entre os dois cálculos. */
  calcSummary(view: CalcView): {
    taxify: number | null; charged: number | null; efisco: number | null; diff: number | null; bate: boolean | null;
  } {
    const taxify = view.calc.semRegra ? null : view.calc.valor;
    const efisco = this.efiscoMemory()?.icmsTotal ?? null;
    const diff = taxify != null && efisco != null ? Math.round((taxify - efisco) * 100) / 100 : null;
    // centavos de arredondamento não são divergência
    return { taxify, charged: view.charged ?? null, efisco, diff, bate: diff == null ? null : Math.abs(diff) <= 0.05 };
  }

  /** A comparação etapa por etapa - o que difere fica marcado; é por onde o contador decide. */
  compareRows(efisco: EfiscoMemoryItemDTO, item: FronteiraItemCalcDTO): CompareRow[] {
    const v = item.variaveis ?? {};
    const money = (n?: number | null) => (n == null ? '—' : formatCurrency(n));
    const rate = (n?: number | null) => (n == null ? '—' : this.formatRate(n * 100));
    const differs = (a?: number | null, b?: number | null, tolerance = 0.01) =>
      a != null && b != null && Math.abs(a - b) > tolerance;
    const coefTaxify = v['agregacao'] != null ? 1 + v['agregacao'] : null;
    const cargaTaxify = v['percentual'] ? v['percentual'] * 100 : null;
    const efiscoKind = efisco.calculo ?? (efisco.percentualCargaLiquida ? 'Carga líquida' : '—');
    const efiscoUsesCarga = !!efisco.percentualCargaLiquida;
    const taxifyUsesCarga = item.tratamento === 'CARGA_LIQUIDA';
    return [
      { etapa: 'Tipo de cálculo', efisco: efiscoKind, taxify: item.tratamentoLabel ?? item.tratamento, difere: efiscoUsesCarga !== taxifyUsesCarga },
      { etapa: 'Base de partida', efisco: money(efisco.partida), taxify: money(item.partida), difere: differs(efisco.partida, item.partida) },
      { etapa: 'Coeficiente de agregação', efisco: efisco.coefAgregacao == null ? '—' : String(efisco.coefAgregacao).replace('.', ','),
        taxify: coefTaxify == null ? '1' : String(coefTaxify).replace('.', ','), difere: differs(efisco.coefAgregacao, coefTaxify ?? 1, 0.0001) },
      ...(efiscoUsesCarga || taxifyUsesCarga
        ? [{ etapa: 'Carga líquida', efisco: efisco.percentualCargaLiquida == null ? '—' : this.formatRate(efisco.percentualCargaLiquida),
            taxify: cargaTaxify == null ? '—' : this.formatRate(cargaTaxify), difere: differs(efisco.percentualCargaLiquida, cargaTaxify, 0.001) || efiscoUsesCarga !== taxifyUsesCarga }]
        : [{ etapa: 'Alíquota interna', efisco: rate(efisco.aliquotaInterna), taxify: rate(v['interna']), difere: differs(efisco.aliquotaInterna, v['interna'], 0.00001) },
          { etapa: 'Interestadual', efisco: rate(efisco.aliquotaInterestadual), taxify: rate(v['inter']), difere: differs(efisco.aliquotaInterestadual, v['inter'], 0.00001) },
          { etapa: 'Crédito', efisco: money(efisco.credito), taxify: money(v['credito']), difere: differs(efisco.credito, v['credito']) }]),
      { etapa: 'ICMS', efisco: money(efisco.icms), taxify: item.tratamento === 'SEM_REGRA' ? '—' : money(item.valor), difere: differs(efisco.icms, item.valor) },
    ];
  }

  /**
   * "Adotar o cálculo do e-Fisco": a regra que faz o Taxify chegar no valor do e-Fisco, já preenchida - a carga
   * líquida do credenciamento, a agregação do NCM ou uma fórmula do item. O contador confere e salva; vale para as
   * próximas notas.
   */
  adoptEfisco(efisco: EfiscoMemoryItemDTO, item: FronteiraItemCalcDTO): void {
    const view = this.calcView();
    const memory = this.efiscoMemory();
    const fundamento = `Memória de cálculo do e-Fisco · ${view?.title ?? ''} (registro ${memory?.registro ?? ''})`.slice(0, 500);
    this.calcView.set(null);
    if (efisco.percentualCargaLiquida) {
      const credenciamento = memory?.tipos.find((t) => t.tipo === 'CREDENCIAMENTO');
      this.openRuleForm({
        kind: 'SIMPLES_PERCENTUAL', companyId: this.companyId(), global: false,
        percentual: efisco.percentualCargaLiquida,
        descricao: this.report()?.extract?.credenciamentoInterno ?? credenciamento?.descricao ?? null,
        fundamento,
      }, false);
    } else if (efisco.coefAgregacao && efisco.coefAgregacao > 1) {
      this.openRuleForm({
        kind: 'AGREGACAO', companyId: this.companyId(), global: false,
        agregacao: Math.round((efisco.coefAgregacao - 1) * 10000) / 100,
        ncm: item.ncm ? item.ncm.slice(0, 4) : null,
        fornecedorSimples: /simples/i.test(memory?.regras ?? '') ? true : null,
        fundamento,
      }, false);
    } else {
      this.openRuleForm({
        kind: 'FORMULA', companyId: this.companyId(), global: false,
        codigoProduto: item.codigo, cnpjFornecedor: view?.cnpjFornecedor,
        descricao: item.descricao ? `Como o e-Fisco: ${item.descricao}`.slice(0, 255) : null,
        formula: 'partida * interna - credito',
        fundamento,
      }, false);
    }
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
