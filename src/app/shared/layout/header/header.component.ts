import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Output, signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBars, faBuilding, faChartLine, faUserGear } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../components/button/button';
import { Modal } from '../../components/modal/modal';
import { AccountingFirmFormComponent } from '../../../features/accounting-firm/accounting-firm-form/accounting-firm-form.component';
import { AccountingFirmDTO } from '../../../core/models/accounting-firm.model';
import { AccountingFirmService } from '../../../core/services/accounting-firm.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoaderComponent } from '../../components/loader/loader';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LoaderComponent, CommonModule, RouterLink, FaIconComponent, Button, Modal, AccountingFirmFormComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly accountingFirmService = inject(AccountingFirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Output() menuToggle = new EventEmitter<void>();
  @ViewChild('avatarButton') private avatarButton?: ElementRef<HTMLButtonElement>;

  readonly menuIcon = faBars;
  readonly brandIcon = faChartLine;
  readonly accountIcon = faUserGear;
  readonly firmIcon = faBuilding;

  readonly userMenuOpen = signal(false);
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

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
    if (this.userMenuOpen()) {
      // Foco no primeiro item, para seguir pelo teclado.
      setTimeout(() =>
        this.host.nativeElement.querySelector<HTMLElement>('.user-menu-panel a, .user-menu-panel button')?.focus(),
      );
    }
  }

  closeUserMenu(returnFocus = false): void {
    if (!this.userMenuOpen()) {
      return;
    }
    this.userMenuOpen.set(false);
    if (returnFocus) {
      this.avatarButton?.nativeElement.focus();
    }
  }

  /** Clique fora do menu, ou o foco saindo dele pelo Tab, fecha. */
  @HostListener('document:click', ['$event'])
  @HostListener('document:focusin', ['$event'])
  onDocumentEvent(event: Event): void {
    const menu = this.host.nativeElement.querySelector('.user-menu');
    if (this.userMenuOpen() && menu && !menu.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  openFirmDialog(): void {
    this.closeUserMenu();
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
    this.accountingFirmService.setCurrent(firm);
    this.closeFirmDialog();
  }
}
