import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowsRotate,
  faBan,
  faCircleCheck,
  faCirclePause,
  faCirclePlay,
  faCircleStop,
  faCircleXmark,
  faClock,
  faEye,
  faHourglassHalf,
  faLock,
  faPowerOff,
  faSatelliteDish,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';
import { httpStatusOf } from '../../core/models/api-error.model';
import {
  CAPTURE_CHANNEL_LABELS,
  CAPTURE_DOC_TYPE_LABELS,
  CAPTURE_SORT_LABELS,
  CAPTURE_STATUS_HINTS,
  CAPTURE_STATUS_LABELS,
  CAPTURE_STATUS_ORDER,
  CAPTURE_STATUS_TONES,
  CaptureChannel,
  CaptureDocType,
  CapturePanelDetailDTO,
  CapturePanelFilter,
  CapturePanelQueueDTO,
  CapturePanelRowDTO,
  CapturePanelSummaryDTO,
  CaptureScope,
  CaptureSideDTO,
  CaptureSort,
  CaptureStatus,
  displayPosition,
} from '../../core/models/capture-panel.model';
import { AuthService } from '../../core/services/auth.service';
import { CapturePanelService } from '../../core/services/capture-panel.service';
import { FirmAccessService } from '../../core/services/firm-access.service';
import { PlatformFirmService } from '../../core/services/platform-firm.service';
import { Button } from '../../shared/components/button/button';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.service';
import { InputComponent, SelectOption } from '../../shared/components/input/input';
import { LoaderComponent } from '../../shared/components/loader/loader';
import { Page } from '../../shared/components/page/page';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { Toggle } from '../../shared/components/toggle/toggle';
import { formatLocalDateTime } from '../../shared/utils/format';
import { CaptureDetailPanelComponent } from './capture-detail-panel.component';
import {
  failureText,
  loadErrorText,
  observedLapText,
  queueHealthView,
  shortDateTime,
  shortMonth,
  syncNowErrorView,
  THEORETICAL_LAP_NOTE,
  theoreticalLapText,
} from './capture-format';
import { EMPTY_FILTER, filterFromParams, hasActiveFilter, paramsFromFilter, sameFilter, toggleStatus } from './capture-url';
import { CAPTURE_STATUS_ICONS, syncButtonView, SyncButtonView } from './capture-view';

/**
 * Painel de controle da captura de XML (spec 2026-11-27-painel-captura-xml, F-CP-1 a F-CP-4). Um componente para as
 * duas visões, escolhida pela rota (`data.scope`):
 * - `/captura` (escritório): ADMIN vê todas as empresas e pede "Sincronizar agora"; FISCAL (INVOICES_SYNC) vê só a
 *   carteira, sem o botão. No somente leitura, o botão fica desabilitado com o motivo;
 * - `/plataforma/captura` (CS Hub): todas as empresas de todos os escritórios, com coluna e filtro de escritório e sem
 *   CNPJ. Desligada no ambiente, a API responde 404 e a tela explica (o menu esconde o item).
 *
 * Filtros, ordem e página ficam na URL; a lista é paginada no servidor. Situações, motivos e mensagens vêm do backend
 * (a tela não recalcula nada); a posição na fila aparece somando 1.
 */
