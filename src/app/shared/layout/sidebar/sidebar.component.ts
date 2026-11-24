import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuilding,
  faCalculator,
  faChevronDown,
  faFileSignature,
  faFileContract,
  faHandHoldingDollar,
  faCircleQuestion,
  faClipboardCheck,
  faChartColumn,
  faTriangleExclamation,
  faFileInvoice,
  faFolderOpen,
  faHouse,
  faTags,
  faTruck,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FaIconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  @Output() linkClicked = new EventEmitter<void>();

  readonly homeIcon = faHouse;
  readonly buildingIcon = faBuilding;
  readonly invoiceIcon = faFileInvoice;
  readonly assessmentIcon = faCalculator;
  readonly manifestIcon = faFileSignature;
  readonly serviceInvoiceIcon = faFileContract;
  readonly retentionIcon = faHandHoldingDollar;
  readonly helpIcon = faCircleQuestion;
  readonly auditIcon = faClipboardCheck;
  readonly fronteiraIcon = faTruck;
  readonly reportIcon = faChartColumn;
  readonly pendencyIcon = faTriangleExclamation;
  readonly folderIcon = faFolderOpen;
  readonly tagsIcon = faTags;
  readonly usersIcon = faUsers;
  readonly chevronIcon = faChevronDown;
  readonly isAdmin = this.authService.isAdmin;
  readonly canCompanies = this.authService.can('COMPANIES_VIEW');
  readonly canPlans = this.authService.can('PLANS_VIEW');
  readonly canInvoices = this.authService.can('INVOICES_VIEW');
  readonly canAssessment = this.authService.can('TAX_ASSESSMENT_VIEW');
  /** "Cadastro" aparece se o usuário puder abrir pelo menos um dos itens. */
  readonly showRegistry = this.canCompanies || this.canPlans || this.isAdmin;

  readonly cadastroOpen = signal(true);

  toggleCadastro(): void {
    this.cadastroOpen.update((open) => !open);
  }
}
