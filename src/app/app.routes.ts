import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { platformAdminGuard } from './core/guards/platform-admin.guard';

export const routes: Routes = [
  // ------------------------------------------------------------------------
  // Área pública (não autenticado): login e cadastro de conta.
  // ------------------------------------------------------------------------
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  // Compatibilidade com links antigos.
  { path: 'login', redirectTo: 'auth/login' },
  { path: 'register', redirectTo: 'auth/register' },

  // Retorno do login OAuth da Conta Azul (CONTA_AZUL_REDIRECT_URI aponta para cá).
  // Fora do layout: normalmente abre na janela pop-up do login, sem menu/cabeçalho.
  {
    path: 'integracoes/conta-azul/callback',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/integrations/conta-azul-callback/conta-azul-callback.component').then(
        (m) => m.ContaAzulCallbackComponent,
      ),
  },

  // ------------------------------------------------------------------------
  // Área autenticada.
  // ------------------------------------------------------------------------
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      // Submenu "Cadastro" (empresas, planos, usuários) — ver features/cadastro.routes.ts.
      {
        path: 'cadastro',
        loadChildren: () => import('./features/cadastro.routes').then((m) => m.CADASTRO_ROUTES),
      },
      {
        path: 'notas-fiscais',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () =>
          import('./features/invoices/invoice-xml-list/invoice-xml-list.component').then(
            (m) => m.InvoiceXmlListComponent,
          ),
      },
      {
        path: 'notas-servico',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () =>
          import('./features/service-invoices/service-invoices.component').then((m) => m.ServiceInvoicesComponent),
      },
      // Minha conta: qualquer usuário logado (troca da própria senha e avisos por e-mail); link do rodapé do resumo.
      {
        path: 'minha-conta',
        loadComponent: () => import('./features/my-account/my-account.component').then((m) => m.MyAccountComponent),
      },
      {
        path: 'ajuda',
        loadComponent: () => import('./features/help/help-center.component').then((m) => m.HelpCenterComponent),
      },
      {
        path: 'ajuda/:id',
        loadComponent: () => import('./features/help/help-center.component').then((m) => m.HelpCenterComponent),
      },
      {
        path: 'auditoria',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () => import('./features/audit/audit.component').then((m) => m.AuditComponent),
      },
      {
        path: 'fronteira',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () => import('./features/fronteira/fronteira.component').then((m) => m.FronteiraComponent),
      },
      {
        path: 'retencoes',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () => import('./features/retentions/retentions.component').then((m) => m.RetentionsComponent),
      },
      {
        path: 'pendencias',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () => import('./features/pendencies/pendencies.component').then((m) => m.PendenciesComponent),
      },
      // Painel de controle da captura de XML: ADMIN (escritório inteiro) e INVOICES_SYNC (FISCAL, só a carteira).
      {
        path: 'captura',
        canActivate: [permissionGuard('INVOICES_SYNC')],
        data: { scope: 'firm' },
        loadComponent: () =>
          import('./features/capture-panel/capture-panel.component').then((m) => m.CapturePanelComponent),
      },
      {
        path: 'manifestacao',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () =>
          import('./features/invoices/manifestation/manifestation.component').then((m) => m.ManifestationComponent),
      },
      {
        path: 'notas-fiscais/:id',
        canActivate: [permissionGuard('INVOICES_VIEW')],
        loadComponent: () =>
          import('./features/invoices/invoice-detail/invoice-detail.component').then(
            (m) => m.InvoiceDetailComponent,
          ),
      },
      {
        path: 'apuracao',
        canActivate: [permissionGuard('TAX_ASSESSMENT_VIEW')],
        loadComponent: () =>
          import('./features/assessment/tax-assessment.component').then((m) => m.TaxAssessmentComponent),
      },
      {
        path: 'relatorios',
        canActivate: [permissionGuard('TAX_ASSESSMENT_VIEW')],
        loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'apuracao/:companyId',
        canActivate: [permissionGuard('TAX_ASSESSMENT_VIEW')],
        loadComponent: () =>
          import('./features/assessment/tax-assessment-detail/tax-assessment-detail.component').then(
            (m) => m.TaxAssessmentDetailComponent,
          ),
      },
      // Console da plataforma (CS Hub): escritórios, situação de acesso e revisão.
      { path: 'plataforma', pathMatch: 'full', redirectTo: 'plataforma/escritorios' },
      {
        path: 'plataforma/escritorios',
        canActivate: [platformAdminGuard],
        loadComponent: () =>
          import('./features/platform/platform-firms/platform-firms.component').then((m) => m.PlatformFirmsComponent),
      },
      // Captura de todos os escritórios (CS Hub). Desligada no ambiente, a API responde 404 e a tela explica.
      {
        path: 'plataforma/captura',
        canActivate: [platformAdminGuard],
        data: { scope: 'platform' },
        loadComponent: () =>
          import('./features/capture-panel/capture-panel.component').then((m) => m.CapturePanelComponent),
      },
      // Compatibilidade com links antigos.
      { path: 'companies', redirectTo: 'cadastro/empresas' },
      { path: 'planos', redirectTo: 'cadastro/planos' },
      { path: 'usuarios', redirectTo: 'cadastro/usuarios' },
    ],
  },
  { path: '**', redirectTo: '' },
];
