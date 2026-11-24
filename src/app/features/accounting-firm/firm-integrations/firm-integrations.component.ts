import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faKey, faLink } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import {
  BILLING_PROVIDER_LABELS,
  BillingCategoryDTO,
  BillingProviderType,
  BillingSettingsDTO,
  BillingSyncResultDTO,
} from '../../../core/models/billing.model';
import { ContaAzulConnectionStatusDTO } from '../../../core/models/conta-azul.model';
import { INTEGRATION_LABELS, IntegrationType } from '../../../core/models/integration.model';
import { isRunning, progressLabel, SyncJobStatusDTO } from '../../../core/models/sync-job.model';
import { BillingService } from '../../../core/services/billing.service';
import { CONTA_AZUL_CHANNEL, ContaAzulPopupMessage, openContaAzulPopup } from '../../../core/services/conta-azul-popup';
import { ContaAzulService } from '../../../core/services/conta-azul.service';
import { IntegrationService } from '../../../core/services/integration.service';
import { pollUntilDone } from '../../../core/services/sync-job-polling';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';

/**
 * Integrações do escritório num só lugar: chaves da SIEG / Acessórias (nunca exibidas
 * inteiras), conexão com a Conta Azul (login em janela pop-up) e de onde vêm contratos e
 * honorários (Manual ou um sistema integrado), com a sincronização manual.
 */
import { EfiscoCertificateCardComponent } from './efisco-certificate-card.component';
import { LoaderComponent } from '../../../shared/components/loader/loader';
@Component({
  selector: 'app-firm-integrations',
  standalone: true,
  imports: [LoaderComponent, DatePipe, FormsModule, Button, InputComponent, FaIconComponent, EfiscoCertificateCardComponent],
  templateUrl: './firm-integrations.component.html',
  styleUrl: './firm-integrations.component.scss',
})
export class FirmIntegrationsComponent implements OnInit, OnDestroy {
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly integrationService = inject(IntegrationService);
  private readonly contaAzulService = inject(ContaAzulService);
  private readonly billingService = inject(BillingService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly icons = { key: faKey, link: faLink };
  readonly labels = INTEGRATION_LABELS;
  readonly providerLabels = BILLING_PROVIDER_LABELS;
  readonly keyIntegrations: IntegrationType[] = ['SIEG', 'ACESSORIAS'];

  // ---- chaves de API
  readonly editingKey = signal<IntegrationType | null>(null);
  keyDraft = '';
  readonly savingKey = signal(false);

  // ---- Conta Azul
  readonly contaAzul = signal<ContaAzulConnectionStatusDTO | null>(null);
  readonly contaAzulBusy = signal(false);
  private contaAzulChannel: BroadcastChannel | null = null;
  private contaAzulPopupWatch: ReturnType<typeof setInterval> | null = null;

  // ---- cobrança
  readonly billing = signal<BillingSettingsDTO | null>(null);
  readonly categories = signal<BillingCategoryDTO[] | null>(null);
  readonly categoriesLoading = signal(false);
  readonly selectedCategories = signal<Set<string>>(new Set());
  providerDraft: BillingProviderType = 'MANUAL';
  readonly savingBilling = signal(false);
  /** Sincronização em segundo plano: andamento enquanto roda, resumo da última quando termina. */
  readonly syncJob = signal<SyncJobStatusDTO<BillingSyncResultDTO> | null>(null);
  readonly syncing = computed(() => isRunning(this.syncJob()));
  readonly syncProgress = computed(() => progressLabel(this.syncJob()));
  readonly syncResult = computed(() => this.syncJob()?.result ?? null);

  readonly providerOptions = computed<SelectOption[]>(() =>
    (this.billing()?.availableProviders ?? []).map((value) => ({ value, label: BILLING_PROVIDER_LABELS[value] })),
  );

  readonly providerIsIntegrated = computed(() => (this.billing()?.provider ?? 'MANUAL') !== 'MANUAL');

  ngOnInit(): void {
    this.integrationService.load();
    this.loadContaAzulStatus();
    this.loadBilling();
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  status(type: IntegrationType) {
    return this.integrationService.statusOf(type);
  }

  // ------------------------------------------------------------------ chaves de API

  startEditKey(type: IntegrationType): void {
    this.keyDraft = '';
    this.editingKey.set(type);
  }

  cancelEditKey(): void {
    this.editingKey.set(null);
  }

  async saveKey(type: IntegrationType, remove = false): Promise<void> {
    if (remove && !(await this.confirmDialog.ask(`Remover a chave da ${this.labels[type]}? A integração para de funcionar até informar outra.`, { title: 'Remover chave', confirmLabel: 'Remover', danger: true }))) {
      return;
    }
    this.savingKey.set(true);
    this.integrationService.saveApiKey(type, remove ? '' : this.keyDraft).subscribe({
      next: () => {
        this.savingKey.set(false);
        this.editingKey.set(null);
        this.toastr.success(remove ? 'Chave removida.' : 'Chave salva.');
      },
      error: () => this.savingKey.set(false),
    });
  }

  // ------------------------------------------------------------------ Conta Azul

  private loadContaAzulStatus(): void {
    this.contaAzulService.status().subscribe({
      next: (status) => this.contaAzul.set(status),
      error: () => this.contaAzul.set(null),
    });
  }

  /** Login da Conta Azul em janela pop-up; sem pop-up (bloqueado), segue na própria aba. */
  connectContaAzul(): void {
    // A janela precisa abrir já no clique - depois da chamada HTTP o navegador bloquearia.
    const popup = openContaAzulPopup();
    this.contaAzulBusy.set(true);
    this.contaAzulService.authorizeUrl().subscribe({
      next: ({ url }) => {
        if (!popup || popup.closed) {
          window.location.href = url;
          return;
        }
        this.listenForPopupResult(popup);
        popup.location.href = url;
        popup.focus();
      },
      error: () => {
        popup?.close();
        this.contaAzulBusy.set(false);
      },
    });
  }

  async disconnectContaAzul(): Promise<void> {
    if (!(await this.confirmDialog.ask('Desconectar a Conta Azul deste escritório? O Taxify deixa de acessar os dados até conectar de novo.', { title: 'Desconectar Conta Azul', confirmLabel: 'Desconectar', danger: true }))) {
      return;
    }
    this.contaAzulBusy.set(true);
    this.contaAzulService.disconnect().subscribe({
      next: () => {
        this.contaAzulBusy.set(false);
        this.loadContaAzulStatus();
        this.loadBilling();
      },
      error: () => this.contaAzulBusy.set(false),
    });
  }

  private listenForPopupResult(popup: Window): void {
    this.stopListening();
    if (typeof BroadcastChannel !== 'undefined') {
      this.contaAzulChannel = new BroadcastChannel(CONTA_AZUL_CHANNEL);
      this.contaAzulChannel.addEventListener('message', (event: MessageEvent<ContaAzulPopupMessage>) => {
        const data = event.data;
        if (data?.type !== 'result') {
          return;
        }
        this.contaAzulChannel?.postMessage({ type: 'ack' } satisfies ContaAzulPopupMessage);
        this.stopListening();
        this.contaAzulBusy.set(false);
        if (data.ok) {
          this.toastr.success('Conta Azul conectada.');
          this.loadContaAzulStatus();
          this.integrationService.load();
          this.loadBilling();
        } else {
          this.toastr.error(data.message || 'Não foi possível conectar a Conta Azul.');
        }
      });
    }
    // Janela fechada sem concluir: libera o botão. A página de login pode fazer "closed" virar
    // true antes da hora (isolamento entre origens), então o canal continua ouvindo.
    this.contaAzulPopupWatch = setInterval(() => {
      if (popup.closed) {
        this.contaAzulBusy.set(false);
        this.clearPopupWatch();
      }
    }, 800);
  }

  private clearPopupWatch(): void {
    if (this.contaAzulPopupWatch) {
      clearInterval(this.contaAzulPopupWatch);
      this.contaAzulPopupWatch = null;
    }
  }

  private stopListening(): void {
    this.contaAzulChannel?.close();
    this.contaAzulChannel = null;
    this.clearPopupWatch();
  }

  // ------------------------------------------------------------------ cobrança

  private loadBilling(): void {
    this.billingService.getSettings().subscribe({
      next: (settings) => {
        this.billing.set(settings);
        this.providerDraft = settings.provider;
        this.selectedCategories.set(new Set(settings.feeCategoryIds));
        if (settings.provider !== 'MANUAL' && settings.connected) {
          this.loadCategories();
          if (!this.syncJob()) {
            this.loadSyncStatus();
          }
        } else {
          this.categories.set(null);
        }
      },
      error: () => this.billing.set(null),
    });
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.billingService.listCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => {
        this.categories.set(null);
        this.categoriesLoading.set(false);
      },
    });
  }

