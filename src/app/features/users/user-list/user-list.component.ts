import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Modal } from '../../../shared/components/modal/modal';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { AcessoriasUserSummaryDTO } from '../../../core/models/acessorias.model';
import { ACCESS_PROFILE_LABELS } from '../../../core/models/access.model';
import { UserDTO } from '../../../core/models/user.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { AcessoriasService } from '../../../core/services/acessorias.service';
import { UserService } from '../../../core/services/user.service';
import { UserFormComponent } from '../user-form/user-form.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { planNameInSentence } from '../../../core/models/api-error.model';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

const PROFILE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  EMPLOYEE: 'Colaborador',
};

/** "Administrador" / "Fiscal, Financeiro" / "Colaborador (sem perfil)". */
function profileLabel(user: UserDTO): string {
  if (user.profile === 'ADMIN') {
    return PROFILE_LABELS['ADMIN'];
  }
  const profiles = (user.accessProfiles ?? []).map((profile) => ACCESS_PROFILE_LABELS[profile] ?? profile);
  return profiles.length ? profiles.join(', ') : `${PROFILE_LABELS[user.profile] ?? user.profile} (sem perfil)`;
}

interface UserRow extends UserDTO {
  profileLabel: string;
}

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [LoaderComponent, FaIconComponent, CommonModule, FormsModule, ReactiveFormsModule, Toggle, Button, InputComponent, Modal, Page, Pagination, Table, UserFormComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  readonly columns: TableColumn[] = [
    { name: 'Nome', property: 'name' },
    { name: 'Login', property: 'login' },
    { name: 'E-mail', property: 'email' },
    { name: 'Perfil', property: 'profileLabel' },
  ];

  /** Somente leitura e limite do teste: desabilitam "Novo usuário", "Cadastrar" do Acessórias e excluir. */
  protected readonly firmAccess = inject(FirmAccessService);

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      // Em somente leitura, editar abre o formulário só para ver (Salvar desabilitado).
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', write: true, handler: (row) => this.remove(row) },
    ],
  };

  /** Limite do teste atingido (o somente leitura é tratado pelo [write] dos botões). */
  readonly cannotCreate = computed(() => this.firmAccess.userLimitReached());

  /** Limite do teste atingido: explicação acima da lista (a vaga só volta excluindo um usuário). */
  readonly userLimitMessage = computed(() => {
    const limits = this.firmAccess.limits();
    if (!limits || !this.firmAccess.userLimitReached()) {
      return null;
    }
    return `O ${planNameInSentence(limits.planName)} permite ${limits.maxUsers} usuários (contando o administrador) e o ` +
      `escritório já tem ${limits.usersInUse}. Fale com a CS Hub para contratar.`;
  });

  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly acessoriasService = inject(AcessoriasService);
  private readonly accountingFirmService = inject(AccountingFirmService);

  readonly acessoriasUsers = signal<AcessoriasUserSummaryDTO[] | null>(null);
  readonly acessoriasLoading = signal(false);
  readonly showInactiveAcessorias = signal(false);
  readonly visibleAcessoriasUsers = computed(() =>
    (this.acessoriasUsers() ?? []).filter((user) => user.active || this.showInactiveAcessorias()),
  );
  readonly acessoriasMissingCount = computed(
    () => this.visibleAcessoriasUsers().filter((user) => !user.taxifyUserId && user.email).length,
  );

  readonly users = signal<UserRow[]>([]);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly viewMode = signal<ViewMode>('list');
  readonly editingUser = signal<UserDTO | null>(null);

  readonly pageTitle = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Usuários';
    }
    return this.editingUser() ? 'Editar usuário' : 'Novo usuário';
  });

  readonly pageDescription = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Gerencie os usuários da sua equipe';
    }
    return this.editingUser()
      ? 'Atualize os dados do usuário'
      : 'Usuários criados aqui entram como funcionários (EMPLOYEE)';
  });

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      return [
        {
          label: this.acessoriasLoading() ? 'Buscando...' : 'Buscar do Acessórias',
          icon: 'cloud-arrow-down',
          variant: 'outlined',
          isDisabled: this.acessoriasLoading(),
          isShow: this.accountingFirmService.hasAcessoriasToken(),
          handler: () => this.openAcessoriasUsers(),
        },
        {
          label: 'Novo usuário',
          icon: 'plus',
          isDisabled: this.cannotCreate(),
          tooltip: this.userLimitMessage() ?? undefined,
          write: true,
          handler: () => this.openCreateForm(),
        },
      ];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.accountingFirmService.loadCurrent();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.loadUsers();
      });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.userService
      .getAll(
        { page: this.pageIndex(), size: this.pageSize },
        { name: this.searchControl.value || undefined },
      )
      .subscribe({
        next: (page) => {
          this.users.set(
            page.content.map((user) => ({
              ...user,
              profileLabel: profileLabel(user),
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
    this.loadUsers();
  }

  openAcessoriasUsers(): void {
    this.acessoriasLoading.set(true);
    this.acessoriasService.listUsers().subscribe({
      next: (users) => {
        this.acessoriasLoading.set(false);
        this.acessoriasUsers.set(users);
      },
      // A mensagem de erro da API (ex.: token não configurado) já é exibida pelo interceptor.
      error: () => this.acessoriasLoading.set(false),
    });
  }

  closeAcessoriasUsers(): void {
    this.acessoriasUsers.set(null);
  }

  toggleInactiveAcessorias(): void {
    this.showInactiveAcessorias.update((value) => !value);
  }

  /**
   * Abre o formulário de novo usuário já com nome, e-mail e login vindos do Acessórias -
   * CPF e senha o Acessórias não fornece, então o ADMIN completa.
   */
  registerFromAcessorias(user: AcessoriasUserSummaryDTO): void {
    this.acessoriasUsers.set(null);
    this.editingUser.set({
      name: user.name ?? '',
      email: user.email ?? '',
      login: user.email ?? '',
      documentType: 'CPF',
      documentNumber: '',
      profile: 'EMPLOYEE',
    });
    this.viewMode.set('form');
  }

  openCreateForm(): void {
    this.editingUser.set(null);
    this.viewMode.set('form');
  }

  openEditForm(user: UserDTO): void {
    this.editingUser.set(user);
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
  }

  onSaved(): void {
    this.viewMode.set('list');
    this.loadUsers();
    // Criar usuário muda o uso do limite do teste.
    this.firmAccess.reload();
  }

  async remove(user: UserDTO): Promise<void> {
    if (!(await this.confirmDialog.ask(`Deseja realmente excluir o usuário "${user.name}"?`, { title: 'Excluir usuário', confirmLabel: 'Excluir', danger: true }))) {
      return;
    }

    this.userService.delete(user.id!).subscribe({
      next: () => {
        this.loadUsers();
        this.firmAccess.reload();
      },
      // O interceptor já mostrou o toast (somente leitura, não encontrado...); a linha continua na lista.
      error: () => undefined,
    });
  }
}
