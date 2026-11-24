import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Component, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { BILLING_PROVIDER_LABELS, BillingChargeDTO, CHARGE_STATUS_LABELS, CompanyBillingDTO } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { maskDocument } from '../../../shared/utils/document-mask';

/**
 * Honorários da empresa: situação (em aberto / atrasado), a qual cliente do sistema de
 * cobrança ela está vinculada e as cobranças (mais recentes primeiro). Carrega ao abrir.
 */
import { Button } from '../../../shared/components/button/button';
@Component({
  selector: 'app-company-billing',
  standalone: true,
  imports: [Button, CurrencyPipe, DatePipe, FaIconComponent, FormsModule],
  templateUrl: './company-billing.component.html',
  styleUrl: './company-billing.component.scss',
})
export class CompanyBillingComponent implements OnChanges {
  protected readonly maskDocument = maskDocument;
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly billingService = inject(BillingService);

  @Input() companyId = '';

  readonly chevronIcon = faChevronDown;
  readonly statusLabels = CHARGE_STATUS_LABELS;
  readonly providerLabels = BILLING_PROVIDER_LABELS;
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly billing = signal<CompanyBillingDTO | null>(null);
  private loaded = false;

  readonly canManage = inject(AuthService).can('BILLING_MANAGE');
  readonly saving = signal(false);

  // Cobrança manual: nova (id vazio) ou em edição.
  readonly chargeFormOpen = signal(false);
  chargeForm = this.emptyCharge();

  // Vínculo com o cliente no sistema de cobrança.
  readonly linkFormOpen = signal(false);
  linkForm = { externalId: '', externalName: '', document: '' };

  private emptyCharge() {
    return { id: '', description: '', competenceDate: '', dueDate: '', amount: null as number | null, paidAmount: null as number | null, canceled: false };
  }

  newCharge(): void {
    this.chargeForm = this.emptyCharge();
    this.chargeFormOpen.set(true);
  }

  editCharge(charge: BillingChargeDTO): void {
    this.chargeForm = {
      id: charge.id,
      description: charge.description ?? '',
      competenceDate: charge.competenceDate ? charge.competenceDate.substring(0, 7) : '',
      dueDate: charge.dueDate,
      amount: charge.amount,
      paidAmount: charge.paidAmount ?? null,
      canceled: charge.status === 'CANCELED',
    };
    this.chargeFormOpen.set(true);
  }

  /** Pagamento total de uma vez. */
  markPaid(charge: BillingChargeDTO): void {
    this.run(this.billingService.updateCharge(charge.id, { ...charge, paidAmount: charge.amount }));
  }

  saveCharge(): void {
    const form = this.chargeForm;
    if (!form.dueDate || !form.amount) {
      return;
    }
    const body: Partial<BillingChargeDTO> = {
      companyId: this.companyId,
      description: form.description || null,
      competenceDate: form.competenceDate ? `${form.competenceDate}-01` : null,
      dueDate: form.dueDate,
      amount: form.amount,
      paidAmount: form.paidAmount ?? 0,
      status: form.canceled ? 'CANCELED' : 'OPEN',
    };
    this.run(form.id ? this.billingService.updateCharge(form.id, body) : this.billingService.createCharge(body), () =>
      this.chargeFormOpen.set(false),
    );
  }

  async removeCharge(charge: BillingChargeDTO): Promise<void> {
    if (!(await this.confirmDialog.ask('Excluir esta cobrança manual?', { title: 'Excluir cobrança', confirmLabel: 'Excluir', danger: true }))) {
      return;
    }
    this.run(this.billingService.deleteCharge(charge.id));
  }

  openLinkForm(): void {
    const b = this.billing();
    this.linkForm = { externalId: b?.externalCustomerId ?? '', externalName: b?.externalCustomerName ?? '', document: '' };
    this.linkFormOpen.set(true);
  }

  saveLink(): void {
    if (!this.linkForm.externalId.trim()) {
      return;
    }
    this.run(
      this.billingService.saveLink(this.companyId, { externalId: this.linkForm.externalId, externalName: this.linkForm.externalName || null }),
      () => this.linkFormOpen.set(false),
    );
  }

  lookupLink(): void {
    if (!this.linkForm.document.trim()) {
      return;
    }
    this.run(this.billingService.lookupLink(this.companyId, this.linkForm.document), () => this.linkFormOpen.set(false));
  }

  async removeLink(): Promise<void> {
    if (!(await this.confirmDialog.ask('Desfazer o vínculo com o cliente do sistema de cobrança?', { title: 'Desfazer vínculo', confirmLabel: 'Desfazer', danger: true }))) {
      return;
    }
    this.run(this.billingService.deleteLink(this.companyId), () => this.linkFormOpen.set(false));
  }

  /** Executa a alteração e recarrega os honorários. */
  private run(call: import('rxjs').Observable<unknown>, after?: () => void): void {
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        after?.();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId']) {
      this.loaded = false;
      this.billing.set(null);
      if (this.open()) {
        this.load();
      }
    }
  }

  toggle(): void {
    this.open.update((value) => !value);
    if (this.open() && !this.loaded) {
      this.load();
    }
  }

  private load(): void {
    if (!this.companyId) {
      return;
    }
    this.loaded = true;
    this.loading.set(true);
    this.failed.set(false);
    this.billingService.companyBilling(this.companyId).subscribe({
      next: (billing) => {
        this.billing.set(billing);
        this.loading.set(false);
      },
      error: () => {
        this.loaded = false;
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
