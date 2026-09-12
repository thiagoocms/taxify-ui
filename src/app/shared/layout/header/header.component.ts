import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../components/button/button';
import { Modal } from '../../components/modal/modal';
import { AccountingFirmFormComponent } from '../../../features/accounting-firm/accounting-firm-form/accounting-firm-form.component';
import { AccountingFirmDTO } from '../../../core/models/accounting-firm.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FaIconComponent, Button, Modal, AccountingFirmFormComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly accountingFirmService = inject(AccountingFirmService);

  @Output() menuToggle = new EventEmitter<void>();

  readonly menuIcon = faBars;

  readonly firmDialogOpen = signal(false);
  readonly firmLoading = signal(false);
  readonly firm = signal<AccountingFirmDTO | null>(null);

  constructor(
    readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  get userInitial(): string {
    return (this.authService.userName() ?? '?').charAt(0).toUpperCase();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  openFirmDialog(): void {
    this.firmDialogOpen.set(true);
    this.firmLoading.set(true);
    this.accountingFirmService.getAll({ page: 0, size: 1 }).subscribe({
      next: (page) => {
        this.firm.set(page.content[0] ?? { name: '' });
        this.firmLoading.set(false);
      },
      error: () => {
        this.firm.set({ name: '' });
        this.firmLoading.set(false);
      },
    });
  }

  closeFirmDialog(): void {
    this.firmDialogOpen.set(false);
  }

  onFirmSaved(firm: AccountingFirmDTO): void {
    this.firm.set(firm);
    this.closeFirmDialog();
  }
}
