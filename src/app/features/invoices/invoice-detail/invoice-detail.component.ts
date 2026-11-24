import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import {
  DIRECTION_LABELS,
  EVENT_LABELS,
  REVIEW_LABELS,
  ReviewStatus,
  FiscalXmlEventDTO,
  FiscalXmlDetailDTO,
  FiscalXmlProdutoDTO,
  FiscalXmlRectificationResultDTO,
  ORIGIN_LABELS,
} from '../../../core/models/fiscal-xml.model';
import { AUDIT_STATUS_LABELS, InvoiceAuditLogDTO, InvoiceAuditStatus, MANUAL_AUDIT_STATUSES } from '../../../core/models/invoice-audit-log.model';
import { FiscalCheckFindingDTO, ProductFiscalDivergenceDTO } from '../../../core/models/product-fiscal-rule.model';
import { findingGroupLabel } from '../../companies/company-fiscal-conference/finding-groups';
import { AuthService } from '../../../core/services/auth.service';
import { FiscalXmlService } from '../../../core/services/fiscal-xml.service';
import { InvoiceAuditLogService } from '../../../core/services/invoice-audit-log.service';
import { ProductFiscalRuleService } from '../../../core/services/product-fiscal-rule.service';
import { downloadBlob } from '../../../shared/utils/download-blob';
import {
  ambienteLabel,
  copyToClipboard,
  destinoLabel,
  documentTypeLabel,
  finalidadeLabel,
  formatAccessKey,
  formatAddress,
  formatCurrency,
  formatDate,
  formatDocument,
  formatNcm,
  formatNumber,
  formatPercent,
  indicadorIeLabel,
  issueDateOf,
  issuerDocument,
  presencaLabel,
  recipientDocument,
  regimeLabel,
  tipoEmissaoLabel,
  tipoOperacaoLabel,
} from '../invoice-format';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { LoaderComponent } from '../../../shared/components/loader/loader';

type DetailTab = 'resumo' | 'produtos' | 'totais' | 'divergencias' | 'auditoria' | 'eventos' | 'xml' | 'pdf';

interface InfoField {
  label: string;
  value?: string | null;
  mono?: boolean;
}

interface AmountLine {
  label: string;
  value?: number;
  sign?: '+' | '-';
  strong?: boolean;
}


/** Line breaks + indentation for a one-line XML, so it's readable in the XML tab. */
function prettyXml(xml: string): string {
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^<\/\w/.test(trimmed)) {
        depth = Math.max(depth - 1, 0);
      }
      const indented = '  '.repeat(depth) + trimmed;
      if (/^<\w[^>]*[^/]>$/.test(trimmed) && !/^<\w[^>]*>.*<\/\w[^>]*>$/.test(trimmed) && !trimmed.startsWith('<?')) {
        depth++;
      }
      return indented;
    })
    .join('\n');
}

/** Telas que abrem a nota, pelo começo da URL - o mais específico primeiro. */
const BACK_TARGETS: [string, string][] = [
  ['/notas-fiscais', 'Notas fiscais'],
  ['/fronteira', 'Fronteira PE'],
  ['/auditoria', 'Auditoria'],
  ['/pendencias', 'Pendências'],
  ['/retencoes', 'Retenções'],
  ['/manifestacao', 'Manifestação'],
  ['/apuracao', 'Apuração'],
  ['/relatorios', 'Relatórios'],
  ['/cadastro/empresas', 'a empresa'],
  ['/home', 'o início'],
];

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [LoaderComponent, CommonModule, FormsModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Table],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss',
})
export class InvoiceDetailComponent implements OnInit, OnDestroy {
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /**
   * A tela de onde a nota foi aberta (Fronteira, Auditoria, Pendências...), para o "Voltar" levar de volta a ela.
   * Lida na criação, enquanto a navegação até aqui ainda é a atual; null = abriu direto (link, F5).
   */
  private readonly cameFrom: string | null = this.sourceUrl();
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  protected readonly authService = inject(AuthService);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly invoiceAuditLogService = inject(InvoiceAuditLogService);
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly destroyed$ = new Subject<void>();