  toggleCategory(id: string, checked: boolean): void {
    const next = new Set(this.selectedCategories());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedCategories.set(next);
  }

  saveBilling(): void {
    this.savingBilling.set(true);
    const categories = this.providerDraft === 'MANUAL' ? [] : [...this.selectedCategories()];
    this.billingService.updateSettings(this.providerDraft, categories).subscribe({
      next: () => {
        this.savingBilling.set(false);
        this.toastr.success('Configuração de cobrança salva.');
        this.loadBilling();
      },
      error: () => this.savingBilling.set(false),
    });
  }

  /** Dispara em segundo plano e acompanha; dá para sair da tela - o resultado fica guardado. */
  syncBilling(): void {
    this.billingService.startSync().subscribe((job) => {
      this.syncJob.set(job);
      this.followSync(true);
    });
  }

  /** Retoma o acompanhamento ao abrir a tela se houver uma sincronização rodando (botão, outra aba ou o agendador). */
  private loadSyncStatus(): void {
    this.billingService.syncStatus().subscribe((job) => {
      this.syncJob.set(job);
      if (isRunning(job)) {
        this.followSync(false);
      }
    });
  }

  private followSync(notify: boolean): void {
    pollUntilDone(() => this.billingService.syncStatus())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((job) => {
        this.syncJob.set(job);
        if (isRunning(job) || !notify) {
          return;
        }
        if (job.status === 'FAILED') {
          this.toastr.error(job.error || 'A sincronização falhou.');
        } else if (job.result?.errors.length) {
          this.toastr.warning('Sincronização concluída com erros — veja o resumo.');
        } else {
          this.toastr.success('Contratos e honorários sincronizados.');
        }
        this.loadBilling();
      });
  }
}
