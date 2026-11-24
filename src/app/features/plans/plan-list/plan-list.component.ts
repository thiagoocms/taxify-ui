import { formatCurrency } from '../../../shared/utils/format';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { InputComponent } from '../../../shared/components/input/input';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { PLAN_SERVICE_LABELS, PlanDTO } from '../../../core/models/plan.model';
import { PlanService } from '../../../core/services/plan.service';
import { BILLING_CYCLE_LABELS } from '../../../core/models/billing.model';
import { PlanFormComponent } from '../plan-form/plan-form.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { LoaderComponent } from '../../../shared/components/loader/loader';

interface PlanRow extends PlanDTO {
  servicesLabel: string;
  priceLabel: string;
}


type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [LoaderComponent, CommonModule, ReactiveFormsModule, InputComponent, Page, Pagination, Table, PlanFormComponent],
  templateUrl: './plan-list.component.html',
  styleUrl: './plan-list.component.scss',
})
export class PlanListComponent implements OnInit {
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly auth = inject(AuthService);

  readonly columns: TableColumn[] = [
    { name: 'Nome', property: 'name' },
    { name: 'Descrição', property: 'description', cellTextLength: 60 },
    { name: 'Serviços', property: 'servicesLabel', cellTextLength: 60 },
    { name: 'Preço de tabela', property: 'priceLabel' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: this.auth.isAdmin
      ? [
          { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
          { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
        ]
      : [],
  };

  readonly plans = signal<PlanRow[]>([]);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly viewMode = signal<ViewMode>('list');
  readonly editingPlan = signal<PlanDTO | null>(null);

  readonly pageTitle = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Planos';
    }
    return this.editingPlan() ? 'Editar plano' : 'Novo plano';
  });

  readonly pageDescription = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Gerencie os planos disponíveis na plataforma';
    }
    return this.editingPlan() ? 'Atualize os dados do plano' : 'Preencha os dados do novo plano';
  });

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      return [{ label: 'Novo plano', icon: 'plus', isShow: this.auth.isAdmin, handler: () => this.openCreateForm() }];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly planService: PlanService) {}

  ngOnInit(): void {
    this.loadPlans();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.loadPlans();
      });
  }

  loadPlans(): void {
    this.loading.set(true);
    this.planService
      .getAll(
        { page: this.pageIndex(), size: this.pageSize },
        { name: this.searchControl.value || undefined },
      )
      .subscribe({
        next: (page) => {
          this.plans.set(
            page.content.map((plan) => ({
              ...plan,
              servicesLabel: (plan.services ?? []).map((service) => PLAN_SERVICE_LABELS[service]).join(', '),
              priceLabel:
                plan.listPrice != null
                  ? formatCurrency(plan.listPrice) + (plan.billingCycle ? ` / ${BILLING_CYCLE_LABELS[plan.billingCycle].toLowerCase()}` : '')
                  : '—',
            })),
          );
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadPlans();
  }

  openCreateForm(): void {
    this.editingPlan.set(null);
    this.viewMode.set('form');
  }

  openEditForm(plan: PlanDTO): void {
    this.editingPlan.set(plan);
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
  }

  onSaved(): void {
    this.viewMode.set('list');
    this.loadPlans();
  }

  async remove(plan: PlanDTO): Promise<void> {
    if (!(await this.confirmDialog.ask(`Deseja realmente excluir o plano "${plan.name}"?`, { title: 'Excluir plano', confirmLabel: 'Excluir', danger: true }))) {
      return;
    }

    this.planService.delete(plan.id!).subscribe(() => this.loadPlans());
  }
}
