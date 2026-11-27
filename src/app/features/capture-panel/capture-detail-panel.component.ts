import { Component, computed, ElementRef, EventEmitter, HostListener, input, Output, viewChild, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CAPTURE_CHANNEL_LABELS,
  CAPTURE_DIRECT_LAST_STATUS_LABELS,
  CAPTURE_STAGE_LABELS,
  CAPTURE_STATUS_LABELS,
  CAPTURE_STATUS_TONES,
  CaptureChannel,
  CapturePanelDetailDTO,
  CaptureSideDTO,
  CaptureStageStatusDTO,
  CaptureScope,
  CaptureStatus,
  displayPosition,
} from '../../core/models/capture-panel.model';
import { Button } from '../../shared/components/button/button';
import { LoaderComponent } from '../../shared/components/loader/loader';
import { formatLocalDate, formatLocalDateTime } from '../../shared/utils/format';
import { dateTimeOrNever, failureText, shortDateTime, shortMonth, timeOf } from './capture-format';
import { CAPTURE_STATUS_ICONS, priorityRequestText, SyncButtonView } from './capture-view';

interface DocLine {
  label: string;
  at: string | null;
}

/**
 * Detalhe da empresa no painel de captura (F-CP-2, CP-RN-09): cada número com a memória de onde veio - contadores
 * com a janela e "no Taxify (qualquer origem)", o mês anterior, a última nota por origem, SEFAZ e ADN, as falhas por
 * etapa (resolvidas ou não) e a recuperação. Painel lateral; Esc fecha.
 */
@Component({
  selector: 'app-capture-detail-panel',
  standalone: true,
  imports: [FaIconComponent, RouterLink, Button, LoaderComponent],
  templateUrl: './capture-detail-panel.component.html',
  styleUrl: './capture-detail-panel.component.scss',
})
export class CaptureDetailPanelComponent {
  readonly scope = input.required<CaptureScope>();
  /** Nome da linha clicada (aparece no título enquanto o detalhe carrega). */
  readonly title = input('');
  readonly detail = input<CapturePanelDetailDTO | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly sync = input<SyncButtonView | null>(null);
  /** Link para a ficha da empresa (aba Certificado): só no escritório e com COMPANIES_VIEW. */
  readonly canOpenCompany = input(false);

  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() syncNow = new EventEmitter<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly statusLabels: Record<string, string> = CAPTURE_STATUS_LABELS;
  readonly statusTones: Record<string, string> = CAPTURE_STATUS_TONES;
  readonly statusIcons: Record<string, string> = CAPTURE_STATUS_ICONS;
  readonly channelLabels = CAPTURE_CHANNEL_LABELS;
  readonly directLabels = CAPTURE_DIRECT_LAST_STATUS_LABELS;
  readonly channels: CaptureChannel[] = ['SIEG', 'SEFAZ', 'ADN'];
  readonly formatDate = formatLocalDate;
  readonly formatDateTime = formatLocalDateTime;
  readonly orNever = dateTimeOrNever;
  readonly shortMonth = shortMonth;
  readonly shortDateTime = shortDateTime;
  readonly timeOf = timeOf;
  readonly displayPosition = displayPosition;