  readonly xml = signal<FiscalXmlDetailDTO | null>(null);
  readonly accessKey = computed(() => this.xml()?.accessKey ?? '');
  readonly companyId = computed(() => this.xml()?.companyId ?? null);
  readonly documentId = computed(() => this.xml()?.id ?? null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly tab = signal<DetailTab>('resumo');
  readonly expandedItems = signal<Set<number>>(new Set());

  // Items and raw XML are fetched only when their tab is first opened (or, for items,
  // when the divergences need to be flagged against them).
  readonly produtos = signal<FiscalXmlProdutoDTO[]>([]);
  readonly produtosLoading = signal(false);
  private produtosLoaded = false;

  readonly xmlContent = signal<string | null>(null);
  readonly xmlLoading = signal(false);
  private xmlLoaded = false;

  // DANFE PDF: fetched as a blob (the API needs the auth header, so the iframe can't
  // hit the URL directly) and shown through an object URL, revoked on destroy.
  private pdfObjectUrl: string | null = null;
  private pdfBlob: Blob | null = null;
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfLoading = signal(false);
  readonly pdfError = signal(false);

  readonly divergences = signal<ProductFiscalDivergenceDTO[]>([]);
  readonly divergencesLoading = signal(false);
  /** Demais achados da conferência fiscal desta nota (CFOP/NCM já estão em divergences). */
  readonly findings = signal<FiscalCheckFindingDTO[]>([]);
  readonly findingsLoading = signal(false);
  /** Divergências de CFOP/NCM + achados da conferência - o que o selo e a aba contam. */
  readonly issueCount = computed(() => this.divergences().length + this.findings().length);
  readonly findingGroupLabel = findingGroupLabel;
  /** Há divergência de código com a regra do produto além de CFOP/NCM - a retificação pode corrigir. */
  readonly ruleFindings = computed(() => this.findings().some((f) => f.codigo.startsWith('RULE_')));
  readonly rectifying = signal(false);
  readonly rectificationResult = signal<FiscalXmlRectificationResultDTO | null>(null);

  readonly auditLogs = signal<InvoiceAuditLogDTO[]>([]);
  readonly auditLoading = signal(false);
  readonly auditFormDialogOpen = signal(false);
  readonly statusSuggestions = MANUAL_AUDIT_STATUSES;
  readonly auditStatusLabel = (status: InvoiceAuditStatus): string => AUDIT_STATUS_LABELS[status] ?? status;

  readonly auditForm = this.fb.group({
    status: this.fb.nonNullable.control('', Validators.required),
    notes: this.fb.nonNullable.control('', Validators.required),
  });

  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');
  private readonly auditWhoCell = viewChild.required<TemplateRef<unknown>>('auditWhoCell');

  readonly auditColumns = computed<TableColumn[]>(() => [
    { name: 'Situação', cellTemplate: this.statusCell(), width: '200px' },
    { name: 'Observações', property: 'notes', cellTextLength: 120 },
    { name: 'Quando / quem', cellTemplate: this.auditWhoCell(), width: '220px' },
  ]);

  readonly auditTableConfig: TableConfig = {
    headerVisible: true,
    // histórico só de inclusão: sem editar nem excluir
    actions: [],
  };

  readonly title = computed(() => {
    const xml = this.xml();
    if (!xml) {
      return 'Detalhe da nota fiscal';
    }
    const numero = xml.identificacao?.numero;
    return numero ? `${documentTypeLabel(xml)} nº ${numero}` : documentTypeLabel(xml);
  });

  readonly subtitle = computed(() => {
    const xml = this.xml();
    if (!xml) {
      return '';
    }
    const parts = [
      xml.identificacao?.serie ? `Série ${xml.identificacao.serie}` : '',
      `Emitida em ${formatDate(issueDateOf(xml), true)}`,
      xml.identificacao?.naturezaOperacao ?? '',
    ];
    return parts.filter(Boolean).join(' · ');
  });

  readonly pageButtons = computed<PageButton[]>(() => [
    { label: this.backLabel(), icon: 'arrow-left', variant: 'text', severity: 'secondary', handler: () => this.back() },
    {
      label: 'Copiar chave',
      icon: 'copy',
      variant: 'outlined',
      severity: 'secondary',
      isShow: !!this.xml(),
      handler: () => this.copyKey(),
    },
    {
      label: 'Baixar XML',
      icon: 'download',
      variant: 'outlined',
      isShow: !!this.xml(),
      handler: () => this.downloadXml(),
    },
  ]);

  /** Divergences indexed by product code, to flag the matching rows in the items tab. */
  readonly divergenceByProduct = computed(() => {
    const map = new Map<string, ProductFiscalDivergenceDTO>();
    for (const divergence of this.divergences()) {
      if (divergence.codigoProduto) {
        map.set(divergence.codigoProduto, divergence);
      }
    }
    return map;
  });

  readonly identificacaoFields = computed<InfoField[]>(() => {
    const ide = this.xml()?.identificacao;
    if (!ide) {
      return [];
    }
    return [
      { label: 'Natureza da operação', value: ide.naturezaOperacao },
      { label: 'Modelo', value: ide.modelo ? `${ide.modelo} — ${documentTypeLabel(this.xml()!)}` : null },
      { label: 'Série / Número', value: [ide.serie, ide.numero].filter(Boolean).join(' / ') },
      { label: 'Tipo de operação', value: tipoOperacaoLabel(ide.tipoOperacao) },
      { label: 'Data de emissão', value: formatDate(ide.dataEmissao, true) },
      { label: 'Data de saída/entrada', value: ide.dataSaidaEntrada ? formatDate(ide.dataSaidaEntrada, true) : null },
      { label: 'Destino da operação', value: destinoLabel(ide.destinoOperacao) },
      { label: 'Finalidade', value: finalidadeLabel(ide.finalidadeEmissao) },
      { label: 'Consumidor final', value: ide.consumidorFinal === '1' ? 'Sim' : ide.consumidorFinal === '0' ? 'Não' : null },
      { label: 'Presença do comprador', value: presencaLabel(ide.indicadorPresenca) },
      { label: 'Tipo de emissão', value: tipoEmissaoLabel(ide.tipoEmissao) },
      { label: 'Ambiente', value: ambienteLabel(ide.ambiente) },
      { label: 'Versão do emissor', value: ide.versaoProcessoEmissao },
      { label: 'Origem no Taxify', value: this.originText() },
    ].filter((field) => !!field.value);
  });

  /** "SEFAZ · também no SIEG desde 20/11/2026 10:00" - de onde a nota veio e quando cada fonte a trouxe. */
  private originText(): string | null {
    const nota = this.xml();
    if (!nota?.origem) {
      return null;
    }
    const parts = [ORIGIN_LABELS[nota.origem] ?? nota.origem];
    if (nota.encontradaSiegEm && nota.origem !== 'SIEG') {
      parts.push(`também no SIEG desde ${formatDate(nota.encontradaSiegEm, true)}`);
    }
    if (nota.encontradaSefazEm && nota.origem !== 'SEFAZ_DIST') {
      parts.push(`também na SEFAZ desde ${formatDate(nota.encontradaSefazEm, true)}`);
    }
    return parts.join(' · ');
  }

  readonly emitenteFields = computed<InfoField[]>(() => {
    const emit = this.xml()?.emitente;
    if (!emit) {
      return [];
    }
    return [
      { label: emit.cpf && !emit.cnpj ? 'CPF' : 'CNPJ', value: formatDocument(emit.cnpj || emit.cpf || this.xml()?.issuerCnpj), mono: true },
      { label: 'Inscrição estadual', value: emit.inscricaoEstadual, mono: true },
      { label: 'IE substituto tributário', value: emit.inscricaoEstadualSubstitutoTributario, mono: true },
      { label: 'Inscrição municipal', value: emit.inscricaoMunicipal, mono: true },
      { label: 'CNAE', value: emit.cnae, mono: true },
      { label: 'Regime tributário', value: regimeLabel(emit.regimeTributario) },
      { label: 'Telefone', value: emit.endereco?.telefone },
    ].filter((field) => !!field.value);
  });

  readonly destinatarioFields = computed<InfoField[]>(() => {
    const dest = this.xml()?.destinatario;
    if (!dest) {
      return [];
    }
    return [
      {
        label: dest.cpf && !dest.cnpj ? 'CPF' : dest.idEstrangeiro ? 'ID estrangeiro' : 'CNPJ',
        value: formatDocument(dest.cnpj || dest.cpf || this.xml()?.recipientCnpj) || dest.idEstrangeiro,
        mono: true,
      },
      { label: 'Inscrição estadual', value: dest.inscricaoEstadual, mono: true },
      { label: 'Indicador IE', value: indicadorIeLabel(dest.indicadorIe) },
      { label: 'E-mail', value: dest.email },
      { label: 'Telefone', value: dest.endereco?.telefone },
    ].filter((field) => !!field.value);
  });

  readonly composicao = computed<AmountLine[]>(() => {
    const t = this.xml()?.totais;
    if (!t) {
      return [];
    }
    const lines: AmountLine[] = [
      { label: 'Valor dos produtos', value: t.valorProdutos },
      { label: 'Frete', value: t.valorFrete, sign: '+' },
      { label: 'Seguro', value: t.valorSeguro, sign: '+' },
      { label: 'Outras despesas', value: t.valorOutrasDespesas, sign: '+' },
      { label: 'IPI', value: t.valorIpi, sign: '+' },
      { label: 'ICMS ST', value: t.valorIcmsSt, sign: '+' },
      { label: 'FCP ST', value: t.valorFcpSt, sign: '+' },
      { label: 'Imposto de importação', value: t.valorImportacao, sign: '+' },
      { label: 'Desconto', value: t.valorDesconto, sign: '-' },
      { label: 'ICMS desonerado', value: t.valorIcmsDesonerado, sign: '-' },
    ];
    // Zero lines are noise on a breakdown — keep the products line regardless.
    return lines.filter((line, index) => index === 0 || (line.value ?? 0) !== 0);
  });

  readonly tributos = computed<AmountLine[]>(() => {
    const t = this.xml()?.totais;
    if (!t) {
      return [];
    }
    return [
      { label: 'Base de cálculo ICMS', value: t.baseCalculoIcms },
      { label: 'ICMS', value: t.valorIcms, strong: true },
      { label: 'FCP', value: t.valorFcp },
      { label: 'Base de cálculo ICMS ST', value: t.baseCalculoIcmsSt },
      { label: 'ICMS ST', value: t.valorIcmsSt, strong: true },
      { label: 'IPI', value: t.valorIpi, strong: true },
      { label: 'PIS', value: t.valorPis, strong: true },
      { label: 'COFINS', value: t.valorCofins, strong: true },
      { label: 'Tributos aproximados (Lei 12.741)', value: t.valorAproximadoTributos },
    ];
  });

  readonly prettyXml = computed(() => {
    const content = this.xmlContent();
    return content ? prettyXml(content) : '';
  });

  // Formatting helpers exposed to the template.
  readonly formatAccessKey = formatAccessKey;
  readonly formatAddress = formatAddress;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly formatNcm = formatNcm;
  readonly formatNumber = formatNumber;
  readonly formatPercent = formatPercent;
  readonly tipoOperacaoLabel = tipoOperacaoLabel;
  readonly directionLabels = DIRECTION_LABELS;
  readonly ambienteLabel = ambienteLabel;
  readonly finalidadeLabel = finalidadeLabel;
  readonly documentTypeLabel = documentTypeLabel;
  readonly issuerDocument = issuerDocument;
  readonly recipientDocument = recipientDocument;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.fiscalXmlService
      .getDetail(id)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (detail) => {
          this.xml.set(detail);
          this.loading.set(false);
          // Divergences drive the badge in the header, so they load up front.
          this.loadDivergences();
          this.loadAuditLogs();
        },
        error: () => {
          this.loading.set(false);
          this.notFound.set(true);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
    }
  }

