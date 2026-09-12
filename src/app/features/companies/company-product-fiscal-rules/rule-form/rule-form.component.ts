import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent } from '../../../../shared/components/input/input';
import { ProductFiscalRuleDTO } from '../../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../../core/services/product-fiscal-rule.service';

@Component({
  selector: 'app-rule-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button],
  templateUrl: './rule-form.component.html',
})
export class RuleFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

  @Input() companyId = '';
  @Input() rule: ProductFiscalRuleDTO | null = null;
  @Output() saved = new EventEmitter<ProductFiscalRuleDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    codigoProduto: ['', [Validators.required]],
    descricaoProduto: [''],
    ncmCorreto: [''],
    cfopCorreto: ['', [Validators.required]],
    observacoes: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rule']) {
      this.form.reset({
        codigoProduto: this.rule?.codigoProduto ?? '',
        descricaoProduto: this.rule?.descricaoProduto ?? '',
        ncmCorreto: this.rule?.ncmCorreto ?? '',
        cfopCorreto: this.rule?.cfopCorreto ?? '',
        observacoes: this.rule?.observacoes ?? '',
      });
    }
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
    const value: ProductFiscalRuleDTO = {
      ...this.form.getRawValue(),
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
