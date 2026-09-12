import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { ProductFiscalRuleDTO } from '../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../core/services/product-fiscal-rule.service';
import { RuleFormComponent } from './rule-form/rule-form.component';

@Component({
  selector: 'app-company-product-fiscal-rules',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Table, RuleFormComponent],
  templateUrl: './company-product-fiscal-rules.component.html',
  styleUrl: './company-product-fiscal-rules.component.scss',
})
export class CompanyProductFiscalRulesComponent implements OnChanges {
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

  @Input() companyId = '';

  readonly chevronIcon = faChevronDown;
  readonly open = signal(false);

  readonly columns: TableColumn[] = [
    { name: 'Código', property: 'codigoProduto' },
    { name: 'Descrição', property: 'descricaoProduto', cellTextLength: 40 },
    { name: 'NCM correto', property: 'ncmCorreto' },
    { name: 'CFOP correto', property: 'cfopCorreto' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditDialog(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly rules = signal<ProductFiscalRuleDTO[]>([]);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly dialogOpen = signal(false);
  readonly editingRule = signal<ProductFiscalRuleDTO | null>(null);

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

  previousPage(): void {
    if (this.pageIndex() > 0) {
      this.pageIndex.set(this.pageIndex() - 1);
      this.loadRules();
    }
  }

  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.pageIndex.set(this.pageIndex() + 1);
      this.loadRules();
    }
  }

  openCreateDialog(): void {
    this.editingRule.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(rule: ProductFiscalRuleDTO): void {
    this.editingRule.set(rule);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  onSaved(): void {
    this.dialogOpen.set(false);
    this.loadRules();
  }

  remove(rule: ProductFiscalRuleDTO): void {
    if (!confirm(`Deseja realmente excluir a regra do produto "${rule.codigoProduto}"?`)) {
      return;
    }

    this.productFiscalRuleService.delete(rule.id!).subscribe(() => this.loadRules());
  }
}
