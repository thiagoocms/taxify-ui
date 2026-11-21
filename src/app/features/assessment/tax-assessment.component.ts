import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Page } from '../../shared/components/page/page';
import { formatCurrency } from '../../shared/utils/format';
import { TaxAssessmentService } from '../../core/services/tax-assessment.service';
import {
  AlertLevel,
  AssessmentAlertDTO,
  BUSINESS_ACTIVITY_LABELS,
  MonthRevenueDTO,
  TAX_REGIME_LABELS,
  TaxAssessmentDTO,
  TaxRegime,
} from '../../core/models/tax-assessment.model';

type RegimeFilter = TaxRegime | 'ALL' | 'MISSING';
type AlertFilter = 'ALL' | 'ALERTS';

/** Mês anterior em "AAAA-MM" — normalmente o que está sendo fechado. */
function previousMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { DANGER: 0, WARNING: 1, INFO: 2 };

@Component({
  selector: 'app-tax-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule, Page],
  templateUrl: './tax-assessment.component.html',
  styleUrl: './tax-assessment.component.scss',
})
export class TaxAssessmentComponent implements OnInit {
  private readonly service = inject(TaxAssessmentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly formatCurrency = formatCurrency;
  readonly regimeOptions = Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][];

  readonly month = signal(previousMonth());
  readonly rows = signal<TaxAssessmentDTO[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly regimeFilter = signal<RegimeFilter>('ALL');
  readonly alertFilter = signal<AlertFilter>('ALL');

  readonly selected = signal<TaxAssessmentDTO | null>(null);
  readonly detailLoading = signal(false);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const regime = this.regimeFilter();
    return this.rows().filter((row) => {
      if (term && !row.companyName.toLowerCase().includes(term) && !(digits && row.companyDocument?.includes(digits))) {
        return false;
      }
      if (regime === 'MISSING' ? row.taxRegime && row.taxRegime !== 'OTHER' : regime !== 'ALL' && row.taxRegime !== regime) {
        return false;
      }
      return this.alertFilter() === 'ALL' || this.relevantAlerts(row).length > 0;
    });
  });

  /** Cartões do topo: somam o que está filtrado. */
  readonly summary = computed(() => {
    const rows = this.filtered();
    return {
      companies: rows.length,
      revenue: rows.reduce((sum, row) => sum + row.revenue.net, 0),
      taxes: rows.reduce((sum, row) => sum + row.totalTaxes, 0),
      withoutInvoices: rows.filter((row) => row.invoicesIssued === 0).length,
      danger: rows.filter((row) => row.alerts.some((alert) => alert.level !== 'INFO')).length,
      missingRegime: rows.filter((row) => !row.taxRegime || row.taxRegime === 'OTHER').length,
    };
  });

  readonly historyMax = computed(() => Math.max(1, ...(this.selected()?.history ?? []).map((month) => month.net)));

  ngOnInit(): void {
    const month = this.route.snapshot.queryParamMap.get('mes');
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      this.month.set(month);
    }
    this.load();
    const companyId = this.route.snapshot.queryParamMap.get('empresa');
    if (companyId) {
      this.openCompany(companyId);
    }
  }

  changeMonth(month: string): void {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return;
    }
    this.month.set(month);
    this.syncUrl();
    this.load();
    const current = this.selected();
    if (current) {
      this.openCompany(current.companyId);
    }
  }

  shiftMonth(delta: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    this.changeMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  load(): void {
    this.loading.set(true);
    this.service.firm(this.month()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCompany(companyId: string): void {
    this.detailLoading.set(true);
    this.service.company(companyId, this.month()).subscribe({
      next: (assessment) => {
        this.selected.set(assessment);
        this.detailLoading.set(false);
        this.syncUrl();
      },
      error: () => this.detailLoading.set(false),
    });
  }

  closeDetail(): void {
    this.selected.set(null);
    this.syncUrl();
  }

  openInvoices(row: TaxAssessmentDTO): void {
    this.router.navigate(['/notas-fiscais'], { queryParams: { empresa: row.companyId, mes: row.month } });
  }

  regimeLabel(row: TaxAssessmentDTO): string {
    if (!row.taxRegime) {
      return 'Não informado';
    }
    const activity = row.businessActivity && row.taxRegime !== 'MEI' ? ` · ${BUSINESS_ACTIVITY_LABELS[row.businessActivity]}` : '';
    return TAX_REGIME_LABELS[row.taxRegime] + activity;
  }

  /** Alertas que pedem ação (o aviso de RBT12 proporcional é só informativo). */
  relevantAlerts(row: TaxAssessmentDTO): AssessmentAlertDTO[] {
    return row.alerts.filter((alert) => alert.code !== 'RBT12_PROPORTIONAL');
  }

  worstLevel(row: TaxAssessmentDTO): AlertLevel | null {
    const levels = this.relevantAlerts(row).map((alert) => alert.level);
    return levels.length ? levels.sort((a, b) => LEVEL_ORDER[a] - LEVEL_ORDER[b])[0] : null;
  }

  formatRate(rate?: number | null): string {
    return rate == null ? '—' : `${rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }

  formatMonth(month: string): string {
    const [year, value] = month.split('-').map(Number);
    return new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  }

  formatDocument(value?: string | null): string {
    if (!value) {
      return '';
    }
    if (value.length === 14) {
      return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (value.length === 11) {
      return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return value;
  }

  barHeight(month: MonthRevenueDTO): number {
    return Math.max(2, Math.round((Math.max(0, month.net) / this.historyMax()) * 100));
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mes: this.month(), empresa: this.selected()?.companyId ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
