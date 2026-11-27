import { Component, computed, DestroyRef, effect, EventEmitter, inject, input, OnInit, Output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faArrowsRotate, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { interval, startWith, Subscription } from 'rxjs';
import {
  STOCK_CREDIT_CLASSIFICATION_LABELS,
  STOCK_CREDIT_CLASSIFICATION_TONES,
  STOCK_CREDIT_COVERAGE_HINTS,
  STOCK_CREDIT_COVERAGE_LABELS,
  STOCK_CREDIT_COVERAGE_TONES,
  STOCK_CREDIT_NOTE_MAX,
  STOCK_CREDIT_NOTICE,
  STOCK_CREDIT_STATUS_LABELS,
  STOCK_CREDIT_STATUS_ORDER,
  STOCK_CREDIT_STATUS_TONES,
  STOCK_CREDIT_YEAR,
  StockCreditDetailDTO,
  StockCreditEventDTO,
  StockCreditRowDTO,
  StockCreditStatus,
} from '../../../core/models/stock-credit.model';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { StockCreditService } from '../../../core/services/stock-credit.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { SidePanel } from '../../../shared/components/side-panel/side-panel';
import { formatDocument } from '../../../shared/utils/document-mask';
import { formatCurrency, formatLocalDate, formatLocalDateTime } from '../../../shared/utils/format';
import { formatNcm } from '../../invoices/invoice-format';
import {
  calculatedText,
  coverageText,
  monthLabel,
  referenceRegimeText,
  refreshButtonView,
  regimeLabel,
  statusEditView,
  stockCreditErrorView,
} from './stock-credit-view';

/** Releitura do relógio para liberar o "Atualizar agora" quando o cooldown vence com o painel aberto. */
const CLOCK_TICK_MS = 15_000;

/**
 * Detalhe da empresa no levantamento (F-CE-3), em painel lateral: classificação e motivo, regime e de onde veio,
 * compras por mês, por CST de PIS e top NCM, cobertura, memória (CE-RN-14) e histórico da situação. "Atualizar agora"
 * e a troca da situação só para quem tem TAX_ASSESSMENT_CLOSE; no somente leitura ficam desabilitados com o motivo
 * (`[write]`); encerrado, desabilitados com o aviso. O 409 de conflito recarrega o detalhe e avisa.
 */
@Component({
  selector: 'app-stock-credit-detail',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, Button, InputComponent, LoaderComponent, SidePanel],
  templateUrl: './stock-credit-detail.component.html',
  styleUrl: './stock-credit-detail.component.scss',
})
export class StockCreditDetailComponent implements OnInit {
  private readonly service = inject(StockCreditService);
  private readonly firmAccess = inject(FirmAccessService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly row = input.required<StockCreditRowDTO>();
  readonly canWrite = input(false);
  readonly surveyClosed = input(false);

  @Output() closed = new EventEmitter<void>();
  /** Gravou (situação ou recálculo): a lista recarrega a linha e o resumo. */
  @Output() changed = new EventEmitter<void>();

  readonly year = STOCK_CREDIT_YEAR;
  readonly noteMax = STOCK_CREDIT_NOTE_MAX;
  readonly fallbackNotice = STOCK_CREDIT_NOTICE;
  readonly infoIcon = faCircleInfo;
  readonly warnIcon = faTriangleExclamation;
  readonly classificationLabels: Partial<Record<string, string>> = STOCK_CREDIT_CLASSIFICATION_LABELS;
  readonly classificationTones: Record<string, string> = STOCK_CREDIT_CLASSIFICATION_TONES;
  readonly coverageLabels: Partial<Record<string, string>> = STOCK_CREDIT_COVERAGE_LABELS;
  readonly coverageHints: Record<string, string> = STOCK_CREDIT_COVERAGE_HINTS;
  readonly coverageTones: Record<string, string> = STOCK_CREDIT_COVERAGE_TONES;
  readonly statusLabels: Partial<Record<string, string>> = STOCK_CREDIT_STATUS_LABELS;
  readonly statusTones: Record<string, string> = STOCK_CREDIT_STATUS_TONES;
  readonly statusOptions: SelectOption[] = STOCK_CREDIT_STATUS_ORDER.map((status) => ({ value: status, label: STOCK_CREDIT_STATUS_LABELS[status] }));
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatLocalDate;
  readonly formatDateTime = formatLocalDateTime;
  readonly formatNcm = formatNcm;
  readonly monthLabel = monthLabel;
  readonly calculatedText = calculatedText;
  readonly coverageText = coverageText;
  readonly regimeLabel = regimeLabel;
  readonly referenceRegimeText = referenceRegimeText;

  readonly detail = signal<StockCreditDetailDTO | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly notCalculated = signal(false);
  readonly history = signal<StockCreditEventDTO[]>([]);
  readonly historyError = signal<string | null>(null);
  readonly refreshing = signal(false);
  readonly savingStatus = signal(false);
  /** Aviso do painel depois de um 409 (conflito ou encerrado). */
  readonly panelNotice = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);

  readonly statusControl = new FormControl<StockCreditStatus>('NOT_EVALUATED', { nonNullable: true, validators: Validators.required });
  readonly noteControl = new FormControl('', { nonNullable: true, validators: Validators.maxLength(STOCK_CREDIT_NOTE_MAX) });
  private readonly statusValue = toSignal(this.statusControl.valueChanges, { initialValue: this.statusControl.value });
  private readonly noteValue = toSignal(this.noteControl.valueChanges, { initialValue: this.noteControl.value });

