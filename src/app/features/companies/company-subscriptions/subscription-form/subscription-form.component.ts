import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent } from '../../../../shared/components/input/input';
import {
  BILLING_CYCLE_OPTIONS,
  BILLING_PROVIDER_LABELS,
  BillingCycle,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionStatus,
} from '../../../../core/models/billing.model';
import { PlanDTO } from '../../../../core/models/plan.model';
import { SubscriptionDTO } from '../../../../core/models/subscription.model';
import { PlanService } from '../../../../core/services/plan.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { toNumber } from '../../../../shared/utils/to-number';

/**
 * Plano e período são sempre do Taxify. Honorário, status e dia de vencimento: editáveis
 * na assinatura manual; numa assinatura sincronizada (Conta Azul...) vêm do contrato e
 * aparecem só para leitura.
 */
@Component({
  selector: 'app-subscription-form',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, InputComponent, Button],
  templateUrl: './subscription-form.component.html',
})
export class SubscriptionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly planService = inject(PlanService);
  private readonly subscriptionService = inject(SubscriptionService);

  @Input() companyId = '';
  @Input() subscription: SubscriptionDTO | null = null;
  @Output() saved = new EventEmitter<SubscriptionDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly cycleOptions = BILLING_CYCLE_OPTIONS;
  readonly statusOptions = SUBSCRIPTION_STATUS_OPTIONS;
  readonly statusLabels = SUBSCRIPTION_STATUS_LABELS;
  readonly providerLabels = BILLING_PROVIDER_LABELS;

  readonly form = this.fb.group({
    plan: this.fb.control<PlanDTO | null>(null, Validators.required),
    startDate: this.fb.nonNullable.control('', Validators.required),
    endDate: this.fb.nonNullable.control('', Validators.required),
    fee: this.fb.nonNullable.control(''),
    billingCycle: this.fb.nonNullable.control(''),
    billingDay: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('ACTIVE'),
  });

  readonly searchPlans = (term: string): Observable<PlanDTO[]> =>
    this.planService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  get isEdit(): boolean {
    return !!this.subscription?.id;
  }

  /** Contrato vindo de um sistema integrado: honorário/status/vencimento não se editam aqui. */
  get isSynced(): boolean {
    return !!this.subscription?.source && this.subscription.source !== 'MANUAL';
  }

  ngOnInit(): void {
    if (this.subscription) {
      this.form.patchValue({
        plan: { id: this.subscription.planId, name: '' } as PlanDTO,
        startDate: this.subscription.startDate,
        endDate: this.subscription.endDate,
        fee: this.subscription.fee != null ? String(this.subscription.fee) : '',
        billingCycle: this.subscription.billingCycle ?? '',
        billingDay: this.subscription.billingDay != null ? String(this.subscription.billingDay) : '',
        status: this.subscription.status ?? 'ACTIVE',
      });

      if (this.subscription.planId) {
        this.planService.getById(this.subscription.planId).subscribe((plan) => {
          this.form.patchValue({ plan });
        });
      }
    }

    // Numa assinatura nova, escolher o plano sugere o preço de tabela e a periodicidade dele.
    this.form.controls.plan.valueChanges.subscribe((plan) => {
      if (!plan || this.isEdit || this.isSynced) {
        return;
      }
      if (!this.form.controls.fee.value && plan.listPrice != null) {
        this.form.patchValue({ fee: String(plan.listPrice) });
      }
      if (!this.form.controls.billingCycle.value && plan.billingCycle) {
        this.form.patchValue({ billingCycle: plan.billingCycle });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { plan, startDate, endDate, fee, billingCycle, billingDay, status } = this.form.getRawValue();
    const day = toNumber(billingDay);
    const value: SubscriptionDTO = {
      companyId: this.companyId,
      planId: plan!.id!,
      startDate,
      endDate,
      fee: toNumber(fee),
      billingCycle: (billingCycle || null) as BillingCycle | null,
      billingDay: day != null ? Math.min(31, Math.max(1, Math.round(day))) : null,
      status: (status || 'ACTIVE') as SubscriptionStatus,
    };

    const request$ = this.isEdit
      ? this.subscriptionService.update(this.subscription!.id!, { ...this.subscription, ...value })
      : this.subscriptionService.create(value);

    request$.subscribe({
      next: (subscription) => {
        this.loading.set(false);
        this.saved.emit(subscription);
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
