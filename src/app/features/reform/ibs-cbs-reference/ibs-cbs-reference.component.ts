import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faScaleBalanced, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { IBS_CBS_RATE_STATUS_HINTS, IbsCbsRateDTO } from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsRateService } from '../../../core/services/ibs-cbs-rate.service';
import { missingLawNotices, rateReferenceText, rowOf, yearsInPeriod } from './ibs-cbs-reference';

interface ReferenceLine {
  row: IbsCbsRateDTO;
  text: string;
  hint: string;
}

/**
 * Referência de IBS/CBS do período (F-AL-2, AL-RN-06):
 * - aviso para cada ano do período sem alíquota oficial (a conferência não comparou as alíquotas desse ano);
 * - com `showReference`, a linha "Referência de {ano}: CBS x%, IBS UF y%, IBS Mun z% ({status})" com o link do ato.
 * Usada na conferência da empresa (período) e no detalhe da nota (a data de emissão nos dois lados).
 */
@Component({
  selector: 'app-ibs-cbs-reference',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    @for (notice of notices(); track notice.year) {
      <div class="notice" role="note">
        <fa-icon [icon]="warnIcon" aria-hidden="true"></fa-icon>
        <span>{{ notice.text }}</span>
      </div>
    }
    @if (showReference()) {
      @for (line of lines(); track line.row.year) {
        <p class="reference" [title]="line.hint">
          <fa-icon [icon]="lawIcon" aria-hidden="true"></fa-icon>
          <span>{{ line.text }}</span>
          @if (line.row.sourceUrl) {
            <a [href]="line.row.sourceUrl" target="_blank" rel="noopener noreferrer">Ato oficial</a>
          }
          @if (!line.row.generatesFindings) {
            <span class="cell-sub">· só referência, sem achado</span>
          }
        </p>
      }
    }
  `,
  styles: `
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid #dde1ea;
      border-left: 4px solid #b58105;
      border-radius: 8px;
      background: #fffaf0;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 13px;
      color: var(--text-title);
    }
    .reference {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--text-title);
    }
    .reference a { color: var(--color-primary); }
    .cell-sub { font-size: 12px; color: #6c757d; }
  `,
})
export class IbsCbsReferenceComponent {
  private readonly service = inject(IbsCbsRateService);

  /** Início e fim do período ("aaaa-mm-dd"). No detalhe da nota, a data de emissão nos dois. */
  readonly from = input<string | null | undefined>(null);
  readonly to = input<string | null | undefined>(null);
  readonly showReference = input(false);

  readonly warnIcon = faTriangleExclamation;
  readonly lawIcon = faScaleBalanced;

  private readonly response = toSignal(this.service.reference(), { initialValue: null });
  private readonly years = computed(() => yearsInPeriod(this.from(), this.to()));

  readonly notices = computed(() => missingLawNotices(this.response(), this.years()));

  readonly lines = computed<ReferenceLine[]>(() =>
    this.years()
      .map((year) => rowOf(this.response(), year))
      .filter((row): row is IbsCbsRateDTO => !!row)
      .map((row) => ({
        row,
        text: rateReferenceText(row),
        hint: IBS_CBS_RATE_STATUS_HINTS[row.status],
      })),
  );
}
