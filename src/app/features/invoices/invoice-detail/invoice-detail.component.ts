import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { FiscalXmlDetailDTO, FiscalXmlProdutoDTO, FiscalXmlRectificationResultDTO } from '../../../core/models/fiscal-xml.model';
import { InvoiceAuditLogDTO } from '../../../core/models/invoice-audit-log.model';
import { ProductFiscalDivergenceDTO } from '../../../core/models/product-fiscal-rule.model';
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

type DetailTab = 'resumo' | 'produtos' | 'totais' | 'divergencias' | 'auditoria' | 'xml';

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

const AUDIT_STATUS_SUGGESTIONS = ['Conferida', 'Pendente', 'Com divergência', 'Retificada', 'Cancelada'];

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

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent, Button, InputComponent, Modal, Page, Table],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss',
})
export class InvoiceDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly authService = inject(AuthService);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly invoiceAuditLogService = inject(InvoiceAuditLogService);
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

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

  readonly divergences = signal<ProductFiscalDivergenceDTO[]>([]);
  readonly divergencesLoading = signal(false);
  readonly rectifying = signal(false);
  readonly rectificationResult = signal<FiscalXmlRectificationResultDTO | null>(null);

  readonly auditLogs = signal<InvoiceAuditLogDTO[]>([]);
  readonly auditLoading = signal(false);
  readonly editingLog = signal<InvoiceAuditLogDTO | null>(null);
  readonly auditFormDialogOpen = signal(false);
  readonly statusSuggestions = AUDIT_STATUS_SUGGESTIONS;

  readonly auditForm = this.fb.group({
    status: this.fb.nonNullable.control('', Validators.required),
    notes: this.fb.nonNullable.control('', Validators.required),
  });

  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');

  readonly auditColumns = computed<TableColumn[]>(() => [
    { name: 'Status', cellTemplate: this.statusCell(), width: '180px' },
    { name: 'Observações', property: 'notes', cellTextLength: 120 },
  ]);

  readonly auditTableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.editAuditEntry(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.removeAuditEntry(row) },
    ],
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
    { label: 'Voltar', icon: 'arrow-left', variant: 'text', severity: 'secondary', handler: () => this.back() },
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
    ].filter((field) => !!field.value);
  });

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
  }

  back(): void {
    this.router.navigate(['/notas-fiscais']);
  }

  selectTab(tab: DetailTab): void {
    this.tab.set(tab);
    if (tab === 'produtos') {
      this.loadProdutos();
    } else if (tab === 'xml') {
      this.loadXmlContent();
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
  }

  retificar(): void {
    const documentId = this.documentId();
    if (!documentId) {
      return;
    }
    if (!confirm('Gerar uma versão retificada desta nota aplicando o CFOP/NCM das regras fiscais cadastradas? O XML original é preservado.')) {
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

  editAuditEntry(log: InvoiceAuditLogDTO): void {
    this.editingLog.set(log);
    this.auditForm.setValue({ status: log.status, notes: log.notes });
    this.auditFormDialogOpen.set(true);
  }

  pickStatus(status: string): void {
    this.auditForm.controls.status.setValue(status);
  }

  closeAuditForm(): void {
    this.auditFormDialogOpen.set(false);
    this.resetAuditForm();
  }

  private resetAuditForm(): void {
    this.editingLog.set(null);
    this.auditForm.reset({ status: '', notes: '' });
  }

  saveAudit(): void {
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      return;
    }

    const { status, notes } = this.auditForm.getRawValue();
    const log = this.editingLog();

    if (log) {
      this.invoiceAuditLogService
        .update(log.id!, { ...log, status, notes })
        .pipe(takeUntil(this.destroyed$))
        .subscribe(() => {
          this.closeAuditForm();
          this.loadAuditLogs();
        });
      return;
    }

    const companyId = this.companyId();
    const userId = this.authService.userId();
    if (!companyId || !userId) {
      return;
    }

    this.invoiceAuditLogService
      .create({ externalInvoiceKey: this.accessKey(), userId, companyId, status, notes })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.closeAuditForm();
        this.loadAuditLogs();
      });
  }

  removeAuditEntry(log: InvoiceAuditLogDTO): void {
    if (!confirm('Remover este registro de auditoria?')) {
      return;
    }

    this.invoiceAuditLogService
      .delete(log.id!)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.loadAuditLogs());
  }

  statusClass(status?: string): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized.includes('conferid') || normalized.includes('ok') || normalized.includes('retificad')) {
      return 'status-ok';
    }
    if (normalized.includes('diverg') || normalized.includes('cancel') || normalized.includes('erro')) {
      return 'status-bad';
    }
    if (normalized.includes('pend')) {
      return 'status-warn';
    }
    return '';
  }
}
