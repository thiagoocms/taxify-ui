import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuilding,
  faChevronDown,
  faFileInvoice,
  faFolderOpen,
  faLink,
  faTags,
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

  readonly buildingIcon = faBuilding;
  readonly linkIcon = faLink;
  readonly invoiceIcon = faFileInvoice;
  readonly folderIcon = faFolderOpen;
  readonly tagsIcon = faTags;
  readonly chevronIcon = faChevronDown;
  readonly isAdmin = this.authService.isAdmin;

  readonly cadastroOpen = signal(true);

  toggleCadastro(): void {
    this.cadastroOpen.update((open) => !open);
  }
}
