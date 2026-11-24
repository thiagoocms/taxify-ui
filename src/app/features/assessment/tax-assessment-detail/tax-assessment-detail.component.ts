import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Page, PageButton } from '../../../shared/components/page/page';
import { AuthService } from '../../../core/services/auth.service';
import { TaxAssessmentService } from '../../../core/services/tax-assessment.service';
import { BUSINESS_ACTIVITY_LABELS, MonthRevenueDTO, TAX_REGIME_LABELS, TaxAssessmentDTO } from '../../../core/models/tax-assessment.model';
import {
  formatCurrency,
  formatDocument,
  formatRate,
  isClosed,
  isMonth,
  monthLabel,
  previousMonth,
  shiftMonth,
  shortMonthLabel,
} from '../assessment-format';

/**
 * Apuração de uma empresa no mês: faturamento, impostos estimados, histórico de 13 meses e
 * o fechamento (checklist, guia, fechar/reabrir).
 */
import { MonthNavComponent } from '../../../shared/components/month-nav/month-nav.component';
@Component({
  selector: 'app-tax-assessment-detail',
  standalone: true,
  imports: [MonthNavComponent, CommonModule, ReactiveFormsModule, FaIconComponent, Page, Button, InputComponent, Toggle],
  templateUrl: './tax-assessment-detail.component.html',
  styleUrl: './tax-assessment-detail.component.scss',
})
export class TaxAssessmentDetailComponent implements OnInit {
  private readonly service = inject(TaxAssessmentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly fb = inject(FormBuilder);

  readonly formatCurrency = formatCurrency;
  readonly formatRate = formatRate;
  readonly formatDocument = formatDocument;
  readonly monthLabel = monthLabel;
  readonly shortMonthLabel = shortMonthLabel;
  readonly regimeLabels = TAX_REGIME_LABELS;
  readonly activityLabels = BUSINESS_ACTIVITY_LABELS;
  readonly canClose = inject(AuthService).can('TAX_ASSESSMENT_CLOSE');

  readonly companyId = signal('');
  readonly month = signal(previousMonth());
  readonly assessment = signal<TaxAssessmentDTO | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);

  readonly guideForm = this.fb.nonNullable.group({
    guideIssued: [false],
    guideAmount: [''],
    guideDueDate: [''],
    notes: [''],
  });

  readonly closed = computed(() => {
    const a = this.assessment();
    return !!a && isClosed(a);
  });

  readonly historyMax = computed(() => Math.max(1, ...(this.assessment()?.history ?? []).map((m) => m.net)));

  readonly checklist = computed(() => {
    const a = this.assessment();
    if (!a) {
      return [];
    }
    const pending = a.closing.pendingReviews;
    return [
      { ok: a.invoicesIssued > 0, label: `${a.invoicesIssued} ${a.invoicesIssued === 1 ? 'nota de saída' : 'notas de saída'} no mês` },
      { ok: pending === 0, label: pending === 0 ? 'Entradas conferidas' : `${pending} ${pending === 1 ? 'entrada' : 'entradas'} a conferir` },
      { ok: !!a.taxRegime && a.taxRegime !== 'OTHER', label: a.taxRegime && a.taxRegime !== 'OTHER' ? 'Regime cadastrado' : 'Regime não cadastrado' },
      { ok: a.closing.guideIssued, label: a.closing.guideIssued ? 'Guia emitida' : 'Guia não emitida' },
    ];
  });

  readonly pageButtons = computed<PageButton[]>(() => [
    { label: 'Voltar', icon: 'arrow-left', variant: 'text', severity: 'secondary', handler: () => this.back() },
    {
      label: 'Ver notas do mês',
      icon: 'file-invoice',
      variant: 'outlined',
      severity: 'secondary',
      isShow: !!this.assessment(),
      handler: () => this.openInvoices(),
    },
    {
      label: 'Reabrir mês',
      icon: 'lock-open',
      variant: 'outlined',
      isShow: this.canClose && this.closed(),
      isDisabled: this.busy(),
      handler: () => this.reopen(),
    },
    {
      label: 'Fechar mês',
      icon: 'lock',
      isShow: this.canClose && !!this.assessment() && !this.closed(),
      isDisabled: this.busy(),
      handler: () => this.close(),
    },
  ]);

  ngOnInit(): void {
    this.companyId.set(this.route.snapshot.paramMap.get('companyId') ?? '');
    const month = this.route.snapshot.queryParamMap.get('mes');
    if (isMonth(month)) {
      this.month.set(month);
    }
    this.load();
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.router.navigate([], { relativeTo: this.route, queryParams: { mes: this.month() }, replaceUrl: true });
    this.load();
  }

  barHeight(month: MonthRevenueDTO): number {
    return Math.max(2, Math.round((Math.max(0, month.net) / this.historyMax()) * 100));
  }

  saveGuide(): void {
    const raw = this.guideForm.getRawValue();
    this.run(
      this.service.updateGuide(this.companyId(), this.month(), {
        guideIssued: raw.guideIssued,
        guideAmount: raw.guideAmount === '' || raw.guideAmount == null ? null : Number(raw.guideAmount),
        guideDueDate: raw.guideDueDate || null,
        notes: raw.notes || null,
      }),
      'Guia salva.',
    );
  }

  back(): void {
    this.router.navigate(['/apuracao'], { queryParams: { mes: this.month() } });
  }

  private close(): void {
    this.run(this.service.close(this.companyId(), this.month()), 'Mês fechado — os valores ficam congelados.');
  }

  private reopen(): void {
    this.run(this.service.reopen(this.companyId(), this.month()), 'Mês reaberto — os valores voltam a acompanhar as notas.');
  }

  private openInvoices(): void {
    this.router.navigate(['/notas-fiscais'], { queryParams: { empresa: this.companyId(), mes: this.month() } });
  }

  private load(): void {
    this.loading.set(true);
    this.service.company(this.companyId(), this.month()).subscribe({
      next: (assessment) => {
        this.show(assessment);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private run(call: Observable<TaxAssessmentDTO>, message: string): void {
    this.busy.set(true);
    call.subscribe({
      next: (assessment) => {
        this.busy.set(false);
        this.show(assessment);
        this.toastr.success(message);
      },
      error: () => this.busy.set(false),
    });
  }

  private show(assessment: TaxAssessmentDTO): void {
    this.assessment.set(assessment);
    const closing = assessment.closing;
    const amount = closing.guideAmount ?? (assessment.totalTaxes || null);
    this.guideForm.reset({
      guideIssued: closing.guideIssued,
      guideAmount: amount == null ? '' : String(amount),
      guideDueDate: closing.guideDueDate ?? '',
      notes: closing.notes ?? '',
    });
    if (!this.canClose) {
      this.guideForm.disable();
    }
  }
}
