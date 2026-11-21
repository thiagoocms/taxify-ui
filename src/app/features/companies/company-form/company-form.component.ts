import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { CompanyDTO } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';
import { CompanyProductFiscalRulesComponent } from '../company-product-fiscal-rules/company-product-fiscal-rules.component';
import { CompanyBillingComponent } from '../company-billing/company-billing.component';
import { CompanySubscriptionsComponent } from '../company-subscriptions/company-subscriptions.component';

@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button, CompanySubscriptionsComponent, CompanyBillingComponent, CompanyProductFiscalRulesComponent],
  templateUrl: './company-form.component.html',
  styles: `
    .form-container { max-width: 900px; }
    .section-title { font-weight: 600; margin-bottom: 0.25rem; }
    .section-hint { font-size: 0.85rem; opacity: 0.75; margin-bottom: 0.5rem; }
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

  readonly activeOptions: SelectOption[] = [
    { value: '', label: 'Não informado' },
    { value: 'true', label: 'Ativa' },
    { value: 'false', label: 'Inativa' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    documentType: ['CNPJ', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    // Dados cadastrais opcionais.
    tradeName: [''],
    phone: [''],
    uf: ['', [Validators.maxLength(2)]],
    taxRegime: [''],
    stateRegistration: [''],
    companyGroup: [''],
    active: [''],
    clientSince: [''],
    clientUntil: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['company']) {
      this.form.reset({
        name: this.company?.name ?? '',
        documentType: this.company?.documentType ?? 'CNPJ',
        documentNumber: this.company?.documentNumber ?? '',
        tradeName: this.company?.tradeName ?? '',
        phone: this.company?.phone ?? '',
        uf: this.company?.uf ?? '',
        taxRegime: this.company?.taxRegime ?? '',
        stateRegistration: this.company?.stateRegistration ?? '',
        companyGroup: this.company?.companyGroup ?? '',
        active: this.company?.active == null ? '' : String(this.company.active),
        clientSince: this.company?.clientSince ?? '',
        clientUntil: this.company?.clientUntil ?? '',
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
    const raw = this.form.getRawValue();
    const value: CompanyDTO = {
      name: raw.name,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      tradeName: raw.tradeName || null,
      phone: raw.phone || null,
      uf: raw.uf ? raw.uf.toUpperCase() : null,
      taxRegime: raw.taxRegime || null,
      stateRegistration: raw.stateRegistration || null,
      companyGroup: raw.companyGroup || null,
      active: raw.active === '' ? null : raw.active === 'true',
      clientSince: raw.clientSince || null,
      clientUntil: raw.clientUntil || null,
    };

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
