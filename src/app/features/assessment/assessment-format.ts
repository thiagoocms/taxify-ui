import {
  AlertLevel,
  AssessmentAlertDTO,
  BUSINESS_ACTIVITY_LABELS,
  TAX_REGIME_LABELS,
  TaxAssessmentDTO,
} from '../../core/models/tax-assessment.model';

export { formatCurrency } from '../../shared/utils/format';

/** Mês anterior em "AAAA-MM" — normalmente o que está sendo fechado. */
export function previousMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return toMonth(date);
}

export function toMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  return toMonth(new Date(year, value - 1 + delta, 1));
}

export function isMonth(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

/** "outubro de 2026" */
export function monthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** "out/26" */
export function shortMonthLabel(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

export function regimeLabel(row: Pick<TaxAssessmentDTO, 'taxRegime' | 'businessActivity'>): string {
  if (!row.taxRegime) {
    return 'Regime não informado';
  }
  const activity = row.businessActivity && row.taxRegime !== 'MEI' ? ` · ${BUSINESS_ACTIVITY_LABELS[row.businessActivity]}` : '';
  return TAX_REGIME_LABELS[row.taxRegime] + activity;
}

export function formatRate(rate?: number | null): string {
  return rate == null ? '—' : `${rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export { formatDocument } from '../../shared/utils/document-mask';

/** Alertas que pedem ação (RBT12 proporcional é só informativo). */
export function actionableAlerts(row: TaxAssessmentDTO): AssessmentAlertDTO[] {
  return row.alerts.filter((alert) => alert.code !== 'RBT12_PROPORTIONAL');
}

const LEVEL_ORDER: Record<AlertLevel, number> = { DANGER: 0, WARNING: 1, INFO: 2 };

export function worstLevel(row: TaxAssessmentDTO): AlertLevel | null {
  const levels = actionableAlerts(row).map((alert) => alert.level);
  return levels.length ? [...levels].sort((a, b) => LEVEL_ORDER[a] - LEVEL_ORDER[b])[0] : null;
}

export function isClosed(row: TaxAssessmentDTO): boolean {
  return row.closing?.status === 'CLOSED';
}
