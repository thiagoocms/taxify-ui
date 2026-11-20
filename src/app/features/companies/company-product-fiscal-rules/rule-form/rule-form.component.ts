import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent } from '../../../../shared/components/input/input';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CompanyProductDTO, ProductFiscalRuleDTO } from '../../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../../core/services/product-fiscal-rule.service';

@Component({
  selector: 'app-rule-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button],
  templateUrl: './rule-form.component.html',
  styles: `
    .product-hint { font-size: 0.85rem; opacity: 0.75; margin: -0.25rem 0 0.75rem; }
  `,
})
export class RuleFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

  @Input() companyId = '';
  @Input() rule: ProductFiscalRuleDTO | null = null;
  @Output() saved = new EventEmitter<ProductFiscalRuleDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  /** Produto escolhido na busca (para mostrar NCM/CFOP vistos nas notas). */
  readonly selectedProduct = signal<CompanyProductDTO | null>(null);

  /**
   * Busca os produtos nas notas da empresa. Os que já têm regra ficam de fora na criação
   * (a regra é única por código); na edição o próprio código continua aparecendo.
   */
  readonly searchProducts = (term: string): Observable<CompanyProductDTO[]> =>
    this.productFiscalRuleService
      .produtos(this.companyId, term)
      .pipe(
        map((products) =>
          products.filter((product) => !product.possuiRegra || product.codigo === this.rule?.codigoProduto),
        ),
      );

  readonly form = this.fb.nonNullable.group({
    codigoProduto: ['', [Validators.required]],
    descricaoProduto: [''],
    ncmCorreto: [''],
    cfopCorreto: ['', [Validators.required]],
    observacoes: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rule']) {
      this.selectedProduct.set(null);
      this.form.reset({
        codigoProduto: this.rule?.codigoProduto ?? '',
        descricaoProduto: this.rule?.descricaoProduto ?? '',
        ncmCorreto: this.rule?.ncmCorreto ?? '',
        cfopCorreto: this.rule?.cfopCorreto ?? '',
        observacoes: this.rule?.observacoes ?? '',
      });
    }
  }

  /** Ao escolher um produto: preenche código e descrição, e sugere o NCM das notas se ainda vazio. */
  onProductSelected(product: CompanyProductDTO): void {
    this.selectedProduct.set(product);
    this.form.patchValue({
      codigoProduto: product.codigo,
      descricaoProduto: product.descricao ?? '',
      ncmCorreto: this.form.controls.ncmCorreto.value || product.ncm || '',
    });
  }

  get isEdit(): boolean {
    return !!this.rule?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();
    // O autocomplete guarda o objeto do produto escolhido; a API espera só o código.
    const codigo: unknown = raw.codigoProduto;
    const value: ProductFiscalRuleDTO = {
      ...raw,
      codigoProduto: typeof codigo === 'string' ? codigo : (codigo as CompanyProductDTO).codigo,
      companyId: this.companyId,
    };

    const request$ = this.isEdit
      ? this.productFiscalRuleService.update(this.rule!.id!, { ...this.rule, ...value })
      : this.productFiscalRuleService.create(value);

    request$.subscribe({
      next: (rule) => {
        this.loading.set(false);
        this.saved.emit(rule);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