  constructor() {
    // Abriu: o foco vai para o painel (leitor de tela anuncia o diálogo; Tab segue dentro dele).
    effect(() => {
      this.panel()?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  /** Memórias prontas do backend (CP-RN-09); a montagem local abaixo de cada uma é só reserva se vier nula. */
  readonly siegQueueText = computed(() => {
    const ready = this.detail()?.memory?.queue;
    if (ready) return ready;
    const sieg = this.detail()?.channels.SIEG;
    if (!sieg) return null;
    const position = displayPosition(sieg.queuePosition);
    if (position == null) return null;
    return sieg.nextAttemptEstimate
      ? `Posição ${position} na fila; estimativa ${shortDateTime(sieg.nextAttemptEstimate)}`
      : `Posição ${position} na fila`;
  });

  readonly verifiedMemo = computed(() => {
    const ready = this.detail()?.memory?.verification;
    if (ready) return ready;
    const sieg = this.detail()?.channels.SIEG;
    if (!sieg) return '';
    const received = sieg.received?.checkedAt ? shortDateTime(sieg.received.checkedAt) : 'nunca';
    const issued = sieg.issued?.checkedAt ? shortDateTime(sieg.issued.checkedAt) : 'nunca';
    return `A mais antiga entre recebidas (${received}) e emitidas (${issued}).`;
  });

  readonly priorityText = computed(() => {
    const request = this.detail()?.channels.SIEG.priorityRequest;
    return request ? priorityRequestText(request, this.scope()) : null;
  });

  readonly lastDocuments = computed<{ nfe: DocLine[]; nfse: DocLine[] } | null>(() => {
    const docs = this.detail()?.lastDocuments;
    if (!docs) return null;
    return {
      nfe: [
        { label: 'NF-e pelo SIEG', at: docs.nfe.SIEG },
        { label: 'NF-e pela SEFAZ', at: docs.nfe.SEFAZ_DIST },
        { label: 'NF-e por upload', at: docs.nfe.UPLOAD },
      ],
      nfse: [
        { label: 'NFS-e pelo SIEG', at: docs.nfse.SIEG },
        { label: 'NFS-e pelo ADN', at: docs.nfse.ADN },
        { label: 'NFS-e por upload', at: docs.nfse.UPLOAD },
      ],
    };
  });

  readonly recoveryText = computed(() => {
    const ready = this.detail()?.memory?.recovery;
    if (ready) return ready;
    const months = this.detail()?.recoveringMonths ?? [];
    if (!months.length) return null;
    const list = months.length === 1 ? months[0] : `${months.slice(0, -1).join(', ')} e ${months[months.length - 1]}`;
    return `Recuperando ${list}`;
  });

  /** Etapas com falha atual primeiro; depois as resolvidas e as com aviso. */
  readonly stages = computed(() =>
    [...(this.detail()?.stages ?? [])].sort((a, b) => Number(b.lastOutcome === 'FAILURE') - Number(a.lastOutcome === 'FAILURE')),
  );

  statusOf(channel: CaptureChannel): CaptureStatus | null {
    return this.detail()?.channels[channel]?.status ?? null;
  }

  reasonOf(channel: CaptureChannel): string | null {
    return this.detail()?.channels[channel]?.reason ?? null;
  }

  /** SEFAZ e ADN com erro: a mensagem do código seguro (CP-RN-11), se não for a mesma do motivo. */
  directFailureOf(channel: CaptureChannel): string | null {
    if (channel === 'SIEG') return null;
    const direct = this.detail()?.channels[channel];
    if (!direct?.failureCode) return null;
    const text = failureText(direct.failureCode, direct.failureMessage);
    return text === direct.reason ? null : text;
  }

  /** "{importado} notas no Taxify (qualquer origem) emitidas de {início} a {fim}; o SIEG informou {total} na verificação de {data hora}" */
  sideMemo(side: CaptureSideDTO | null | undefined): string {
    if (side?.memory) {
      return side.memory;
    }
    if (!side || side.imported == null) {
      return 'Ainda não verificado.';
    }
    const window = side.from && side.to ? ` emitidas de ${formatLocalDate(side.from)} a ${formatLocalDate(side.to)}` : '';
    const sieg =
      side.totalSieg == null
        ? '; o SIEG ainda não informou o total'
        : `; o SIEG informou ${side.totalSieg}${side.checkedAt ? ` na verificação de ${formatLocalDateTime(side.checkedAt)}` : ''}`;
    return `${side.imported} notas no Taxify (qualquer origem)${window}${sieg}.`;
  }

  /** Mês dos contadores (um lado verificado no mês anterior mostra os números daquele mês - CP-RN-06). */
  sideMonth(side: CaptureSideDTO | null | undefined): string | null {
    const month = side?.month ?? side?.from;
    return month ? shortMonth(month) : null;
  }

  /** Só a contagem que falta para exibir; a pendência em si é a situação que o backend calculou. */
  missing(side: CaptureSideDTO | null | undefined): number {
    if (side?.missing != null) return Math.max(side.missing, 0);
    if (!side || side.imported == null || side.totalSieg == null) return 0;
    return Math.max(side.totalSieg - side.imported, 0);
  }

  previousMonthText(side: CaptureSideDTO | null | undefined, what: string): string | null {
    const prev = side?.previousMonth;
    if (!prev) return null;
    if (prev.memory) return prev.memory;
    return `${shortMonth(prev.month)} fechou com ${prev.imported} de ${prev.totalSieg} NF-e ${what}`;
  }

  eventsText(day: string | null | undefined): string {
    return day ? `Cancelamentos dos últimos 3 dias relidos em ${formatLocalDate(day)}` : 'Ainda não varridos';
  }

  stageLabel(stage: CaptureStageStatusDTO): string {
    return CAPTURE_STAGE_LABELS[stage.stage] ?? stage.stage;
  }

  stageFailure(stage: CaptureStageStatusDTO): string | null {
    if (!stage.failureCode) return null;
    return failureText(stage.failureCode, stage.failureMessage, stage.providerStatus);
  }

  stageWarning(stage: CaptureStageStatusDTO): string | null {
    if (!stage.warningCode) return null;
    return failureText(stage.warningCode, stage.warningMessage, stage.providerStatus, stage.warningCount);
  }

  /** "Falhou 3 vezes seguidas; último sucesso em 24/11 14:05" / "última falha em 27/11 09:40 (resolvida)". */
  stageHistory(stage: CaptureStageStatusDTO): string {
    if (stage.memory) {
      return stage.memory;
    }
    const lastFailure = this.detail()?.lastFailure;
    if (lastFailure?.memory && lastFailure.stage === stage.stage) {
      return lastFailure.memory;
    }
    const success = stage.lastSuccessAt ? `último sucesso em ${shortDateTime(stage.lastSuccessAt)}` : 'nunca teve sucesso';
    if (stage.lastOutcome === 'FAILURE') {
      const times = stage.consecutiveFailures === 1 ? '1 vez' : `${stage.consecutiveFailures} vezes seguidas`;
      return `Falhou ${times}; ${success}`;
    }
    const lastOk = stage.lastSuccessAt ? `OK em ${shortDateTime(stage.lastSuccessAt)}` : 'OK';
    return stage.lastFailureAt ? `${lastOk} · última falha em ${shortDateTime(stage.lastFailureAt)} (resolvida)` : lastOk;
  }
}