  back(): void {
    if (this.cameFrom) {
      this.router.navigateByUrl(this.cameFrom);
    } else {
      this.router.navigate(['/notas-fiscais']);
    }
  }

  /** "Voltar para Fronteira PE"; sem origem conhecida, para a lista de notas. */
  backLabel(): string {
    const path = (this.cameFrom ?? '/notas-fiscais').split(/[?#]/)[0];
    const screen = BACK_TARGETS.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1];
    return screen ? `Voltar para ${screen}` : 'Voltar';
  }

  private sourceUrl(): string | null {
    const navigation = this.router.getCurrentNavigation() ?? this.router.lastSuccessfulNavigation;
    const previous = navigation?.previousNavigation?.finalUrl;
    if (!previous) {
      return null;
    }
    const url = this.router.serializeUrl(previous);
    // a própria nota (recarregou) ou o login não são "de onde veio"
    return url.startsWith('/auth') || url === this.router.serializeUrl(navigation!.finalUrl ?? previous) ? null : url;
  }

  selectTab(tab: DetailTab): void {
    this.tab.set(tab);
    if (tab === 'produtos') {
      this.loadProdutos();
    } else if (tab === 'xml') {
      this.loadXmlContent();
    } else if (tab === 'pdf') {
      this.loadPdf();
    } else if (tab === 'eventos') {
      this.loadEvents();
    }
  }

  // Conferência da nota.
  readonly reviewSaving = signal(false);
  readonly divergenceOpen = signal(false);
  readonly divergenceNote = signal('');
  readonly reviewLabel = (status: ReviewStatus): string => REVIEW_LABELS[status];

  openDivergence(): void {
    this.divergenceNote.set(this.xml()?.reviewNote ?? '');
    this.divergenceOpen.set(true);
  }

  review(status: ReviewStatus): void {
    const documentId = this.documentId();
    if (!documentId) {
      return;
    }
    this.reviewSaving.set(true);
    const note = status === 'DIVERGENT' ? this.divergenceNote().trim() : null;
    this.fiscalXmlService.review(documentId, status, note).subscribe({
      next: (detail) => {
        this.xml.set(detail);
        this.reviewSaving.set(false);
        this.divergenceOpen.set(false);
        this.loadAuditLogs();
      },
      error: () => this.reviewSaving.set(false),
    });
  }

  // Eventos SEFAZ (cancelamento, carta de correção...) - carregados ao abrir a aba.
  readonly events = signal<FiscalXmlEventDTO[] | null>(null);
  readonly eventsLoading = signal(false);
  readonly eventLabel = (type: string): string => EVENT_LABELS[type] ?? `Evento ${type}`;

  private loadEvents(): void {
    const documentId = this.documentId();
    if (this.events() || this.eventsLoading() || !documentId) {
      return;
    }
    this.eventsLoading.set(true);
    this.fiscalXmlService
      .getEvents(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (events) => {
          this.events.set(events);
          this.eventsLoading.set(false);
        },
        error: () => this.eventsLoading.set(false),
      });
  }

