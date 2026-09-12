import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { PLAN_SERVICE_OPTIONS, PlanDTO, PlanServiceType } from '../../../core/models/plan.model';
import { PlanService } from '../../../core/services/plan.service';

@Component({
  selector: 'app-plan-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button, Toggle],
  templateUrl: './plan-form.component.html',
  styles: `
    .form-container { max-width: 900px; }
    .services-label { font-size: 0.85rem; color: #495057; font-weight: 500; margin-bottom: 8px; display: block; }
  `,
})
export class PlanFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly planService = inject(PlanService);

  @Input() plan: PlanDTO | null = null;
  @Output() saved = new EventEmitter<PlanDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly serviceOptions = PLAN_SERVICE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    services: this.fb.nonNullable.group(
      Object.fromEntries(this.serviceOptions.map((option) => [option.value, this.fb.nonNullable.control(false)])),
    ),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      const activeServices = new Set(this.plan?.services ?? []);
      this.form.reset({
        name: this.plan?.name ?? '',
        description: this.plan?.description ?? '',
        services: Object.fromEntries(
          this.serviceOptions.map((option) => [option.value, activeServices.has(option.value)]),
        ),
      });
    }
  }

  get isEdit(): boolean {
    return !!this.plan?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { services, ...rest } = this.form.getRawValue();
    const value: PlanDTO = {
      ...rest,
      services: Object.entries(services)
        .filter(([, enabled]) => enabled)
        .map(([service]) => service as PlanServiceType),
    };

    const request$ = this.isEdit
      ? this.planService.update(this.plan!.id!, { ...this.plan, ...value })
      : this.planService.create(value);

    request$.subscribe({
      next: (plan) => {
        this.loading.set(false);
        this.saved.emit(plan);
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
