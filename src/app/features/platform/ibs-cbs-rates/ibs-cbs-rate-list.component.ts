import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faClockRotateLeft, faScaleBalanced, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import {
  IBS_CBS_RATE_STATUS_HINTS,
  IBS_CBS_RATE_STATUS_LABELS,
  IBS_CBS_RATE_STATUS_ORDER,
  IBS_CBS_RATE_STATUS_TONES,
  IbsCbsRateDTO,
  IbsCbsRateWarningDTO,
} from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsRateService } from '../../../core/services/ibs-cbs-rate.service';
import { Button } from '../../../shared/components/button/button';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { formatLocalDateTime, formatPercent } from '../../../shared/utils/format';
import { IbsCbsRateFormComponent } from './ibs-cbs-rate-form.component';
import { IbsCbsRateHistoryComponent } from './ibs-cbs-rate-history.component';
import { nextFreeYear, rateLoadErrorText } from './ibs-cbs-rate-view';

type ViewMode = 'list' | 'form';

/**
 * Console da plataforma: alíquotas de referência de IBS/CBS por ano (F-AL-1). Lista com o status de cada ano e os
 * avisos `NO_LAW` do ano corrente e do seguinte, formulário de cadastro e edição (no padrão do cadastro de planos) e
 * histórico por ano. A tabela tem no máximo uma linha por ano (2026 a 2040), sem paginação; não há exclusão.
 */
@Component({
  selector: 'app-ibs-cbs-rate-list',
  standalone: true,
  imports: [NgTemplateOutlet, FaIconComponent, Button, LoaderComponent, Page, Table, IbsCbsRateFormComponent, IbsCbsRateHistoryComponent],
  templateUrl: './ibs-cbs-rate-list.component.html',
  styleUrl: './ibs-cbs-rate-list.component.scss',
})
export class IbsCbsRateListComponent implements OnInit {
  private readonly service = inject(IbsCbsRateService);
  private readonly toastr = inject(ToastrService);

  readonly rows = signal<IbsCbsRateDTO[]>([]);
  readonly warnings = signal<IbsCbsRateWarningDTO[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly viewMode = signal<ViewMode>('list');
  readonly editing = signal<IbsCbsRateDTO | null>(null);
  readonly formNotice = signal<string | null>(null);
  readonly historyYear = signal<number | null>(null);

  readonly suggestedYear = computed(() => nextFreeYear(this.rows()));

  readonly statusOrder = IBS_CBS_RATE_STATUS_ORDER;
  readonly statusLabels: Partial<Record<string, string>> = IBS_CBS_RATE_STATUS_LABELS;
  readonly statusTones: Record<string, string> = IBS_CBS_RATE_STATUS_TONES;
  readonly statusHints: Record<string, string> = IBS_CBS_RATE_STATUS_HINTS;
  readonly warnIcon = faTriangleExclamation;
  readonly emptyIcon = faScaleBalanced;
  readonly formatPercent = formatPercent;
  readonly formatDateTime = formatLocalDateTime;

  readonly pageTitle = computed(() => {
    if (this.viewMode() === 'list') return 'Plataforma: alíquotas de IBS/CBS';
    return this.editing() ? `Editar alíquotas de ${this.editing()!.year}` : 'Novo ano';
  });

  readonly pageDescription = computed(() =>
    this.viewMode() === 'list'
      ? 'Referência de cada ano para todos os escritórios. Só o status Lei faz a conferência apontar erro nas notas.'
      : 'Status, alíquotas e o ato oficial. Cada gravação fica no histórico do ano.',
  );

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      const free = this.suggestedYear();
      return [
        {
          label: 'Novo ano',
          icon: 'plus',
          isShow: this.loaded(),
          isDisabled: free == null,
          tooltip: free == null ? 'Todos os anos de 2026 a 2040 já estão cadastrados.' : '',
          handler: () => this.openCreateForm(),
        },
      ];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  private readonly yearCell = viewChild.required<TemplateRef<unknown>>('yearCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');
  private readonly ratesCell = viewChild.required<TemplateRef<unknown>>('ratesCell');
  private readonly basisCell = viewChild.required<TemplateRef<unknown>>('basisCell');
  private readonly changedCell = viewChild.required<TemplateRef<unknown>>('changedCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Ano', cellTemplate: this.yearCell() },
    { name: 'Status', cellTemplate: this.statusCell() },
    { name: 'CBS · IBS UF · IBS Mun', cellTemplate: this.ratesCell() },
    { name: 'Fundamento', cellTemplate: this.basisCell() },
    { name: 'Alterado', cellTemplate: this.changedCell() },
    { name: 'Ações', cellTemplate: this.actionsCell(), headerClass: 'justify-content-end' },
  ]);

  readonly tableConfig: TableConfig = { headerVisible: true };

  constructor() {
    inject(FaIconLibrary).addIcons(faClockRotateLeft);
  }

  ngOnInit(): void {
    this.load();
  }

  load(after?: (rows: IbsCbsRateDTO[]) => void): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getAll().subscribe({
      next: (response) => {
        this.rows.set(response.years ?? []);
        this.warnings.set(response.warnings ?? []);
        this.loading.set(false);
        this.loaded.set(true);
        after?.(response.years ?? []);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(rateLoadErrorText(error, 'list'));
      },
    });
  }

  openCreateForm(): void {
    this.editing.set(null);
    this.formNotice.set(null);
    this.viewMode.set('form');
  }

  openEditForm(row: IbsCbsRateDTO): void {
    this.editing.set(row);
    this.formNotice.set(null);
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
    this.formNotice.set(null);
  }

  onSaved(rate: IbsCbsRateDTO): void {
    this.toastr.success(`Alíquotas de ${rate.year} gravadas (${this.statusLabels[rate.status] ?? rate.status}).`, 'Alíquotas IBS/CBS');
    this.closeForm();
    this.load();
  }

  /** 409 (AL-RN-04): recarrega e reabre o ano com a versão atual, avisando que os dados mudaram. */
  onConflict(event: { year: number; message: string }): void {
    this.load((rows) => {
      const current = rows.find((row) => row.year === event.year) ?? null;
      this.editing.set(current);
      this.formNotice.set(
        `${event.message} O formulário abaixo mostra o que está gravado agora; confira e salve de novo se ainda precisar mudar.`,
      );
    });
  }

  openHistory(row: IbsCbsRateDTO): void {
    this.historyYear.set(row.year);
  }

  closeHistory(): void {
    this.historyYear.set(null);
  }
}
