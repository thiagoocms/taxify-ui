import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyTaxRegimeDTO } from '../../../core/models/company.model';
import {
  BUSINESS_ACTIVITY_LABELS,
  BusinessActivity,
  SERVICE_ANNEX_LABELS,
  SimplesAnnex,
  TAX_REGIME_LABELS,
  TaxRegime,
} from '../../../core/models/tax-assessment.model';
import { CompanyService } from '../../../core/services/company.service';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';

/**
 * Histórico de regime da empresa: cada mês é apurado com o regime vigente nele. O regime do
 * cadastro é o período atual; aqui se registra uma mudança a partir de um mês (ou se corrige
 * o passado, ex.: "era Simples até dez/2025").
 */
@Component({
  selector: 'app-company-tax-regimes',
  standalone: true,
  imports: [LoaderComponent, CommonModule, FormsModule, Button, InputComponent],
  template: `
    <section class="mt-4">
      <h6 class="section-title">Histórico de regime</h6>
      <p class="section-hint">Cada mês é apurado com o regime vigente nele.</p>
      @if (loading()) {
        <app-loader variant="inline"></app-loader>
      } @else if (!periods().length) {
        <p class="muted">Sem histórico — cadastre o regime da empresa acima.</p>
      } @else {
        <table class="table table-sm regimes">
          <thead><tr><th>Período</th><th>Regime</th><th>Anexo serviços</th><th></th></tr></thead>
          <tbody>
            @for (period of periods(); track period.id) {
              <tr>
                <td>{{ range(period) }}</td>
                <td>{{ period.label }}</td>
                <td>{{ period.taxRegime === 'SIMPLES_NACIONAL' ? (period.simplesServiceAnnex ?? 'III') : '—' }}</td>
                <td class="text-end">
                  @if (!readonly && periods().length > 1) {
                    <app-button label="Remover" variant="text" severity="danger" (onClick)="remove(period)"></app-button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (!readonly) {
        <div class="add-row">
          <app-input size="sm" type="select" label="Regime" [options]="regimeSelect" [(ngModel)]="newRegime"></app-input>
          <app-input size="sm" type="select" label="Atividade" [options]="activitySelect" [(ngModel)]="newActivity"></app-input>
          @if (newRegime === 'SIMPLES_NACIONAL') {
            <app-input size="sm" type="select" label="Anexo (vazio = III)" [options]="annexSelect" [(ngModel)]="newAnnex"></app-input>
          }
          <app-input size="sm" type="month" label="A partir de (vazio = sempre)" [(ngModel)]="newFrom"></app-input>
          <app-button label="Registrar período" icon="plus" variant="outlined" [disabled]="!newRegime || saving()" (onClick)="add()"></app-button>
        </div>
      }
    </section>
  `,
  styles: `
    .section-title { font-weight: 600; margin-bottom: 0.25rem; }
    .section-hint { font-size: 0.85rem; opacity: 0.75; margin-bottom: 0.5rem; }
    .muted { opacity: 0.7; font-size: 0.9rem; }
    .regimes { max-width: 900px; font-size: 0.9rem; }
    .add-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 900px; }
    .add-row app-input { flex: 1 1 170px; }
  `,
})
export class CompanyTaxRegimesComponent implements OnChanges {
  private readonly companyService = inject(CompanyService);

  @Input({ required: true }) companyId!: string;
  @Input() readonly = false;

  readonly regimeOptions = Object.entries(TAX_REGIME_LABELS) as [TaxRegime, string][];
  readonly activityOptions = Object.entries(BUSINESS_ACTIVITY_LABELS) as [BusinessActivity, string][];
  readonly annexOptions = Object.entries(SERVICE_ANNEX_LABELS) as [SimplesAnnex, string][];
  readonly regimeSelect: SelectOption[] = this.regimeOptions.map(([value, label]) => ({ value, label }));
  readonly activitySelect: SelectOption[] = this.activityOptions.map(([value, label]) => ({ value, label }));
  readonly annexSelect: SelectOption[] = this.annexOptions.map(([value, label]) => ({ value, label }));

  readonly periods = signal<CompanyTaxRegimeDTO[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  newRegime: TaxRegime | '' = '';
  newActivity: BusinessActivity | '' = '';
  newAnnex: SimplesAnnex | '' = '';
  newFrom = '';

  ngOnChanges(): void {
    this.loading.set(true);
    this.companyService.getRegimes(this.companyId).subscribe({
      next: (periods) => {
        this.periods.set(periods);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  range(period: CompanyTaxRegimeDTO): string {
    const from = period.validFrom ? this.month(period.validFrom) : 'desde sempre';
    const until = period.validUntil ? this.month(period.validUntil) : 'atual';
    return period.validFrom ? `${from} → ${until}` : `${from} → ${until}`;
  }

  add(): void {
    if (!this.newRegime) {
      return;
    }
    this.saving.set(true);
    this.companyService
      .saveRegime(this.companyId, {
        taxRegime: this.newRegime,
        businessActivity: this.newActivity || null,
        simplesServiceAnnex: this.newRegime === 'SIMPLES_NACIONAL' ? this.newAnnex || null : null,
        validFrom: this.newFrom || null,
      })
      .subscribe({
        next: (periods) => {
          this.periods.set(periods);
          this.saving.set(false);
          this.newRegime = '';
          this.newActivity = '';
          this.newAnnex = '';
          this.newFrom = '';
        },
        error: () => this.saving.set(false),
      });
  }

  remove(period: CompanyTaxRegimeDTO): void {
    if (!period.id) {
      return;
    }
    this.companyService.deleteRegime(this.companyId, period.id).subscribe((periods) => this.periods.set(periods));
  }

  private month(value: string): string {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  }
}
