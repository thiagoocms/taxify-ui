import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

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
      {
        path: 'ajuda',
        loadComponent: () => import('./features/help/help-center.component').then((m) => m.HelpCenterComponent),
      },
      {
        path: 'ajuda/:id',
        loadComponent: () => import('./features/help/help-center.component').then((m) => m.HelpCenterComponent),
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
        path: 'apuracao/:companyId',
        canActivate: [permissionGuard('TAX_ASSESSMENT_VIEW')],
        loadComponent: () =>
          import('./features/assessment/tax-assessment-detail/tax-assessment-detail.component').then(
            (m) => m.TaxAssessmentDetailComponent,
          ),
      },
      // Compatibilidade com links antigos.
      { path: 'companies', redirectTo: 'cadastro/empresas' },
      { path: 'planos', redirectTo: 'cadastro/planos' },
      { path: 'usuarios', redirectTo: 'cadastro/usuarios' },
    ],
  },
  { path: '**', redirectTo: '' },
];
