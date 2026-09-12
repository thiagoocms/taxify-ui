import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, map, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { CompanyDTO } from '../../core/models/company.model';
import { UserCompanyDTO } from '../../core/models/user-company.model';
import { UserDTO } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { UserCompanyService } from '../../core/services/user-company.service';
import { UserService } from '../../core/services/user.service';
import { LinkFormComponent } from './link-form/link-form.component';

interface LinkRow extends UserCompanyDTO {
  companyName: string;
  companyDocument: string;
}

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-user-company-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Button, InputComponent, Page, Table, LinkFormComponent],
  templateUrl: './user-company-list.component.html',
  styleUrl: './user-company-list.component.scss',
})
export class UserCompanyListComponent implements OnInit {
  readonly columns: TableColumn[] = [
    { name: 'Empresa', property: 'companyName' },
    { name: 'Documento', property: 'companyDocument' },
    { name: 'Papel', property: 'role' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'unlink', icon: 'link-slash', tooltip: 'Remover vínculo', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

  readonly links = signal<LinkRow[]>([]);
  readonly loading = signal(false);
  readonly existingCompanyIds = computed(() => this.links().map((l) => l.companyId));

  readonly viewMode = signal<ViewMode>('list');

  readonly pageTitle = computed(() => (this.viewMode() === 'list' ? 'Vínculos usuário x empresa' : 'Vincular empresa'));
  readonly pageDescription = computed(() =>
    this.viewMode() === 'list' ? 'Associe usuários às empresas e defina seus papéis' : 'Selecione a empresa e o papel do vínculo',
  );

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      return [{ label: 'Vincular empresa', icon: 'link', handler: () => this.openAddForm() }];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly userIdControl = new FormControl('', { nonNullable: true });
  readonly userAutocompleteControl = new FormControl<UserDTO | null>(null);
  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  readonly searchUsers = (term: string): Observable<UserDTO[]> =>
    this.userService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  constructor(
    private readonly userCompanyService: UserCompanyService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userIdControl.setValue(this.authService.userId() ?? '');
    this.loadLinks();
  }

  useMyUser(): void {
    this.userAutocompleteControl.setValue(null);
    this.userIdControl.setValue(this.authService.userId() ?? '');
    this.loadLinks();
  }

  onUserSelected(user: UserDTO): void {
    this.userIdControl.setValue(user.id ?? '');
  }

  loadLinks(): void {
    const userId = this.userIdControl.value.trim();
    if (!userId) {
      this.links.set([]);
      return;
    }

    this.loading.set(true);
    this.userCompanyService
      .getAll(userId, { page: 0, size: 100 })
      .pipe(
        switchMap((page) => {
          if (page.content.length === 0) {
            return of([] as LinkRow[]);
          }

          const enriched = page.content.map((link) =>
            this.companyService.getById(link.companyId).pipe(
              catchError(() => of<CompanyDTO>({ id: link.companyId, name: '(empresa não encontrada)', documentNumber: '-', documentType: '-' })),
              switchMap((company) =>
                of({ ...link, companyName: company.name, companyDocument: company.documentNumber }),
              ),
            ),
          );

          return forkJoin(enriched);
        }),
      )
      .subscribe({
        next: (rows) => {
          this.links.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.links.set([]);
          this.loading.set(false);
        },
      });
  }

  openAddForm(): void {
    if (!this.userIdControl.value.trim()) {
      return;
    }
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
  }

  onSaved(): void {
    this.viewMode.set('list');
    this.loadLinks();
  }

  remove(link: LinkRow): void {
    if (!confirm(`Remover o vínculo com "${link.companyName}"?`)) {
      return;
    }

    this.userCompanyService.delete(link.userId, link.companyId).subscribe(() => this.loadLinks());
  }
}