  loadPdf(): void {
    const documentId = this.documentId();
    if (this.pdfObjectUrl || this.pdfLoading() || !documentId) {
      return;
    }
    this.pdfLoading.set(true);
    this.pdfError.set(false);
    this.fiscalXmlService
      .downloadPdf(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (blob) => {
          this.pdfBlob = new Blob([blob], { type: 'application/pdf' });
          this.pdfObjectUrl = URL.createObjectURL(this.pdfBlob);
          this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl));
          this.pdfLoading.set(false);
        },
        error: () => {
          this.pdfLoading.set(false);
          this.pdfError.set(true);
        },
      });
  }

  openPdfInNewTab(): void {
    if (this.pdfObjectUrl) {
      window.open(this.pdfObjectUrl, '_blank', 'noopener');
    }
  }

  downloadPdf(): void {
    if (this.pdfBlob) {
      downloadBlob(this.pdfBlob, `${this.accessKey() || 'nota-fiscal'}.pdf`);
    }
  }

  private loadProdutos(): void {
    const documentId = this.documentId();
    if (this.produtosLoaded || !documentId) {
      return;
    }
    this.produtosLoaded = true;
    this.produtosLoading.set(true);
    this.fiscalXmlService
      .getProdutos(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (produtos) => {
          this.produtos.set(produtos);
          this.produtosLoading.set(false);
        },
        error: () => {
          this.produtosLoaded = false;
          this.produtosLoading.set(false);
        },
      });
  }

  private loadXmlContent(): void {
    const documentId = this.documentId();
    if (this.xmlLoaded || !documentId) {
      return;
    }
    this.xmlLoaded = true;
    this.xmlLoading.set(true);
    this.fiscalXmlService
      .getXml(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (content) => {
          this.xmlContent.set(content);
          this.xmlLoading.set(false);
        },
        error: () => this.xmlLoading.set(false),
      });
  }

  toggleItem(index: number): void {
    const next = new Set(this.expandedItems());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.expandedItems.set(next);
  }

  divergenceFor(produto: FiscalXmlProdutoDTO): ProductFiscalDivergenceDTO | undefined {
    return produto.codigo ? this.divergenceByProduct().get(produto.codigo) : undefined;
  }

  copyKey(): void {
    copyToClipboard(this.accessKey()).then(() => this.toastr.success('Chave de acesso copiada.'));
  }

  copyXml(): void {
    const content = this.xmlContent();
    if (content) {
      copyToClipboard(content).then(() => this.toastr.success('XML copiado.'));
    }
  }

  downloadXml(): void {
    const documentId = this.documentId();
    if (!documentId) {
      return;
    }
    const fileName = `${this.accessKey() || 'nota-fiscal'}.xml`;
    const content = this.xmlContent();
    if (content) {
      downloadBlob(new Blob([content], { type: 'application/xml' }), fileName);
      return;
    }
    this.fiscalXmlService
      .downloadXml(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe((blob) => downloadBlob(blob, fileName));
  }

  // ---------------------------------------------------------------------------
  // Divergências / retificação
  // ---------------------------------------------------------------------------

  private loadDivergences(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    const issueDate = issueDateOf(this.xml()!)?.slice(0, 10);

    this.divergencesLoading.set(true);
    this.productFiscalRuleService
      .divergencias(companyId, issueDate, issueDate)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (divergences) => {
          this.divergences.set(divergences.filter((d) => d.accessKey === this.accessKey()));
          this.divergencesLoading.set(false);
        },
        error: () => this.divergencesLoading.set(false),
      });

    this.findingsLoading.set(true);
    this.productFiscalRuleService
      .conferencia(companyId, issueDate, issueDate)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (findings) => {
          this.findings.set(
            findings.filter((f) => f.documentId === this.documentId() && f.codigo !== 'RULE_CFOP' && f.codigo !== 'RULE_NCM'),
          );
          this.findingsLoading.set(false);
        },
        error: () => this.findingsLoading.set(false),
      });
  }

  async retificar(): Promise<void> {
    const documentId = this.documentId();
    if (!documentId) {
      return;
    }
    if (!(await this.confirmDialog.ask('Gerar uma versão retificada desta nota aplicando as regras fiscais cadastradas (CFOP, NCM e códigos tributários)? Alíquotas e valores não são alterados. O XML original é preservado.', { title: 'Retificar nota', confirmLabel: 'Gerar versão retificada' }))) {
      return;
    }

    this.rectifying.set(true);
    this.fiscalXmlService
      .retificar(documentId)
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (result) => {
          this.rectifying.set(false);
          this.rectificationResult.set(result);
          // The rectification is logged server-side: refresh the Auditoria tab and its count,
          // and the divergences, which the rectified version no longer has.
          this.loadAuditLogs();
          this.loadDivergences();
        },
        error: () => this.rectifying.set(false),
      });
  }

  closeRectificationResult(): void {
    this.rectificationResult.set(null);
  }

  // ---------------------------------------------------------------------------
  // Auditoria
  // ---------------------------------------------------------------------------

  loadAuditLogs(): void {
    const companyId = this.companyId();
    if (!companyId || !this.accessKey()) {
      this.auditLogs.set([]);
      return;
    }

    this.auditLoading.set(true);
    this.invoiceAuditLogService
      .getAll({ page: 0, size: 50 }, { companyId, externalInvoiceKey: this.accessKey() })
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (page) => {
          this.auditLogs.set(page.content);
          this.auditLoading.set(false);
        },
        error: () => this.auditLoading.set(false),
      });
  }

  openCreateAuditForm(): void {
    this.resetAuditForm();
    this.auditFormDialogOpen.set(true);
  }

  pickStatus(status: InvoiceAuditStatus): void {
    this.auditForm.controls.status.setValue(status);
  }

  closeAuditForm(): void {
    this.auditFormDialogOpen.set(false);
    this.resetAuditForm();
  }

  private resetAuditForm(): void {
    this.auditForm.reset({ status: '', notes: '' });
  }

  saveAudit(): void {
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      return;
    }

    const { status, notes } = this.auditForm.getRawValue();

    const companyId = this.companyId();
    if (!companyId) {
      return;
    }

    this.invoiceAuditLogService
      .create({ externalInvoiceKey: this.accessKey(), companyId, status: status as InvoiceAuditStatus, notes })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.closeAuditForm();
        this.loadAuditLogs();
      });
  }

  statusClass(status?: InvoiceAuditStatus): string {
    switch (status) {
      case 'OK':
      case 'RECTIFIED':
        return 'status-ok';
      case 'DIVERGENT':
      case 'CANCELED':
      case 'REJECTED':
        return 'status-bad';
      case 'PENDING_DOCUMENTATION':
      case 'NEEDS_RECTIFICATION':
        return 'status-warn';
      default:
        return '';
    }
  }
}
