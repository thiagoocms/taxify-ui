import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { PlanDTO } from '../../../core/models/plan.model';
import { SubscriptionDTO } from '../../../core/models/subscription.model';
import { PlanService } from '../../../core/services/plan.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionFormComponent } from './subscription-form/subscription-form.component';

interface SubscriptionRow extends SubscriptionDTO {
  planName: string;
}

@Component({
  selector: 'app-company-subscriptions',
  standalone: true,
  imports: [CommonModule, FaIconComponent, Button, Modal, Table, SubscriptionFormComponent],
  templateUrl: './company-subscriptions.component.html',
  styleUrl: './company-subscriptions.component.scss',
})
export class CompanySubscriptionsComponent implements OnChanges {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly planService = inject(PlanService);

  @Input() companyId = '';

  readonly chevronIcon = faChevronDown;
  readonly open = signal(false);

  readonly columns: TableColumn[] = [
    { name: 'Plano', property: 'planName' },
    { name: 'Início', property: 'startDate' },
    { name: 'Término', property: 'endDate' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditDialog(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

  readonly subscriptions = signal<SubscriptionRow[]>([]);
  readonly loading = signal(false);
  readonly dialogOpen = signal(false);
  readonly editingSubscription = signal<SubscriptionDTO | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId'] && this.companyId) {
      this.loadSubscriptions();
    }
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  loadSubscriptions(): void {
    if (!this.companyId) {
      return;
    }

    this.loading.set(true);
    this.subscriptionService
      .getAll({ page: 0, size: 100 }, { companyId: this.companyId })
      .pipe(
        switchMap((page) => {
          if (page.content.length === 0) {
            return of([] as SubscriptionRow[]);
          }

          const enriched = page.content.map((subscription) =>
            this.planService.getById(subscription.planId).pipe(
              catchError(() => of<PlanDTO>({ id: subscription.planId, name: '(plano não encontrado)' })),
              switchMap((plan) => of({ ...subscription, planName: plan.name })),
            ),
          );

          return forkJoin(enriched);
        }),
      )
      .subscribe({
        next: (rows) => {
          this.subscriptions.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.subscriptions.set([]);
          this.loading.set(false);
        },
      });
  }

  openCreateDialog(): void {
    this.editingSubscription.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(subscription: SubscriptionDTO): void {
    this.editingSubscription.set(subscription);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  onSaved(): void {
    this.dialogOpen.set(false);
    this.loadSubscriptions();
  }

  remove(subscription: SubscriptionRow): void {
    if (!confirm(`Remover a assinatura do plano "${subscription.planName}"?`)) {
      return;
    }

    this.subscriptionService.delete(subscription.id!).subscribe(() => this.loadSubscriptions());
  }
}
