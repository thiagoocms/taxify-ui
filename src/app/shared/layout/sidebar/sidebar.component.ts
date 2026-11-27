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
  faBuildingShield,
  faSatelliteDish,
} from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../../core/services/auth.service';
import { FirmAccessService } from '../../../core/services/firm-access.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FaIconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly firmAccess = inject(FirmAccessService);

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
  readonly platformIcon = faBuildingShield;
  readonly captureIcon = faSatelliteDish;
  /** Menu "Plataforma" (console dos escritórios): só o admin da plataforma, pelo `platformAdmin` do /firm-access. */
  readonly isPlatformAdmin = this.firmAccess.platformAdmin;
  readonly chevronIcon = faChevronDown;
  readonly isAdmin = this.authService.isAdmin;
  readonly canCompanies = this.authService.can('COMPANIES_VIEW');
  readonly canPlans = this.authService.can('PLANS_VIEW');
  readonly canInvoices = this.authService.can('INVOICES_VIEW');
  readonly canAssessment = this.authService.can('TAX_ASSESSMENT_VIEW');
  /** Painel de captura do escritório: ADMIN (escritório inteiro) e INVOICES_SYNC (FISCAL, só a carteira). */
  readonly canCapturePanel = this.authService.can('INVOICES_SYNC');
  /** Captura da plataforma: `capturePanelPlatformEnabled` do /firm-access (visão ligada e admin da plataforma). */
  readonly platformCaptureEnabled = this.firmAccess.capturePanelPlatformEnabled;
  /** "Cadastro" aparece se o usuário puder abrir pelo menos um dos itens. */
  readonly showRegistry = this.canCompanies || this.canPlans || this.isAdmin;

  readonly cadastroOpen = signal(true);

  toggleCadastro(): void {
    this.cadastroOpen.update((open) => !open);
  }
}