  private readonly now = toSignal(interval(CLOCK_TICK_MS).pipe(startWith(0)), { initialValue: 0 });
  private detailSub: Subscription | null = null;

  /** O que aparece no título enquanto o detalhe carrega. */
  readonly view = computed<StockCreditRowDTO>(() => this.detail() ?? this.row());
  readonly subtitle = computed(() => {
    const cnpj = this.view().cnpj;
    return cnpj ? `CNPJ ${formatDocument(cnpj)}` : '';
  });

  private writeContext(busy: boolean) {
    this.now(); // relê a cada tique
    return { canWrite: this.canWrite(), closed: this.surveyClosed(), readOnly: this.firmAccess.readOnly(), busy, now: Date.now() };
  }

  readonly refreshView = computed(() => refreshButtonView(this.detail(), this.writeContext(this.refreshing())));
  readonly statusView = computed(() => statusEditView(this.detail(), this.writeContext(this.savingStatus())));

  /** Nada mudou em relação ao gravado: "Salvar situação" fica desabilitado. */
  readonly statusUnchanged = computed(() => {
    const detail = this.detail();
    if (!detail) return true;
    return this.statusValue() === detail.status && (this.noteValue().trim() || null) === (detail.note || null);
  });

  constructor() {
    inject(FaIconLibrary).addIcons(faArrowsRotate);
    // Encerrado ou gravando: os campos da situação ficam travados junto com o botão.
    effect(() => {
      const locked = this.statusView().disabled;
      for (const control of [this.statusControl, this.noteControl]) {
        if (locked && control.enabled) control.disable({ emitEvent: false });
        if (!locked && control.disabled) control.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const companyId = this.row().companyId;
    this.detailSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.notCalculated.set(false);
    this.detailSub = this.service
      .getById(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.setDetail(detail);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          const view = stockCreditErrorView(error, 'detail');
          this.notCalculated.set(view.notCalculated);
          this.loadError.set(view.message);
        },
      });
    this.loadHistory();
  }

  private setDetail(detail: StockCreditDetailDTO): void {
    this.detail.set(detail);
    this.statusControl.setValue(detail.status);
    this.noteControl.setValue(detail.note ?? '');
    this.noteControl.markAsPristine();
  }

  loadHistory(): void {
    this.historyError.set(null);
    this.service
      .history(this.row().companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (events) => this.history.set(events),
        error: (error: unknown) => this.historyError.set(stockCreditErrorView(error, 'history').message),
      });
  }

  /** CE-RN-09: recalcula na hora e devolve o detalhe. Cooldown (409 com `retryAt`) explica a hora de liberar. */
  refresh(): void {
    if (this.refreshView().disabled) return;
    this.refreshing.set(true);
    this.panelNotice.set(null);
    this.service.refresh(this.row().companyId).subscribe({
      next: (detail) => {
        this.refreshing.set(false);
        this.notCalculated.set(false);
        this.loadError.set(null);
        this.setDetail(detail);
        this.toastr.success(`Levantamento recalculado em ${calculatedText(detail.calculatedAt)}.`, detail.companyName);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.refreshing.set(false);
        this.showWriteError(error, 'refresh');
      },
    });
  }

  /** CE-RN-10: grava a situação com a `version` lida; 409 de conflito recarrega e avisa. */
  saveStatus(): void {
    const detail = this.detail();
    if (!detail || this.statusView().disabled || this.statusUnchanged()) return;
    if (this.noteControl.invalid) {
      this.noteControl.markAsTouched();
      return;
    }
    this.savingStatus.set(true);
    this.statusError.set(null);
    this.panelNotice.set(null);
    this.service
      .updateStatus(detail.companyId, {
        year: this.year,
        status: this.statusControl.value,
        note: this.noteControl.value.trim() || null,
        version: detail.version,
      })
      .subscribe({
        next: (row) => {
          this.savingStatus.set(false);
          this.setDetail({ ...detail, ...row });
          this.toastr.success(`Situação: ${this.statusLabels[row.status] ?? row.status}.`, row.companyName);
          this.loadHistory();
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.savingStatus.set(false);
          this.showWriteError(error, 'status');
        },
      });
  }

  private showWriteError(error: unknown, action: 'refresh' | 'status'): void {
    const view = stockCreditErrorView(error, action);
    if (view.reloadFirmAccess) {
      this.firmAccess.reload();
    }
    if (view.conflict) {
      this.panelNotice.set(`${view.message} Recarregamos a empresa com o que está gravado agora.`);
      this.load();
      this.changed.emit();
      return;
    }
    // Encerrado ou cálculo que falhou: o aviso fica no painel. A falha de cálculo não consome o cooldown, então o
    // botão continua liberado (o detalhe e o refreshAvailableAt não mudam).
    if (view.closed || view.calculationFailed) {
      this.panelNotice.set(view.message);
      return;
    }
    if (view.field === 'note') {
      this.noteControl.setErrors({ server: view.message });
      this.noteControl.markAsTouched();
      return;
    }
    if (action === 'status') {
      this.statusError.set(view.message);
      return;
    }
    this.toastr.warning(view.message, 'Atualizar agora');
  }
}
