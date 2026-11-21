import { DatePipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { AccountingFirmDTO } from '../../../core/models/accounting-firm.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { ContaAzulConnectionStatusDTO } from '../../../core/models/conta-azul.model';
import { ContaAzulService } from '../../../core/services/conta-azul.service';

@Component({
  selector: 'app-accounting-firm-form',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, InputComponent, Button],
  templateUrl: './accounting-firm-form.component.html',
})
export class AccountingFirmFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly accountingFirmService = inject(AccountingFirmService);
  private readonly contaAzulService = inject(ContaAzulService);

  @Input() firm: AccountingFirmDTO | null = null;
  @Output() saved = new EventEmitter<AccountingFirmDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);

  readonly contaAzul = signal<ContaAzulConnectionStatusDTO | null>(null);
  readonly contaAzulBusy = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    siegApiKey: [''],
    acessoriasApiToken: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['firm']) {
      this.form.reset({
        name: this.firm?.name ?? '',
        siegApiKey: this.firm?.siegApiKey ?? '',
        acessoriasApiToken: this.firm?.acessoriasApiToken ?? '',
      });
      if (this.isEdit) {
        this.loadContaAzulStatus();
      }
    }
  }

  private loadContaAzulStatus(): void {
    this.contaAzulService.status().subscribe({
      next: (status) => this.contaAzul.set(status),
      error: () => this.contaAzul.set(null),
    });
  }

  /** Leva o navegador ao login da Conta Azul; o retorno cai em /integracoes/conta-azul/callback. */
  connectContaAzul(): void {
    this.contaAzulBusy.set(true);
    this.contaAzulService.authorizeUrl().subscribe({
      next: ({ url }) => (window.location.href = url),
      error: () => this.contaAzulBusy.set(false),
    });
  }

  disconnectContaAzul(): void {
    if (!confirm('Desconectar a Conta Azul deste escritório? O Taxify deixa de acessar os dados até conectar de novo.')) {
      return;
    }
    this.contaAzulBusy.set(true);
    this.contaAzulService.disconnect().subscribe({
      next: () => {
        this.contaAzulBusy.set(false);
        this.loadContaAzulStatus();
      },
      error: () => this.contaAzulBusy.set(false),
    });
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
