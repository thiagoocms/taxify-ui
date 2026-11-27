import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBuilding, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { Modal } from '../../../shared/components/modal/modal';
import { Page } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { FIRM_STATUS_LABELS, FirmAccessStatus } from '../../../core/models/firm-access.model';
import {
  PLATFORM_EVENT_LABELS,
  PlatformFirmContactRequestDTO,
  PlatformFirmEventDTO,
  PlatformFirmRowDTO,
} from '../../../core/models/platform-firm.model';
import { apiErrorCode, apiErrorMessage, httpStatusOf } from '../../../core/models/api-error.model';
import { SIGNUP_ERRORS } from '../../../core/models/signup.model';
import { PlatformFirmService } from '../../../core/services/platform-firm.service';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { formatDocument, onlyDigits } from '../../../shared/utils/document-mask';
import { formatLocalDate, formatLocalDateTime, formatPhone } from '../../../shared/utils/format';
import { cnpjValidator, phoneValidator } from '../../../shared/utils/validators';
import {
  availableActions,
  eventChanges,
  PlatformActionSpec,
  situationText,
  situationTone,
  todayIso,
} from './platform-actions';

const PAGE_SIZE = 50;

type ContactField = 'documentNumber' | 'billingEmail' | 'contactPhone';

/** Erros do PUT /contact: o campo marcado e o texto padrão (se a API não mandar mensagem). */
const CONTACT_FIELD_ERRORS: Record<string, { field: ContactField; message: string }> = {
  [SIGNUP_ERRORS.firmDocumentInvalid]: { field: 'documentNumber', message: 'CNPJ inválido: confira os dígitos.' },
  [SIGNUP_ERRORS.firmDocumentExists]: { field: 'documentNumber', message: 'Este CNPJ já é de outro escritório.' },
  [SIGNUP_ERRORS.billingEmailInvalid]: { field: 'billingEmail', message: 'E-mail financeiro inválido.' },
  [SIGNUP_ERRORS.phoneInvalid]: { field: 'contactPhone', message: 'Informe DDD + número (10 ou 11 dígitos).' },
};

const CONTACT_LABELS: Record<ContactField, string> = {
  documentNumber: 'CNPJ',
  billingEmail: 'E-mail financeiro',
  contactPhone: 'Telefone',
};

const STATUS_FILTERS: FirmAccessStatus[] = ['TRIAL', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'CANCELED', 'PENDING_VERIFICATION'];

/**
 * Console da plataforma (F1-RN-14 e F1-RN-15): os escritórios com a situação de acesso, os contatos dos ADMIN e as
 * contagens; as ações (estender o teste, converter, liberar, suspender, reativar, cancelar, revisar) com confirmação,
 * data e motivo; e a trilha de cada escritório.
 */
@Component({
  selector: 'app-platform-firms',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, Button, InputComponent, LoaderComponent, Modal, Page, Pagination, Table, Toggle],
  templateUrl: './platform-firms.component.html',
  styleUrl: './platform-firms.component.scss',
})
export class PlatformFirmsComponent implements OnInit {
  private readonly service = inject(PlatformFirmService);
  private readonly firmAccess = inject(FirmAccessService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todas as situações' },
    ...STATUS_FILTERS.map((status) => ({ value: status, label: FIRM_STATUS_LABELS[status] })),
  ];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<FirmAccessStatus | ''>('', { nonNullable: true });
  readonly unreviewedControl = new FormControl(false, { nonNullable: true });

