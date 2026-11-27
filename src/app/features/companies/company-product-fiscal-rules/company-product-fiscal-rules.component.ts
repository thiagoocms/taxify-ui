import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Component, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { ProductFiscalRuleDTO, ProductRuleSuggestionDTO } from '../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../core/services/product-fiscal-rule.service';
import { RuleFormComponent } from './rule-form/rule-form.component';
import { formatDocument } from '../../../shared/utils/document-mask';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { LoaderComponent } from '../../../shared/components/loader/loader';

@Component({
  selector: 'app-company-product-fiscal-rules',
  standalone: true,
  imports: [LoaderComponent, CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Pagination, Table, RuleFormComponent],
  templateUrl: './company-product-fiscal-rules.component.html',
  styleUrl: './company-product-fiscal-rules.component.scss',
})
export class CompanyProductFiscalRulesComponent implements OnChanges {
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly auth = inject(AuthService);

  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

  @Input() companyId = '';

  readonly chevronIcon = faChevronDown;
  protected readonly formatDocument = formatDocument;
  readonly open = signal(false);

  readonly columns: TableColumn[] = [
    { name: 'Código', property: 'codigoProduto' },
    { name: 'Fornecedor', property: 'documentoFornecedor', format: (value: string | null) => (value ? formatDocument(value) : 'Todos') },
    { name: 'Descrição', property: 'descricaoProduto', cellTextLength: 40 },
    { name: 'NCM correto', property: 'ncmCorreto' },
    { name: 'CFOP correto', property: 'cfopCorreto' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: this.auth.can('FISCAL_RULES_MANAGE')
      ? [
          { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditDialog(row) },
          { name: 'delete', write: true, icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
        ]
      : [],
  };

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly rules = signal<ProductFiscalRuleDTO[]>([]);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly dialogOpen = signal(false);
  readonly editingRule = signal<ProductFiscalRuleDTO | null>(null);
  /** Sugestão que pré-preencheu a regra aberta no formulário. */
  readonly editingSuggestion = signal<ProductRuleSuggestionDTO | null>(null);

  readonly suggestionsOpen = signal(false);
  readonly suggestionsLoading = signal(false);
  readonly suggestions = signal<ProductRuleSuggestionDTO[]>([]);

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(0);
      this.loadRules();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId'] && this.companyId) {
      this.loadRules();
    }
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  loadRules(): void {
    if (!this.companyId) {
      return;
    }

    this.loading.set(true);
    this.productFiscalRuleService
      .getAll(
        { page: this.pageIndex(), size: this.pageSize },
        { companyId: this.companyId, codigoProduto: this.searchControl.value || undefined },
      )
      .subscribe({
        next: (page) => {
          this.rules.set(page.content);
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadRules();
  }

  openCreateDialog(): void {
    this.editingRule.set(null);
    this.editingSuggestion.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(rule: ProductFiscalRuleDTO): void {
    this.editingRule.set(rule);
    this.editingSuggestion.set(null);
    this.dialogOpen.set(true);
  }

  /** Produtos sem regra, com a classificação mais frequente nas notas de cada um. */
  openSuggestions(): void {
    this.suggestionsOpen.set(true);
    this.suggestionsLoading.set(true);
    this.productFiscalRuleService.sugestoes(this.companyId).subscribe({
      next: (suggestions) => {
        this.suggestions.set(suggestions);
        this.suggestionsLoading.set(false);
      },
      error: () => this.suggestionsLoading.set(false),
    });
  }

  closeSuggestions(): void {
    this.suggestionsOpen.set(false);
  }

  /** Abre o formulário de nova regra já preenchido com a sugestão. */
  createFromSuggestion(suggestion: ProductRuleSuggestionDTO): void {
    const rule: ProductFiscalRuleDTO = {
      companyId: this.companyId,
      codigoProduto: suggestion.codigoProduto,
      documentoFornecedor: suggestion.documentoFornecedor ?? null,
      descricaoProduto: suggestion.descricaoProduto ?? '',
      cfopCorreto: '',
    };
    const fields = rule as unknown as Record<string, string>;
    for (const [field, value] of Object.entries(suggestion.campos)) {
      if (value) {
        fields[field] = value.valor;
      }
    }
    this.suggestionsOpen.set(false);
    this.editingRule.set(rule);
    this.editingSuggestion.set(suggestion);
    this.dialogOpen.set(true);
  }

  /** Menor concordância entre os campos sugeridos - quanto menor, mais a sugestão pede conferência. */
  agreement(suggestion: ProductRuleSuggestionDTO): number {
    const shares = Object.values(suggestion.campos).map((value) => value?.percentual ?? 100);
    return shares.length ? Math.min(...shares) : 100;
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  onSaved(): void {
    this.dialogOpen.set(false);
    this.editingSuggestion.set(null);
    this.loadRules();
  }

  async remove(rule: ProductFiscalRuleDTO): Promise<void> {
    if (!(await this.confirmDialog.ask(`Deseja realmente excluir a regra do produto "${rule.codigoProduto}"?`, { title: 'Excluir regra', confirmLabel: 'Excluir', danger: true }))) {
      return;
    }

    this.productFiscalRuleService.delete(rule.id!).subscribe(() => this.loadRules());
  }
}
