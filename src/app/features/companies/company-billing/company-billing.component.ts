import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { BILLING_PROVIDER_LABELS, CHARGE_STATUS_LABELS, CompanyBillingDTO } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';

/**
 * Honorários da empresa: situação (em aberto / atrasado), a qual cliente do sistema de
 * cobrança ela está vinculada e as cobranças (mais recentes primeiro). Carrega ao abrir.
 */
@Component({
  selector: 'app-company-billing',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FaIconComponent],
  templateUrl: './company-billing.component.html',
  styleUrl: './company-billing.component.scss',
})
export class CompanyBillingComponent implements OnChanges {
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
