import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { CompanyDTO } from '../../../core/models/company.model';
import {
  ManifestationNoteDTO,
  ManifestationPendingDTO,
  ManifestationResultDTO,
  ManifestationType,
  MANIFESTATION_LABELS,
} from '../../../core/models/fiscal-xml.model';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { FiscalXmlService } from '../../../core/services/fiscal-xml.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page } from '../../../shared/components/page/page';
import { formatDocument } from '../../../shared/utils/document-mask';
import { formatCurrency } from '../../../shared/utils/format';

/**
 * Manifestação do destinatário: as entradas que ainda devem uma manifestação conclusiva
 * (confirmação, desconhecimento ou operação não realizada — prazo de 180 dias da autorização),
 * com envio em lote assinado pelo A1 da empresa.
 */
@Component({
  selector: 'app-manifestation',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, InputComponent, Modal, Page],
  template: `
    <app-page
      pageTitle="Manifestação do destinatário"
      pageDescription="Notas de entrada que ainda precisam de Confirmação, Desconhecimento ou Operação não Realizada"
    >
      <form [formGroup]="form" class="filters">
        <div class="company-field">
          <app-input
            formControlName="company"
            label="Empresa (nome ou CNPJ)"
            type="autocomplete"
            [searchFn]="searchCompanies"
            [displayFn]="companyLabel"
            displayField="name"
            displayFieldTooltip="documentNumber"
          ></app-input>
        </div>
      </form>

      @if (loading()) {
        <p class="muted"><span class="spinner-border spinner-border-sm me-2"></span>Carregando notas...</p>
      }

      @if (!loading() && data(); as d) {
        @if (!d.habilitada) {
          <div class="alert alert-warning small">
            O plano desta empresa não inclui a "Manifestação do destinatário" (junto com "Importação de XML fiscal" e
            "Integração SEFAZ"): dá para ver as notas pendentes, mas não enviar a manifestação pelo Taxify.
          </div>
        } @else if (!d.certificado) {
          <div class="alert alert-warning small">
            A empresa não tem certificado A1 válido — envie o certificado no cadastro da empresa para assinar a manifestação.
          </div>
        }

        <p class="small muted mb-2">
          Prazo de 180 dias a partir da autorização da nota. A Ciência da Operação libera o XML, mas não conclui a
          manifestação. Notas canceladas e as já manifestadas ficam fora da lista.
        </p>

        @if (!d.notas.length) {
          <div class="empty">Nenhuma nota de entrada aguardando manifestação nos últimos 180 dias.</div>
        } @else {
          <div class="toolbar">
            <span class="small">{{ selected().size }} de {{ d.notas.length }} selecionada(s)</span>
            @if (canSend()) {
              <button type="button" class="btn btn-sm btn-success" [disabled]="!selected().size || sending()" (click)="send('CONFIRMACAO')">
                Confirmar operação
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="!selected().size || sending()" (click)="send('CIENCIA')">
                Só ciência
              </button>
              <button type="button" class="btn btn-sm btn-outline-warning" [disabled]="!selected().size || sending()" (click)="openNotPerformed()">
                Operação não realizada
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="!selected().size || sending()" (click)="send('DESCONHECIMENTO')">
                Desconhecer
              </button>
              @if (sending()) {
                <span class="small muted"><span class="spinner-border spinner-border-sm me-1"></span>Enviando à SEFAZ...</span>
              }
            }
          </div>

          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle small">
              <thead>
                <tr>
                  <th class="check">
                    <input type="checkbox" class="form-check-input" [checked]="allSelected()" (change)="toggleAll()" aria-label="Selecionar todas" />
                  </th>
                  <th>Prazo</th>
                  <th>Nota</th>
                  <th>Emitente</th>
                  <th>Emissão</th>
                  <th class="text-end">Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                @for (nota of d.notas; track nota.chave) {
                  <tr [class.table-danger]="nota.diasRestantes < 0">
                    <td class="check">
                      <input type="checkbox" class="form-check-input" [checked]="selected().has(nota.chave)" (change)="toggle(nota.chave)" />
                    </td>
                    <td>
                      <span class="badge" [ngClass]="deadlineClass(nota)">{{ deadlineLabel(nota) }}</span>
                      <div class="muted">{{ nota.prazo | date: 'dd/MM/yyyy' }}</div>
                    </td>
                    <td>
                      @if (nota.notaId) {
                        <a [routerLink]="['/notas-fiscais', nota.notaId]">Nº {{ nota.numero }}</a>
                      } @else {
                        Nº {{ nota.numero }}
                      }
                      @if (nota.serie) { <span class="muted">· Série {{ nota.serie }}</span> }
                      <div class="muted mono">{{ nota.chave }}</div>
                    </td>
                    <td>
                      {{ nota.emitenteNome || '—' }}
                      <div class="muted">{{ formatDocument(nota.emitenteDocumento) }}</div>
                    </td>
                    <td>{{ nota.dataEmissao | date: 'dd/MM/yyyy' }}</td>
                    <td class="text-end">{{ formatCurrency(nota.valorTotal) }}</td>
                    <td>
                      @if (!nota.xmlCompleto) {
                        <span class="badge text-bg-light border" title="A SEFAZ entregou só o resumo">Só resumo</span>
                      }
                      @if (nota.ciencia) {
                        <span class="badge text-bg-info">Com ciência</span>
                      } @else {
                        <span class="badge text-bg-secondary">Sem manifestação</span>
                      }
                      @if (failures()[nota.chave]; as failure) {
                        <div class="text-danger">{{ failure }}</div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </app-page>

    <app-modal [open]="notPerformedOpen()" title="Operação não realizada" (closed)="notPerformedOpen.set(false)">
      @if (notPerformedOpen()) {
        <p class="small">
          Para {{ selected().size }} nota(s). Use quando a operação foi acordada mas não aconteceu (devolução, recusa no
          recebimento...). A SEFAZ exige a justificativa.
        </p>
        <textarea class="form-control" rows="3" maxlength="255" [(ngModel)]="justification"
          placeholder="Justificativa (15 a 255 caracteres)"></textarea>
        <div class="small muted mt-1">{{ justification.trim().length }}/255</div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-sm btn-link" (click)="notPerformedOpen.set(false)">Cancelar</button>
          <button type="button" class="btn btn-sm btn-warning" [disabled]="justification.trim().length < 15" (click)="sendNotPerformed()">
            Enviar
          </button>
        </div>
      }
    </app-modal>
  `,
  styles: `
    .filters { max-width: 520px; margin-bottom: 1rem; }
    .muted { opacity: 0.7; }
    .mono { font-family: var(--bs-font-monospace, monospace); font-size: 0.72rem; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
    .check { width: 32px; }
    .empty { padding: 24px; text-align: center; opacity: 0.7; border: 1px dashed var(--bs-border-color, #dee2e6); border-radius: 6px; }
  `,
})
export class ManifestationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly fiscalXmlService = inject(FiscalXmlService);
  private readonly toastr = inject(ToastrService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.group({ company: this.fb.control<CompanyDTO | null>(null) });
  readonly data = signal<ManifestationPendingDTO | null>(null);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly selected = signal<Set<string>>(new Set());
  /** Recusas da SEFAZ do último envio, por chave. */
  readonly failures = signal<Record<string, string>>({});
  readonly notPerformedOpen = signal(false);
  justification = '';

  readonly canSend = computed(() => {
    const d = this.data();
    return !!d && d.habilitada && d.certificado && this.auth.can('INVOICES_AUDIT');
  });
  readonly allSelected = computed(() => {
    const notas = this.data()?.notas ?? [];
    return notas.length > 0 && notas.every((nota) => this.selected().has(nota.chave));
  });

  protected readonly formatDocument = formatDocument;
  protected readonly formatCurrency = formatCurrency;

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  constructor() {
    this.form.controls.company.valueChanges.subscribe((company) => {
      if (company && typeof company === 'object' && company.id) {
        this.load(company.id);
      }
    });
  }

  private companyId(): string | null {
    const company = this.form.controls.company.value;
    return company && typeof company === 'object' && company.id ? company.id : null;
  }

  private load(companyId: string): void {
    this.loading.set(true);
    this.selected.set(new Set());
    this.fiscalXmlService.manifestationPending(companyId).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.data.set(null);
        this.loading.set(false);
      },
    });
  }

  toggle(chave: string): void {
    const next = new Set(this.selected());
    if (next.has(chave)) {
      next.delete(chave);
    } else {
      next.add(chave);
    }
    this.selected.set(next);
  }

  toggleAll(): void {
    const notas = this.data()?.notas ?? [];
    this.selected.set(this.allSelected() ? new Set() : new Set(notas.map((nota) => nota.chave)));
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
    const count = this.selected().size;
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
    if (!companyId) {
      return;
    }
    this.sending.set(true);
    this.fiscalXmlService
      .manifest({ companyId, tipo: type, justificativa, chaves: [...this.selected()] })
      .subscribe({
        next: (result) => this.afterSend(companyId, result),
        error: () => this.sending.set(false),
      });
  }

  private afterSend(companyId: string, result: ManifestationResultDTO): void {
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
    this.load(companyId);
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
      return 'text-bg-danger';
    }
    return nota.diasRestantes <= 15 ? 'text-bg-warning' : 'text-bg-light border';
  }
}