@Component({
  selector: 'app-capture-panel',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, Button, InputComponent, LoaderComponent, Page, Pagination, Table, Toggle, CaptureDetailPanelComponent],
  templateUrl: './capture-panel.component.html',
  styleUrl: './capture-panel.component.scss',
})
export class CapturePanelComponent implements OnInit {
  private readonly service = inject(CapturePanelService);
  private readonly platformFirms = inject(PlatformFirmService);
  private readonly auth = inject(AuthService);
  private readonly firmAccess = inject(FirmAccessService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly scope: CaptureScope = this.route.snapshot.data['scope'] === 'platform' ? 'platform' : 'firm';
  readonly isPlatform = this.scope === 'platform';
  /** Pede "Sincronizar agora": ADMIN no escritório, o admin da plataforma na plataforma (P-CP-02). */
  readonly canSync = this.isPlatform || this.auth.isAdmin;
  readonly canOpenCompany = !this.isPlatform && this.auth.can('COMPANIES_VIEW');
  readonly readOnly = this.firmAccess.readOnly;

  readonly statusOrder = CAPTURE_STATUS_ORDER;
  // Indexados por string: as células recebem a linha sem tipo (let-row do app-table).
  readonly statusLabels: Record<string, string> = CAPTURE_STATUS_LABELS;
  readonly statusHints: Record<string, string> = CAPTURE_STATUS_HINTS;
  readonly statusTones: Record<string, string> = CAPTURE_STATUS_TONES;
  readonly statusIcons: Record<string, string> = CAPTURE_STATUS_ICONS;
  readonly channelKeys: CaptureChannel[] = ['SIEG', 'SEFAZ', 'ADN'];
  readonly theoreticalNote = THEORETICAL_LAP_NOTE;
  readonly emptyIcon = faSatelliteDish;
  readonly errorIcon = faTriangleExclamation;
  readonly shortDateTime = shortDateTime;
  readonly formatDateTime = formatLocalDateTime;
  readonly displayPosition = displayPosition;

  readonly channelOptions: SelectOption[] = [
    { value: '', label: 'Todos os canais' },
    ...(Object.keys(CAPTURE_CHANNEL_LABELS) as CaptureChannel[]).map((key) => ({ value: key, label: CAPTURE_CHANNEL_LABELS[key] })),
  ];
  readonly typeOptions: SelectOption[] = [
    { value: '', label: 'Todos os tipos' },
    ...(Object.keys(CAPTURE_DOC_TYPE_LABELS) as CaptureDocType[]).map((key) => ({ value: key, label: CAPTURE_DOC_TYPE_LABELS[key] })),
  ];
  readonly sortOptions: SelectOption[] = (Object.keys(CAPTURE_SORT_LABELS) as CaptureSort[]).map((key) => ({
    value: key,
    label: CAPTURE_SORT_LABELS[key],
  }));
  readonly firmOptions = signal<SelectOption[]>([{ value: '', label: 'Todos os escritórios' }]);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly channelControl = new FormControl<string>('', { nonNullable: true });
  readonly typeControl = new FormControl<string>('', { nonNullable: true });
  readonly sortControl = new FormControl<string>('status', { nonNullable: true });
  readonly inactiveControl = new FormControl(false, { nonNullable: true });
  readonly firmControl = new FormControl<string>('', { nonNullable: true });

  // ------------------------------------------------------------- Estado --
  readonly filter = signal<CapturePanelFilter>(EMPTY_FILTER);
  readonly rows = signal<CapturePanelRowDTO[]>([]);
  readonly summary = signal<CapturePanelSummaryDTO | null>(null);
  readonly queue = signal<CapturePanelQueueDTO | null>(null);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  /** API respondeu 404 na visão da plataforma: desligada no ambiente. */
  readonly platformDisabled = signal(false);
  /** Empresas com o pedido de "Sincronizar agora" no ar. */
  readonly syncing = signal<ReadonlySet<string>>(new Set());

  // ------------------------------------------------------------ Detalhe --
  readonly selected = signal<CapturePanelRowDTO | null>(null);
  readonly detail = signal<CapturePanelDetailDTO | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  private detailSub: Subscription | null = null;
  private listSub: Subscription | null = null;

  readonly hasFilter = computed(() => hasActiveFilter(this.filter()));

  readonly summaryCards = computed(() => {
    const byStatus = this.summary()?.byStatus ?? {};
    const active = new Set(this.filter().situacao);
    return CAPTURE_STATUS_ORDER.map((status) => ({
      status,
      count: byStatus[status] ?? 0,
      active: active.has(status),
    }));
  });

  readonly queueView = computed(() => {
    const queue = this.queue();
    if (!queue) return null;
    // Captura SIEG desligada: só o estado; sem próxima rodada nem voltas (QA B-5).
    if (queue.health === 'DISABLED') {
      return { health: queueHealthView(queue.health, null, null), observed: null, theoretical: null, nextTick: null };
    }
    return {
      health: queueHealthView(queue.health, queue.stalledSince, queue.nextTickAt),
      observed: observedLapText(queue.observedLapMinutes, queue.neverAttempted, this.isPlatform),
      theoretical: theoreticalLapText(queue.theoreticalLapMinutes),
      nextTick: queue.nextTickAt ? shortDateTime(queue.nextTickAt) : null,
    };
  });

  readonly selectedSync = computed(() => {
    const row = this.detail() ?? this.selected();
    return row ? this.syncView(row) : null;
  });

  private readonly companyCell = viewChild.required<TemplateRef<unknown>>('companyCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');
  private readonly channelsCell = viewChild.required<TemplateRef<unknown>>('channelsCell');
  private readonly nfeCell = viewChild.required<TemplateRef<unknown>>('nfeCell');
  private readonly queueCell = viewChild.required<TemplateRef<unknown>>('queueCell');
  private readonly actionsCell = viewChild.required<TemplateRef<unknown>>('actionsCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: this.isPlatform ? 'Escritório / empresa' : 'Empresa', cellTemplate: this.companyCell() },
    { name: 'Situação', cellTemplate: this.statusCell() },
    { name: 'Canais', cellTemplate: this.channelsCell() },
    // Recebidas e emitidas numa coluna só: a tabela cabe em 1366 px sem rolagem (QA B-2).
    { name: 'NF-e (Taxify / SIEG)', cellTemplate: this.nfeCell(), headerClass: 'justify-content-end' },
    { name: 'Fila SIEG', cellTemplate: this.queueCell() },
    { name: 'Ações', cellTemplate: this.actionsCell(), headerClass: 'justify-content-end' },
  ]);

