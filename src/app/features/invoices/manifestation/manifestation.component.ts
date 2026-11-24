import { HelpTipComponent } from '../../../shared/help/help-tip.component';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../../core/models/company.model';
import {
  MANIFESTATION_LABELS,
  ManifestationNoteDTO,
  ManifestationPendingDTO,
  ManifestationResultDTO,
  ManifestationType,
} from '../../../core/models/fiscal-xml.model';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CurrentCompanyService } from '../../../core/services/current-company.service';
import { FiscalXmlService } from '../../../core/services/fiscal-xml.service';
import { Button } from '../../../shared/components/button/button';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { formatDocument } from '../../../shared/utils/document-mask';
import { formatCurrency } from '../../../shared/utils/format';
import { LoaderComponent } from '../../../shared/components/loader/loader';

/** Atalhos que filtram a lista. */
type QuickFilter = 'DEADLINE' | 'NO_CIENCIA' | 'CIENCIA' | 'SUMMARY';

const DEADLINE_WARNING_DAYS = 15;

/**
 * Manifestação do destinatário: as entradas que ainda devem uma manifestação conclusiva
 * (confirmação, desconhecimento ou operação não realizada — prazo de 180 dias da autorização),
 * com envio em lote assinado pelo A1 da empresa. Mesmo desenho da Apuração: resumo, atalhos e tabela.
 */
