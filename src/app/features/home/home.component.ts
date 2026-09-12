import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuilding,
  faFileInvoice,
  faTags,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Page } from '../../shared/components/page/page';
import { AuthService } from '../../core/services/auth.service';

interface HomeShortcut {
  label: string;
  description: string;
  routerLink: string;
  icon: typeof faBuilding;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FaIconComponent, Page],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly authService = inject(AuthService);

  readonly userName = this.authService.userName;
  readonly isAdmin = this.authService.isAdmin;

  readonly shortcuts: HomeShortcut[] = [
    {
      label: 'Empresas',
      description: 'Gerencie as empresas cadastradas na plataforma',
      routerLink: '/cadastro/empresas',
      icon: faBuilding,
      adminOnly: true,
    },
    {
      label: 'Planos',
      description: 'Configure os planos disponíveis',
      routerLink: '/cadastro/planos',
      icon: faTags,
      adminOnly: true,
    },
    {
      label: 'Usuários',
      description: 'Administre os usuários do sistema',
      routerLink: '/cadastro/usuarios',
      icon: faUsers,
      adminOnly: true,
    },
    {
      label: 'Notas fiscais',
      description: 'Acompanhe as notas fiscais importadas',
      routerLink: '/notas-fiscais',
      icon: faFileInvoice,
    },
  ];
}
