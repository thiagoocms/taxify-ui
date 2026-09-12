import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import { Table, TableColumn, TableConfig } from '../../../shared/components/table/table';
import { CompanyDTO } from '../../../core/models/company.model';
import { UserCompanyDTO } from '../../../core/models/user-company.model';
import { CompanyService } from '../../../core/services/company.service';
import { UserCompanyService } from '../../../core/services/user-company.service';
import { UserLinkFormComponent } from './link-form/link-form.component';

interface LinkRow extends UserCompanyDTO {
  companyName: string;
  companyDocument: string;
}

@Component({
  selector: 'app-user-links',
  standalone: true,
  imports: [CommonModule, FaIconComponent, Button, Modal, Table, UserLinkFormComponent],
  templateUrl: './user-links.component.html',
  styleUrl: './user-links.component.scss',
})
export class UserLinksComponent implements OnChanges {
  private readonly companyService = inject(CompanyService);
  private readonly userCompanyService = inject(UserCompanyService);

  @Input() userId = '';

  readonly chevronIcon = faChevronDown;
  readonly open = signal(false);

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
  readonly dialogOpen = signal(false);
  readonly existingCompanyIds = computed(() => this.links().map((l) => l.companyId));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && this.userId) {
      this.loadLinks();
    }
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  loadLinks(): void {
    if (!this.userId) {
      return;
    }

    this.loading.set(true);
    this.userCompanyService
      .getAll(this.userId, { page: 0, size: 100 })
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

  openCreateDialog(): void {
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  onSaved(): void {
    this.dialogOpen.set(false);
    this.loadLinks();
  }

  remove(link: LinkRow): void {
    if (!confirm(`Remover o vínculo com "${link.companyName}"?`)) {
      return;
    }

    this.userCompanyService.delete(link.userId, link.companyId).subscribe(() => this.loadLinks());
  }
}