  readonly tableConfig: TableConfig = { headerVisible: true };

  constructor() {
    inject(FaIconLibrary).addIcons(
      faArrowsRotate, faBan, faCircleCheck, faCirclePause, faCirclePlay, faCircleStop, faCircleXmark, faClock, faEye,
      faHourglassHalf, faLock, faPowerOff, faTriangleExclamation, faXmark,
    );
  }

  ngOnInit(): void {
    // A URL manda: cada mudança dela (filtro, página, voltar do navegador, link colado) busca de novo.
    this.route.queryParamMap
      .pipe(
        map((params) => filterFromParams(params, this.scope)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filter) => {
        const first = !this.loaded() && !this.loading() && !this.listSub;
        if (!first && sameFilter(filter, this.filter())) {
          return;
        }
        this.filter.set(filter);
        this.syncControls(filter);
        this.load();
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((busca) => this.navigate({ busca }));
    this.channelControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((canal) => this.navigate({ canal: (canal || null) as CaptureChannel | null }));
    this.typeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => this.navigate({ tipo: (tipo || null) as CaptureDocType | null }));
    this.sortControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sort) => this.navigate({ sort: (sort || null) as CaptureSort | null }));
    this.inactiveControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((incluirInativas) => this.navigate({ incluirInativas }));
    this.firmControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((firmId) => this.navigate({ firmId: firmId || null }));

