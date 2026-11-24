import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuilding,
  faCalculator,
  faChartColumn,
  faCircleQuestion,
  faClipboardCheck,
  faFileContract,
  faFileInvoice,
  faFileSignature,
  faHandHoldingDollar,
  faTags,
  faTriangleExclamation,
  faTruck,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Permission } from '../../core/models/access.model';
import { AuthService } from '../../core/services/auth.service';
import { Page } from '../../shared/components/page/page';

interface HomeShortcut {
  label: string;
  description: string;
  routerLink: string;
  icon: typeof faBuilding;
  /** Quem vê: a mesma permissão do menu lateral; 'ADMIN' = só administrador; sem = todos. */
  access?: Permission | 'ADMIN';
}

interface HomeGroup {
  title: string;
  shortcuts: HomeShortcut[];
}

/**
 * Início: os atalhos das telas que o usuário pode abrir - os mesmos do menu lateral, com as mesmas permissões
 * do perfil de acesso, agrupados pela rotina do escritório.
 */
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

  private readonly allGroups: HomeGroup[] = [
    {
      title: 'Rotina do mês',
      shortcuts: [
        { label: 'Pendências', description: 'O que falta em cada empresa da carteira, por prioridade', routerLink: '/pendencias',
          icon: faTriangleExclamation, access: 'INVOICES_VIEW' },
        { label: 'Notas fiscais', description: 'Consulte, confira e exporte as NF-e de entrada e saída', routerLink: '/notas-fiscais',
          icon: faFileInvoice, access: 'INVOICES_VIEW' },
        { label: 'Notas de serviço', description: 'NFS-e prestadas e tomadas, com ISS e retenções', routerLink: '/notas-servico',
          icon: faFileContract, access: 'INVOICES_VIEW' },
        { label: 'Manifestação', description: 'Notas de entrada que precisam de manifestação, com o prazo', routerLink: '/manifestacao',
          icon: faFileSignature, access: 'INVOICES_VIEW' },
        { label: 'Retenções', description: 'O que recolher e compensar na competência', routerLink: '/retencoes',
          icon: faHandHoldingDollar, access: 'INVOICES_VIEW' },
        { label: 'Fronteira PE', description: 'O ICMS antecipado do e-Fisco conferido nota a nota, com a guia ajustada',
          routerLink: '/fronteira', icon: faTruck, access: 'INVOICES_VIEW' },
        { label: 'Auditoria', description: 'Os cruzamentos da fiscalização, antes dela', routerLink: '/auditoria',
          icon: faClipboardCheck, access: 'INVOICES_VIEW' },
        { label: 'Apuração', description: 'Faturamento, impostos estimados e fechamento do mês', routerLink: '/apuracao',
          icon: faCalculator, access: 'TAX_ASSESSMENT_VIEW' },
        { label: 'Relatórios', description: 'Relatório mensal, curva ABC e simulação de regimes', routerLink: '/relatorios',
          icon: faChartColumn, access: 'TAX_ASSESSMENT_VIEW' },
      ],
    },
    {
      title: 'Cadastro',
      shortcuts: [
        { label: 'Empresas', description: 'Empresas, regime, certificado A1 e planos assinados', routerLink: '/cadastro/empresas',
          icon: faBuilding, access: 'COMPANIES_VIEW' },
        { label: 'Planos', description: 'Os planos e os serviços que cada um liga', routerLink: '/cadastro/planos',
          icon: faTags, access: 'PLANS_VIEW' },
        { label: 'Usuários', description: 'Usuários, perfis de acesso e carteira de empresas', routerLink: '/cadastro/usuarios',
          icon: faUsers, access: 'ADMIN' },
      ],
    },
    {
      title: 'Ajuda',
      shortcuts: [
        { label: 'Tutoriais e ajuda', description: 'Passo a passo dos fluxos principais e como cada tela funciona',
          routerLink: '/ajuda', icon: faCircleQuestion },
      ],
    },
  ];

  /** Só os grupos e atalhos que o perfil do usuário pode abrir. */
  readonly groups: HomeGroup[] = this.allGroups
    .map((group) => ({ ...group, shortcuts: group.shortcuts.filter((s) => this.allowed(s)) }))
    .filter((group) => group.shortcuts.length > 0);

  private allowed(shortcut: HomeShortcut): boolean {
    if (!shortcut.access) {
      return true;
    }
    return shortcut.access === 'ADMIN' ? this.authService.isAdmin : this.authService.can(shortcut.access);
  }
}
