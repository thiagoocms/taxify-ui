import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { IBS_CBS_RATE_ACTION_LABELS, IbsCbsRateChangeDTO } from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsRateService } from '../../../core/services/ibs-cbs-rate.service';
import { Button } from '../../../shared/components/button/button';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { SidePanel } from '../../../shared/components/side-panel/side-panel';
import { formatLocalDateTime } from '../../../shared/utils/format';
import { changeLines, rateLoadErrorText } from './ibs-cbs-rate-view';

interface HistoryItem {
  event: IbsCbsRateChangeDTO;
  lines: string[];
}

/** Histórico de um ano (H-AL-5): quem mudou, quando (Recife) e o antes e depois de cada campo. */
@Component({
  selector: 'app-ibs-cbs-rate-history',
  standalone: true,
  imports: [SidePanel, Button, LoaderComponent],
  template: `
    <app-side-panel eyebrow="Alíquotas IBS/CBS: histórico" [title]="'Ano ' + year" [busy]="loading()" (closed)="closed.emit()">
      @if (error()) {
        <div class="notice" role="alert">
          <p class="mb-2">{{ error() }}</p>
          <app-button label="Tentar de novo" variant="outlined" (onClick)="load()"></app-button>
        </div>
      } @else if (loading()) {
        <app-loader variant="inline" message="Carregando o histórico..."></app-loader>
      } @else if (!items().length) {
        <p class="muted">Nenhuma alteração registrada para este ano.</p>
      } @else {
        <ol class="history">
          @for (item of items(); track $index) {
            <li>
              <div class="head">
                <strong>{{ actionLabels[item.event.action] ?? item.event.action }}</strong>
                <span class="muted">{{ formatDateTime(item.event.changedAt) }} · {{ item.event.changedBy }}</span>
              </div>
              <ul>
                @for (line of item.lines; track line) {
                  <li>{{ line }}</li>
                }
              </ul>
              @if (item.event.legalBasisAfter) {
                <p class="basis">Fundamento: {{ item.event.legalBasisAfter }}</p>
              }
              @if (item.event.sourceUrlAfter) {
                <a [href]="item.event.sourceUrlAfter" target="_blank" rel="noopener noreferrer">{{ item.event.sourceUrlAfter }}</a>
              }
            </li>
          }
        </ol>
      }
    </app-side-panel>
  `,
  styles: `
    .muted { color: #6c757d; font-size: 12px; }
    .notice { margin-top: 12px; }
    .history { list-style: none; margin: 8px 0 0; padding: 0; }
    .history > li { padding: 10px 0; border-bottom: 1px solid #eef1f6; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
    ul { margin: 6px 0 0; padding-left: 18px; }
    .basis { margin: 6px 0 2px; }
    a { color: var(--color-primary); overflow-wrap: anywhere; }
  `,
})
export class IbsCbsRateHistoryComponent implements OnInit {
  private readonly service = inject(IbsCbsRateService);

  @Input({ required: true }) year!: number;
  @Output() closed = new EventEmitter<void>();

  readonly items = signal<HistoryItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionLabels: Partial<Record<string, string>> = IBS_CBS_RATE_ACTION_LABELS;
  readonly formatDateTime = formatLocalDateTime;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.history(this.year).subscribe({
      next: (events) => {
        this.items.set(events.map((event) => ({ event, lines: changeLines(event) })));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(rateLoadErrorText(error, 'history'));
      },
    });
  }
}
