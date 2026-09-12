import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { CompanyDTO } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';
import { CompanyProductFiscalRulesComponent } from '../company-product-fiscal-rules/company-product-fiscal-rules.component';
import { CompanySubscriptionsComponent } from '../company-subscriptions/company-subscriptions.component';

@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button, CompanySubscriptionsComponent, CompanyProductFiscalRulesComponent],
  templateUrl: './company-form.component.html',
  styles: `
    .form-container { max-width: 900px; }
  `,
})
export class CompanyFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);

  @Input() company: CompanyDTO | null = null;
  @Output() saved = new EventEmitter<CompanyDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CNPJ', label: 'CNPJ' },
    { value: 'CPF', label: 'CPF' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    documentType: ['CNPJ', [Validators.required]],
    documentNumber: ['', [Validators.required]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['company']) {
      this.form.reset({
        name: this.company?.name ?? '',
        documentType: this.company?.documentType ?? 'CNPJ',
        documentNumber: this.company?.documentNumber ?? '',
      });
    }
  }

  get isEdit(): boolean {
    return !!this.company?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const value = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.companyService.update(this.company!.id!, { ...this.company, ...value })
      : this.companyService.create(value);

    request$.subscribe({
      next: (company) => {
        this.loading.set(false);
        this.saved.emit(company);
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
