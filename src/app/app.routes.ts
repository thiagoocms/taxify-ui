import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
        loadComponent: () =>
          import('./features/invoices/invoice-xml-list/invoice-xml-list.component').then(
            (m) => m.InvoiceXmlListComponent,
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