@Component({
  selector: 'app-manifestation',
  standalone: true,
  imports: [LoaderComponent, CommonModule, FormsModule, ReactiveFormsModule, RouterLink, FaIconComponent, Button, InputComponent, Modal, Page, Table, HelpTipComponent],
  templateUrl: './manifestation.component.html',
  styleUrl: './manifestation.component.scss',
})
export class ManifestationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly currentCompany = inject(CurrentCompanyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly toastr = inject(ToastrService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly auth = inject(AuthService);

  private readonly deadlineCell = viewChild.required<TemplateRef<unknown>>('deadlineCell');
  private readonly noteCell = viewChild.required<TemplateRef<unknown>>('noteCell');
  private readonly issuerCell = viewChild.required<TemplateRef<unknown>>('issuerCell');
  private readonly dateCell = viewChild.required<TemplateRef<unknown>>('dateCell');
  private readonly valueCell = viewChild.required<TemplateRef<unknown>>('valueCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');

  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly companyId = signal<string | null>(null);
  readonly data = signal<ManifestationPendingDTO | null>(null);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly selected = signal<ManifestationNoteDTO[]>([]);
  readonly quickFilter = signal<QuickFilter | null>(null);
  /** Recusas da SEFAZ do último envio, por chave. */
  readonly failures = signal<Record<string, string>>({});
  readonly notPerformedOpen = signal(false);
  /** Recria a tabela ao recarregar - ela guarda a seleção por objeto e não a limpa sozinha. */
  readonly tableKey = signal(0);
  justification = '';

  protected readonly formatDocument = formatDocument;
  protected readonly formatCurrency = formatCurrency;

  readonly canSend = computed(() => {
    const d = this.data();
    return !!d && d.habilitada && d.certificado && this.auth.can('INVOICES_AUDIT');
  });

  readonly summary = computed(() => {
    const notas = this.data()?.notas ?? [];
    return {
      total: notas.length,
      closeToDeadline: notas.filter((nota) => nota.diasRestantes <= DEADLINE_WARNING_DAYS).length,
      withoutCiencia: notas.filter((nota) => !nota.ciencia).length,
      onlySummary: notas.filter((nota) => !nota.xmlCompleto).length,
      value: notas.reduce((sum, nota) => sum + (nota.valorTotal ?? 0), 0),
    };
  });

  readonly filtered = computed(() => {
    const notas = this.data()?.notas ?? [];
    switch (this.quickFilter()) {
      case 'DEADLINE':
        return notas.filter((nota) => nota.diasRestantes <= DEADLINE_WARNING_DAYS);
      case 'NO_CIENCIA':
        return notas.filter((nota) => !nota.ciencia);
      case 'CIENCIA':
        return notas.filter((nota) => nota.ciencia);
      case 'SUMMARY':
        return notas.filter((nota) => !nota.xmlCompleto);
      default:
        return notas;
    }
  });

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Prazo', cellTemplate: this.deadlineCell(), width: '130px' },
    { name: 'Nota', cellTemplate: this.noteCell() },
    { name: 'Emitente', cellTemplate: this.issuerCell() },
    { name: 'Emissão', cellTemplate: this.dateCell(), width: '110px' },
    { name: 'Valor', cellTemplate: this.valueCell(), headerClass: 'justify-content-end', width: '140px' },
    { name: 'Situação', cellTemplate: this.statusCell(), width: '220px' },
  ]);

  readonly tableConfig = computed<TableConfig>(() => ({ headerVisible: true, selectable: this.canSend(), actions: [] }));

  readonly pageButtons = computed<PageButton[]>(() => {
    const show = this.canSend() && !!this.data()?.notas.length;
    const disabled = !this.selected().length || this.sending();
    return [
      { id: 'manifest-confirm', label: 'Confirmar operação', icon: 'check', isShow: show, isDisabled: disabled,
        handler: () => this.send('CONFIRMACAO') },
      { id: 'manifest-ciencia', label: 'Só ciência', icon: 'eye', variant: 'outlined', isShow: show, isDisabled: disabled,
        handler: () => this.send('CIENCIA') },
      { id: 'manifest-not-performed', label: 'Não realizada', icon: 'ban', variant: 'outlined', isShow: show,
        isDisabled: disabled, handler: () => this.openNotPerformed() },
      { id: 'manifest-unknown', label: 'Desconhecer', icon: 'xmark', variant: 'outlined', severity: 'danger', isShow: show,
        isDisabled: disabled, handler: () => this.send('DESCONHECIMENTO') },
    ];
  });

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  constructor() {
    this.form.controls.company.valueChanges.subscribe((company) => {
      if (company && typeof company === 'object' && company.id && company.id !== this.companyId()) {
        this.companyId.set(company.id);
        this.data.set(null);
        this.failures.set({});
        this.load();
      }
    });
    this.currentCompany.bind(this.form.controls.company, this.destroyRef);
  }

  private load(): void {
    const companyId = this.companyId();
    if (!companyId) {
      return;
    }
    this.loading.set(true);
    this.selected.set([]);
    this.tableKey.update((key) => key + 1);
    this.fiscalXmlService.manifestationPending(companyId).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleQuick(filter: QuickFilter): void {
    this.quickFilter.set(this.quickFilter() === filter ? null : filter);
    this.selected.set([]);
    this.tableKey.update((key) => key + 1);
  }

  openNotPerformed(): void {
    this.justification = '';
    this.notPerformedOpen.set(true);
  }

  sendNotPerformed(): void {
    this.notPerformedOpen.set(false);
    this.dispatch('NAO_REALIZADA', this.justification.trim());
  }

  async send(type: ManifestationType): Promise<void> {
    const count = this.selected().length;
    const warning =
      type === 'DESCONHECIMENTO'
        ? ' Use só para nota que a empresa não reconhece (possível uso indevido do CNPJ) — o emitente é avisado.'
        : type === 'CIENCIA'
          ? ' A ciência libera o XML mas não conclui a manifestação.'
          : '';
    const confirmed = await this.confirmDialog.ask(
      `Enviar "${MANIFESTATION_LABELS[type]}" para ${count} nota(s)? O evento fica registrado na SEFAZ e o emitente vê.${warning}`,
      { title: MANIFESTATION_LABELS[type], confirmLabel: 'Enviar', danger: type === 'DESCONHECIMENTO' },
    );
    if (confirmed) {
      this.dispatch(type);
    }
  }

  private dispatch(type: ManifestationType, justificativa?: string): void {
    const companyId = this.companyId();
    if (!companyId || !this.selected().length) {
      return;
    }
    this.sending.set(true);
    this.fiscalXmlService
      .manifest({ companyId, tipo: type, justificativa, chaves: this.selected().map((nota) => nota.chave) })
      .subscribe({
        next: (result) => this.afterSend(result),
        error: () => this.sending.set(false),
      });
  }

  private afterSend(result: ManifestationResultDTO): void {
    this.sending.set(false);
    const failures: Record<string, string> = {};
    for (const item of result.itens) {
      if (!item.ok) {
        failures[item.chave] = [item.codigo, item.mensagem].filter(Boolean).join(' ');
      }
    }
    if (result.registradas) {
      this.toastr.success(`${result.registradas} manifestação(ões) registrada(s) na SEFAZ.`);
    }
    if (result.recusadas) {
      this.toastr.warning(`${result.recusadas} nota(s) recusada(s) — veja o motivo na lista.`);
    }
    this.load();
    this.failures.set(failures);
  }

  deadlineLabel(nota: ManifestationNoteDTO): string {
    if (nota.diasRestantes < 0) {
      return 'Vencido';
    }
    return nota.diasRestantes === 0 ? 'Vence hoje' : `${nota.diasRestantes} dia(s)`;
  }

  deadlineClass(nota: ManifestationNoteDTO): string {
    if (nota.diasRestantes < 0) {
      return 'late';
    }
    return nota.diasRestantes <= DEADLINE_WARNING_DAYS ? 'soon' : '';
  }
}