  private readonly firmCell = viewChild.required<TemplateRef<unknown>>('firmCell');
  private readonly situationCell = viewChild.required<TemplateRef<unknown>>('situationCell');
  private readonly contactCell = viewChild.required<TemplateRef<unknown>>('contactCell');

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Escritório', cellTemplate: this.firmCell() },
    { name: 'Situação e revisão', cellTemplate: this.situationCell() },
    {
      name: 'Empresas (em uso / inativas)',
      property: 'companiesInUse',
      cellClass: 'value-cell',
      format: (_: number, row: PlatformFirmRowDTO) => `${row.companiesInUse} / ${row.companiesInactive}`,
    },
    { name: 'Usuários', property: 'usersInUse', cellClass: 'value-cell' },
    { name: 'Contato (ADMIN)', cellTemplate: this.contactCell() },
  ]);

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [{ name: 'manage', label: 'Gerenciar', variant: 'outlined', handler: (row: PlatformFirmRowDTO) => this.open(row) }],
  };

  readonly emptyIcon = faBuilding;
  readonly errorIcon = faTriangleExclamation;

  readonly rows = signal<PlatformFirmRowDTO[]>([]);
  readonly loading = signal(false);
  /** Primeira página já chegou: daí em diante, recarregar mostra o véu por cima da tabela. */
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);

  // ------------------------------------------------------------ Gerenciar --
  readonly selected = signal<PlatformFirmRowDTO | null>(null);
  readonly events = signal<PlatformFirmEventDTO[] | null>(null);
  readonly eventsError = signal<string | null>(null);
  readonly pendingAction = signal<PlatformActionSpec | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly applying = signal(false);
  readonly dateControl = new FormControl('', { nonNullable: true });
  readonly reasonControl = new FormControl('', { nonNullable: true });
  readonly today = todayIso();

  // ------------------------------------------------- Dados do escritório --
  readonly contactOpen = signal(false);
  readonly savingContact = signal(false);
  readonly contactError = signal<string | null>(null);
  readonly contactForm = this.fb.nonNullable.group({
    documentNumber: ['', [cnpjValidator]],
    billingEmail: ['', [Validators.email, Validators.maxLength(300)]],
    contactPhone: ['', [phoneValidator]],
  });

  readonly formatDocument = formatDocument;
  readonly formatDate = formatLocalDate;
  readonly formatDateTime = formatLocalDateTime;
  readonly formatPhone = formatPhone;
  readonly situationText = situationText;
  readonly situationTone = situationTone;
  readonly availableActions = availableActions;
  readonly eventChanges = eventChanges;

  ngOnInit(): void {
    this.load();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadFromFirstPage());
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reloadFromFirstPage());
    this.unreviewedControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reloadFromFirstPage());
  }

  private reloadFromFirstPage(): void {
    this.pageIndex.set(0);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service
      .getAll(
        { page: this.pageIndex(), size: PAGE_SIZE },
        { q: this.searchControl.value, status: this.statusControl.value, unreviewed: this.unreviewedControl.value },
      )
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            httpStatusOf(error) === 403
              ? 'Só o administrador da plataforma (CS Hub) abre este console.'
              : 'Não foi possível carregar os escritórios. Tente de novo em instantes.',
          );
        },
      });
  }

  onPageIndexChange(index: number): void {
    this.pageIndex.set(index);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.statusControl.setValue('', { emitEvent: false });
    this.unreviewedControl.setValue(false, { emitEvent: false });
    this.reloadFromFirstPage();
  }

  /** Todos os ADMIN, para o title da linha de contato (a célula mostra só o primeiro). */
  adminsText(row: PlatformFirmRowDTO): string {
    return row.admins.map((admin) => `${admin.name} <${admin.email}>`).join('\n');
  }

  /** Segunda linha do contato: telefone e e-mail financeiro. */
  contactText(row: PlatformFirmRowDTO): string {
    return `Tel.: ${formatPhone(row.contactPhone)} · Financeiro: ${row.billingEmail || '—'}`;
  }

  reviewText(row: PlatformFirmRowDTO): string {
    if (row.reviewed) {
      const when = row.reviewedAt ? ` em ${formatLocalDateTime(row.reviewedAt)}` : '';
      const who = row.reviewedBy ? ` por ${row.reviewedBy}` : '';
      return `Revisado${when}${who}`;
    }
    return row.migrated ? 'Não revisado (migração)' : 'Não revisado';
  }

  // ------------------------------------------------------------ Gerenciar --
  open(row: PlatformFirmRowDTO): void {
    this.selected.set(row);
    this.cancelAction();
    this.closeContact();
    this.loadEvents(row.id);
  }

  close(): void {
    this.selected.set(null);
    this.events.set(null);
    this.cancelAction();
    this.closeContact();
  }

  // ------------------------------------------------- Dados do escritório --
  /** Cadastro ainda não confirmado: o backend recusa (é apagado em 7 dias se não confirmar). */
  canEditContact(row: PlatformFirmRowDTO): boolean {
    return row.status !== 'PENDING_VERIFICATION';
  }

  openContact(): void {
    const row = this.selected();
    if (!row || !this.canEditContact(row)) {
      return;
    }
    this.cancelAction();
    this.contactError.set(null);
    this.contactForm.reset({
      documentNumber: row.documentNumber ?? '',
      billingEmail: row.billingEmail ?? '',
      contactPhone: row.contactPhone ?? '',
    });
    this.contactOpen.set(true);
  }

  closeContact(): void {
    this.contactOpen.set(false);
    this.contactError.set(null);
  }

  /** Só os campos alterados vão no corpo (nulo/ausente mantém o valor no backend). */
  private contactChanges(row: PlatformFirmRowDTO): PlatformFirmContactRequestDTO {
    const value = this.contactForm.getRawValue();
    const body: PlatformFirmContactRequestDTO = {};
    const cnpj = onlyDigits(value.documentNumber);
    if (cnpj !== onlyDigits(row.documentNumber)) body.documentNumber = cnpj;
    const email = value.billingEmail.trim();
    if (email.toLowerCase() !== (row.billingEmail ?? '').toLowerCase()) body.billingEmail = email;
    const phone = onlyDigits(value.contactPhone);
    if (phone !== onlyDigits(row.contactPhone)) body.contactPhone = phone;
    return body;
  }

  private contactValueText(field: ContactField, value: string | null | undefined): string {
    if (!value) return '—';
    if (field === 'documentNumber') return formatDocument(value);
    if (field === 'contactPhone') return formatPhone(value);
    return value;
  }

  async saveContact(): Promise<void> {
    const row = this.selected();
    if (!row || this.savingContact()) {
      return;
    }
    this.contactError.set(null);
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    const body = this.contactChanges(row);
    const fields = Object.keys(body) as ContactField[];
    if (!fields.length) {
      this.contactError.set('Nada foi alterado.');
      return;
    }
    // O backend não apaga valor (campo vazio = manter): avisa em vez de mandar vazio.
    const cleared = fields.filter((field) => !body[field]);
    if (cleared.length) {
      this.contactError.set(
        `Não dá para apagar ${cleared.map((field) => CONTACT_LABELS[field]).join(', ')}: informe um valor novo ou mantenha o atual.`,
      );
      return;
    }

    const changes = fields
      .map((field) => `${CONTACT_LABELS[field]}: ${this.contactValueText(field, row[field])} → ${this.contactValueText(field, body[field])}`)
      .join('\n');
    const confirmed = await this.confirmDialog.ask(
      `Alterar os dados de ${row.name}?\n\n${changes}\n\nA alteração fica no histórico. Ela não marca o escritório como revisado.`,
      { title: 'Dados do escritório', confirmLabel: 'Salvar dados' },
    );
    if (!confirmed) {
      return;
    }

    this.savingContact.set(true);
    this.service.updateContact(row.id, body).subscribe({
      next: (updated) => {
        this.savingContact.set(false);
        this.rows.update((rows) => rows.map((item) => (item.id === updated.id ? updated : item)));
        this.selected.set(updated);
        this.closeContact();
        this.loadEvents(updated.id);
        this.toastr.success('Dados do escritório salvos.', updated.name);
      },
      error: (error: unknown) => {
        this.savingContact.set(false);
        this.showContactError(error);
      },
    });
  }

  private showContactError(error: unknown): void {
    const code = apiErrorCode(error);
    const message = apiErrorMessage(error);
    const mapped = code ? CONTACT_FIELD_ERRORS[code] : undefined;
    if (mapped) {
      const control = this.contactForm.controls[mapped.field];
      const text = message ?? mapped.message;
      control.setErrors({ ...(control.errors ?? {}), server: text });
      control.markAsTouched();
      this.contactError.set(text);
      return;
    }
    if (code === 'error.platform.action.invalid') {
      this.contactError.set(message ?? 'O cadastro ainda não confirmou o e-mail: os dados não podem ser alterados agora.');
      return;
    }
    const status = httpStatusOf(error);
    this.contactError.set(
      message ??
        (status === 404
          ? 'Escritório não encontrado. Atualize a lista.'
          : status === 0
            ? 'Não foi possível falar com o Taxify. Verifique sua internet.'
            : 'Não foi possível salvar os dados. Tente de novo.'),
    );
  }

  private loadEvents(id: string): void {
    this.events.set(null);
    this.eventsError.set(null);
    this.service.getEvents(id).subscribe({
      next: (events) => this.events.set(events),
      error: () => {
        this.events.set([]);
        this.eventsError.set('Não foi possível carregar o histórico.');
      },
    });
  }

  eventLabel(type: string): string {
    return PLATFORM_EVENT_LABELS[type] ?? type;
  }

  startAction(spec: PlatformActionSpec): void {
    this.closeContact();
    this.pendingAction.set(spec);
    this.actionError.set(null);
    this.dateControl.setValue('');
    this.reasonControl.setValue('');
  }

  cancelAction(): void {
    this.pendingAction.set(null);
    this.actionError.set(null);
  }

  async confirmAction(): Promise<void> {
    const row = this.selected();
    const spec = this.pendingAction();
    if (!row || !spec || this.applying()) {
      return;
    }
    const date = this.dateControl.value.trim();
    const reason = this.reasonControl.value.trim();
    if (spec.dateRequired && !date) {
      this.actionError.set('Informe a data.');
      return;
    }
    if (date && date < this.today) {
      this.actionError.set('A data não pode ser anterior a hoje.');
      return;
    }
    if (spec.reasonRequired && !reason) {
      this.actionError.set('Informe o motivo: ele fica gravado no histórico do escritório.');
      return;
    }

    const details = [
      date ? `${spec.dateLabel?.replace(/ \(.*\)$/, '')}: ${formatLocalDate(date)}` : spec.dateHint ?? '',
      reason ? `Motivo: ${reason}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const message = `${spec.label} - ${row.name}?\n\n${spec.description}${details ? `\n\n${details}` : ''}`;
    const confirmed = await this.confirmDialog.ask(message, {
      title: spec.label,
      confirmLabel: spec.label,
      danger: spec.danger ?? false,
    });
    if (!confirmed) {
      return;
    }

    this.applying.set(true);
    this.actionError.set(null);
    this.service
      .applyAction(row.id, spec.action, {
        trialEndsOn: spec.dateField === 'trialEndsOn' && date ? date : null,
        accessUntil: spec.dateField === 'accessUntil' && date ? date : null,
        reason: reason || null,
      })
      .subscribe({
        next: (updated) => {
          this.applying.set(false);
          this.rows.update((rows) => rows.map((item) => (item.id === updated.id ? updated : item)));
          this.selected.set(updated);
          this.pendingAction.set(null);
          this.loadEvents(updated.id);
          this.toastr.success(`${spec.label}: ${situationText(updated)}.`, updated.name);
          // A ação pode ter sido no próprio escritório do admin: atualiza a faixa.
          this.firmAccess.reload();
        },
        error: (error: unknown) => {
          this.applying.set(false);
          const status = httpStatusOf(error);
          this.actionError.set(
            apiErrorMessage(error) ??
              (status === 404
                ? 'Escritório não encontrado. Atualize a lista.'
                : status === 0
                  ? 'Não foi possível falar com o Taxify. Verifique sua internet.'
                  : 'Não foi possível aplicar a ação. Tente de novo.'),
          );
        },
      });
  }
}