    if (this.isPlatform) {
      this.loadFirmOptions();
    }
  }

  /** Controles iguais à URL, sem disparar outra navegação. */
  private syncControls(filter: CapturePanelFilter): void {
    const options = { emitEvent: false };
    if (this.searchControl.value !== filter.busca) this.searchControl.setValue(filter.busca, options);
    this.channelControl.setValue(filter.canal ?? '', options);
    this.typeControl.setValue(filter.tipo ?? '', options);
    this.sortControl.setValue(filter.sort ?? 'status', options);
    this.inactiveControl.setValue(filter.incluirInativas, options);
    this.firmControl.setValue(filter.firmId ?? '', options);
  }

  /** Muda o filtro pela URL (sem histórico novo, como nas Pendências). Mudar filtro volta para a página 1. */
  navigate(change: Partial<CapturePanelFilter>): void {
    const next: CapturePanelFilter = { ...this.filter(), page: 0, ...change };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: paramsFromFilter(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  load(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.listSub = this.service.list(this.scope, this.filter()).subscribe({
      next: (response) => {
        // Página da URL além do total (link velho, filtro que encolheu a lista): volta para a última válida (QA B-4).
        const lastPage = Math.max(response.page.totalPages - 1, 0);
        if (this.filter().page > lastPage) {
          this.navigate({ ...this.filter(), page: lastPage });
          return;
        }
        this.summary.set(response.summary);
        this.queue.set(response.queue);
        this.rows.set(response.page.content);
        this.totalPages.set(response.page.totalPages);
        this.totalElements.set(response.page.totalElements);
        this.platformDisabled.set(false);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (this.isPlatform && httpStatusOf(error) === 404) {
          this.platformDisabled.set(true);
          return;
        }
        this.loadError.set(loadErrorText(error, this.scope, 'list'));
      },
    });
  }

  private loadFirmOptions(): void {
    this.platformFirms.getAll({ page: 0, size: 100 }).subscribe({
      next: (page) =>
        this.firmOptions.set([
          { value: '', label: 'Todos os escritórios' },
          ...page.content.map((firm) => ({ value: firm.id, label: firm.name })),
        ]),
      error: () => undefined, // sem a lista, o filtro fica só com "Todos"; a URL com firmId continua valendo
    });
  }

  onPageIndexChange(index: number): void {
    this.navigate({ ...this.filter(), page: index });
  }

  toggleStatusFilter(status: CaptureStatus): void {
    this.navigate({ situacao: toggleStatus(this.filter().situacao, status) });
  }

  clearFilters(): void {
    this.navigate({ ...EMPTY_FILTER, sort: this.filter().sort });
  }

  // ---------------------------------------------------------- Células --
  channelStatus(row: CapturePanelRowDTO, channel: CaptureChannel): CaptureStatus | null {
    return row.channels?.[channel]?.status ?? null;
  }

  /** "180 / 200" (no Taxify / SIEG). Sem verificação, "—". */
  sideText(side: CaptureSideDTO | null | undefined): string {
    if (!side || side.imported == null) return '—';
    return `${side.imported} / ${side.totalSieg ?? '—'}`;
  }

  sideMonth(side: CaptureSideDTO | null | undefined): string {
    const month = side?.month ?? side?.from;
    return month ? shortMonth(month) : '';
  }

  failureLine(row: CapturePanelRowDTO): string | null {
    const failure = row.lastFailure;
    if (!failure || failure.resolved) return null;
    // A falha já é o motivo da situação: na lista fica só o statusReason, com as falhas seguidas se houver.
    if (failure.explainsStatus) {
      return failure.consecutiveFailures > 1 ? `Falhou ${failure.consecutiveFailures} vezes seguidas` : null;
    }
    return failureText(failure.code, failure.message, failure.providerStatus);
  }

  queuePosition(row: CapturePanelRowDTO): number | null {
    return displayPosition(row.channels?.SIEG?.queuePosition);
  }

  syncView(row: CapturePanelRowDTO): SyncButtonView {
    return syncButtonView(row, {
      scope: this.scope,
      allowed: this.canSync,
      readOnly: this.readOnly(),
      queueHealth: this.queue()?.health ?? null,
      busy: this.syncing().has(row.companyId),
    });
  }

  // ------------------------------------------------------------ Detalhe --
  open(row: CapturePanelRowDTO): void {
    this.selected.set(row);
    this.loadDetail(row.companyId);
  }

  close(): void {
    this.detailSub?.unsubscribe();
    this.selected.set(null);
    this.detail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
  }

  retryDetail(): void {
    const row = this.selected();
    if (row) this.loadDetail(row.companyId);
  }

  private loadDetail(companyId: string): void {
    this.detailSub?.unsubscribe();
    this.detail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.detailSub = this.service.detail(this.scope, companyId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailLoading.set(false);
        this.detailError.set(loadErrorText(error, this.scope, 'detail'));
      },
    });
  }

  // -------------------------------------------------- Sincronizar agora --
  /** Confirma ("A empresa vai para o início da fila. Estimativa: {hora}") e pede; a captura não roda na requisição. */
  async syncNow(row: CapturePanelRowDTO): Promise<void> {
    const view = this.syncView(row);
    if (!view.show || view.disabled) {
      return;
    }
    const name = row.establishment ? `${row.companyName} /${row.establishment}` : row.companyName;
    const confirmed = await this.confirmDialog.ask(
      `${name}\n\nA empresa entra no início da fila do SIEG, depois dos pedidos que já estão na frente. A posição e a estimativa aparecem depois do pedido.\n\nSó o SIEG: as NF-e recebidas e emitidas do mês são contadas de novo. Os pedidos têm um limite por dia por escritório e um intervalo mínimo entre dois atendimentos da mesma empresa.`,
      { title: 'Sincronizar agora', confirmLabel: 'Colocar no início da fila' },
    );
    if (!confirmed) {
      return;
    }

    this.setSyncing(row.companyId, true);
    this.service.syncNow(this.scope, row.companyId).subscribe({
      next: (response) => {
        this.setSyncing(row.companyId, false);
        const position = displayPosition(response.position);
        const when = response.estimatedAt ? `; estimativa ${shortDateTime(response.estimatedAt)}` : '';
        this.toastr.success(`Na fila: posição ${position ?? 1}${when}.`, name);
        const request = {
          requestId: response.requestId,
          status: response.status,
          requestedAt: null,
          position: response.position,
          estimatedAt: response.estimatedAt,
        };
        const withRequest = (item: CapturePanelRowDTO): CapturePanelRowDTO =>
          item.companyId === row.companyId
            ? { ...item, channels: { ...item.channels, SIEG: { ...item.channels.SIEG, priorityRequest: request } } }
            : item;
        this.rows.update((rows) => rows.map(withRequest));
        if (this.selected()?.companyId === row.companyId) {
          this.selected.update((item) => (item ? withRequest(item) : item));
          this.loadDetail(row.companyId); // traz quem pediu e a estimativa do backend
        }
      },
      error: (error: unknown) => {
        this.setSyncing(row.companyId, false);
        const view = syncNowErrorView(error, this.scope);
        this.toastr.warning(view.message, view.title);
        if (view.reloadFirmAccess) {
          this.firmAccess.reload();
        }
      },
    });
  }

  private setSyncing(companyId: string, on: boolean): void {
    this.syncing.update((current) => {
      const next = new Set(current);
      if (on) next.add(companyId);
      else next.delete(companyId);
      return next;
    });
  }
}
