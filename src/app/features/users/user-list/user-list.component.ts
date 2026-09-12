import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { UserDTO } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { UserFormComponent } from '../user-form/user-form.component';

const PROFILE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  EMPLOYEE: 'Funcionário',
};

interface UserRow extends UserDTO {
  profileLabel: string;
}

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Button, InputComponent, Page, Table, UserFormComponent],
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

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

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
      return [{ label: 'Novo usuário', icon: 'plus', handler: () => this.openCreateForm() }];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();

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
              profileLabel: PROFILE_LABELS[user.profile] ?? user.profile,
            })),
          );
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  previousPage(): void {
    if (this.pageIndex() > 0) {
      this.pageIndex.set(this.pageIndex() - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.pageIndex.set(this.pageIndex() + 1);
      this.loadUsers();
    }
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
  }

  remove(user: UserDTO): void {
    if (!confirm(`Deseja realmente excluir o usuário "${user.name}"?`)) {
      return;
    }

    this.userService.delete(user.id!).subscribe(() => this.loadUsers());
  }
}
