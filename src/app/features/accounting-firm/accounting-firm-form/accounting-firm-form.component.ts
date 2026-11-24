import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { AccountingFirmDTO } from '../../../core/models/accounting-firm.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { FirmIntegrationsComponent } from '../firm-integrations/firm-integrations.component';

/**
 * Dados do escritório: o nome aqui; SIEG, Acessórias, Conta Azul e cobrança ficam na seção
 * de integrações (cada uma salva na hora, sem depender do botão "Salvar" do formulário).
 */
@Component({
  selector: 'app-accounting-firm-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button, FirmIntegrationsComponent],
  templateUrl: './accounting-firm-form.component.html',
  styleUrl: './accounting-firm-form.component.scss',
})
export class AccountingFirmFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly accountingFirmService = inject(AccountingFirmService);

  @Input() firm: AccountingFirmDTO | null = null;
  @Output() saved = new EventEmitter<AccountingFirmDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['firm']) {
      this.form.reset({ name: this.firm?.name ?? '' });
    }
  }

  get isEdit(): boolean {
    return !!this.firm?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const value = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.accountingFirmService.update(this.firm!.id!, { ...this.firm, ...value })
      : this.accountingFirmService.create(value);

    request$.subscribe({
      next: (firm) => {
        this.loading.set(false);
        this.saved.emit(firm);
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
