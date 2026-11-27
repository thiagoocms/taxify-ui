import { Component, DestroyRef, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  IBS_CBS_RATE_LIMITS,
  IBS_CBS_RATE_STATUS_HINTS,
  IBS_CBS_RATE_STATUS_LABELS,
  IBS_CBS_RATE_STATUS_ORDER,
  IbsCbsRateDTO,
  IbsCbsRateSaveDTO,
  IbsCbsRateStatus,
} from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsRateService } from '../../../core/services/ibs-cbs-rate.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import {
  httpsValidator,
  IbsCbsRateFormField,
  parseRate,
  RATE_FIELDS,
  rateFormRules,
  rateInputText,
  rateSaveErrorView,
  rateValidator,
} from './ibs-cbs-rate-view';

/**
 * Cadastro e edição das alíquotas de um ano (F-AL-1, AL-RN-03 e AL-RN-04). Sem `rate` = ano novo (o PUT vai sem
 * `version`); com `rate` = edição com a `version` lida. O 409 de conflito sobe para a lista, que recarrega o ano e
 * devolve a linha atual com o aviso (`notice`).
 */
@Component({
  selector: 'app-ibs-cbs-rate-form',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, InputComponent, Button],
  templateUrl: './ibs-cbs-rate-form.component.html',
  styleUrl: './ibs-cbs-rate-form.component.scss',
})
export class IbsCbsRateFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(IbsCbsRateService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() rate: IbsCbsRateDTO | null = null;
  /** Ano sugerido para o cadastro novo (o primeiro que ainda não existe). */
  @Input() suggestedYear: number | null = null;
  /** Aviso no topo (ex.: o 409 que recarregou o ano). */
  @Input() notice: string | null = null;

  @Output() saved = new EventEmitter<IbsCbsRateDTO>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() conflict = new EventEmitter<{ year: number; message: string }>();

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly rules = signal(rateFormRules(null));

  readonly infoIcon = faCircleInfo;
  readonly warnIcon = faTriangleExclamation;
  readonly limits = IBS_CBS_RATE_LIMITS;
  readonly statusHints: Record<string, string> = IBS_CBS_RATE_STATUS_HINTS;
  readonly statusOptions: SelectOption[] = IBS_CBS_RATE_STATUS_ORDER.map((status) => ({
    value: status,
    label: IBS_CBS_RATE_STATUS_LABELS[status],
  }));

  readonly form = this.fb.nonNullable.group({
    year: [
      null as number | null,
      [Validators.required, Validators.min(IBS_CBS_RATE_LIMITS.minYear), Validators.max(IBS_CBS_RATE_LIMITS.maxYear)],
    ],
    status: ['' as IbsCbsRateStatus | '', Validators.required],
    cbsRate: ['', rateValidator],
    ibsStateRate: ['', rateValidator],
    ibsMunicipalRate: ['', rateValidator],
    legalBasis: ['', Validators.maxLength(IBS_CBS_RATE_LIMITS.legalBasisMax)],
    sourceUrl: ['', [Validators.maxLength(IBS_CBS_RATE_LIMITS.sourceUrlMax), httpsValidator]],
  });

  get isEdit(): boolean {
    return !!this.rate;
  }

  ngOnInit(): void {
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.applyRules(status));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rate'] || changes['suggestedYear']) {
      const rate = this.rate;
      this.form.reset({
        year: rate?.year ?? this.suggestedYear,
        status: rate?.status ?? '',
        cbsRate: rateInputText(rate?.cbsRate),
        ibsStateRate: rateInputText(rate?.ibsStateRate),
        ibsMunicipalRate: rateInputText(rate?.ibsMunicipalRate),
        legalBasis: rate?.legalBasis ?? '',
        sourceUrl: rate?.sourceUrl ?? '',
      });
      // O ano é a chave: na edição não muda.
      if (rate) this.form.controls.year.disable({ emitEvent: false });
      else this.form.controls.year.enable({ emitEvent: false });
      this.applyRules(this.form.controls.status.value);
      this.formError.set(null);
    }
  }

  /** Obrigatórios conforme o status (AL-RN-03). */
  private applyRules(status: IbsCbsRateStatus | ''): void {
    const rules = rateFormRules(status);
    this.rules.set(rules);
    for (const field of RATE_FIELDS) {
      const control = this.form.controls[field];
      control.setValidators(rules.ratesRequired ? [Validators.required, rateValidator] : [rateValidator]);
      control.updateValueAndValidity({ emitEvent: false });
    }
    const basis = this.form.controls.legalBasis;
    basis.setValidators(
      rules.basisRequired
        ? [Validators.required, Validators.maxLength(IBS_CBS_RATE_LIMITS.legalBasisMax)]
        : [Validators.maxLength(IBS_CBS_RATE_LIMITS.legalBasisMax)],
    );
    basis.updateValueAndValidity({ emitEvent: false });
    const url = this.form.controls.sourceUrl;
    url.setValidators(
      rules.basisRequired
        ? [Validators.required, Validators.maxLength(IBS_CBS_RATE_LIMITS.sourceUrlMax), httpsValidator]
        : [Validators.maxLength(IBS_CBS_RATE_LIMITS.sourceUrlMax), httpsValidator],
    );
    url.updateValueAndValidity({ emitEvent: false });
  }

  /** Corpo do PUT: textos aparados, vazio vira null, alíquota com vírgula vira número (sem arredondar). */
  private body(): IbsCbsRateSaveDTO {
    const value = this.form.getRawValue();
    return {
      cbsRate: parseRate(value.cbsRate),
      ibsStateRate: parseRate(value.ibsStateRate),
      ibsMunicipalRate: parseRate(value.ibsMunicipalRate),
      status: value.status as IbsCbsRateStatus,
      legalBasis: value.legalBasis.trim() || null,
      sourceUrl: value.sourceUrl.trim() || null,
      version: this.rate?.version ?? null,
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Confira os campos marcados.');
      return;
    }
    // Edição: sempre o ano aberto (a chave não muda); só o cadastro novo usa o ano digitado.
    const year = this.rate ? this.rate.year : Number(this.form.getRawValue().year);
    this.saving.set(true);
    this.formError.set(null);
    this.service.save(year, this.body()).subscribe({
      next: (rate) => {
        this.saving.set(false);
        this.saved.emit(rate);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const view = rateSaveErrorView(error);
        if (view.conflict) {
          this.conflict.emit({ year, message: view.message });
          return;
        }
        this.formError.set(view.message);
        this.markFields(view.fields, view.message);
      },
    });
  }

  private markFields(fields: IbsCbsRateFormField[], message: string): void {
    for (const field of fields) {
      const control = this.form.controls[field];
      control.setErrors({ ...(control.errors ?? {}), server: message });
      control.markAsTouched();
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
