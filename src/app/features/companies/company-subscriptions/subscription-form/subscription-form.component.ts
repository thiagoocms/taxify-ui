import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent } from '../../../../shared/components/input/input';
import { PlanDTO } from '../../../../core/models/plan.model';
import { SubscriptionDTO } from '../../../../core/models/subscription.model';
import { PlanService } from '../../../../core/services/plan.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';

@Component({
  selector: 'app-subscription-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button],
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

  readonly form = this.fb.group({
    plan: this.fb.control<PlanDTO | null>(null, Validators.required),
    startDate: this.fb.nonNullable.control('', Validators.required),
    endDate: this.fb.nonNullable.control('', Validators.required),
  });

  readonly searchPlans = (term: string): Observable<PlanDTO[]> =>
    this.planService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  get isEdit(): boolean {
    return !!this.subscription?.id;
  }

  ngOnInit(): void {
    if (this.subscription) {
      this.form.patchValue({
        plan: { id: this.subscription.planId, name: '' } as PlanDTO,
        startDate: this.subscription.startDate,
        endDate: this.subscription.endDate,
      });

      if (this.subscription.planId) {
        this.planService.getById(this.subscription.planId).subscribe((plan) => {
          this.form.patchValue({ plan });
        });
      }
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { plan, startDate, endDate } = this.form.getRawValue();
    const value: SubscriptionDTO = {
      companyId: this.companyId,
      planId: plan!.id!,
      startDate,
      endDate,
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
