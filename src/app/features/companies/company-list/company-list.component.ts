import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { Page, PageButton } from '../../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { CompanyDTO } from '../../../core/models/company.model';
import { CompanyService } from '../../../core/services/company.service';
import { CompanyFormComponent } from '../company-form/company-form.component';

type ViewMode = 'list' | 'form';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Button, InputComponent, Page, Table, CompanyFormComponent],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss',
})
export class CompanyListComponent implements OnInit {
  readonly columns: TableColumn[] = [
    { name: 'Nome', property: 'name' },
    { name: 'Tipo doc.', property: 'documentType' },
    { name: 'Documento', property: 'documentNumber' },
  ];

  readonly tableConfig: TableConfig = {
    headerVisible: true,
    actions: [
      { name: 'edit', icon: 'pen', tooltip: 'Editar', variant: 'text', handler: (row) => this.openEditForm(row) },
      { name: 'delete', icon: 'trash', tooltip: 'Excluir', severity: 'danger', variant: 'text', handler: (row) => this.remove(row) },
    ],
  };

  readonly companies = signal<CompanyDTO[]>([]);
  readonly loading = signal(false);
  readonly totalPages = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  readonly viewMode = signal<ViewMode>('list');
  readonly editingCompany = signal<CompanyDTO | null>(null);

  readonly pageTitle = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Empresas';
    }
    return this.editingCompany() ? 'Editar empresa' : 'Nova empresa';
  });

  readonly pageDescription = computed(() => {
    if (this.viewMode() === 'list') {
      return 'Gerencie as empresas cadastradas na plataforma';
    }
    return this.editingCompany() ? 'Atualize os dados da empresa' : 'Preencha os dados da nova empresa';
  });

  readonly pageButtons = computed<PageButton[]>(() => {
    if (this.viewMode() === 'list') {
      return [{ label: 'Nova empresa', icon: 'plus', handler: () => this.openCreateForm() }];
    }
    return [{ label: 'Voltar', icon: 'arrow-left', variant: 'outlined', severity: 'secondary', handler: () => this.closeForm() }];
  });

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor(private readonly companyService: CompanyService) {}

  ngOnInit(): void {
    this.loadCompanies();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.loadCompanies();
      });
  }

  loadCompanies(): void {
    this.loading.set(true);
    this.companyService
      .getAll(
        { page: this.pageIndex(), size: this.pageSize },
        { name: this.searchControl.value || undefined },
      )
      .subscribe({
        next: (page) => {
          this.companies.set(page.content);
          this.totalPages.set(page.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  previousPage(): void {
    if (this.pageIndex() > 0) {
      this.pageIndex.set(this.pageIndex() - 1);
      this.loadCompanies();
    }
  }

  nextPage(): void {
    if (this.pageIndex() + 1 < this.totalPages()) {
      this.pageIndex.set(this.pageIndex() + 1);
      this.loadCompanies();
    }
  }

  openCreateForm(): void {
    this.editingCompany.set(null);
    this.viewMode.set('form');
  }

  openEditForm(company: CompanyDTO): void {
    this.editingCompany.set(company);
    this.viewMode.set('form');
  }

  closeForm(): void {
    this.viewMode.set('list');
  }

  onSaved(): void {
    this.viewMode.set('list');
    this.loadCompanies();
  }

  remove(company: CompanyDTO): void {
    if (!confirm(`Deseja realmente excluir a empresa "${company.name}"?`)) {
      return;
    }

    this.companyService.delete(company.id!).subscribe(() => this.loadCompanies());
  }
}
