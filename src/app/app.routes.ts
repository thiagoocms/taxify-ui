import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'register',
    redirectTo: () => '/login?mode=register',
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'companies' },
      {
        path: 'companies',
        loadComponent: () =>
          import('./features/companies/company-list/company-list.component').then(
            (m) => m.CompanyListComponent,
          ),
      },
      {
        path: 'planos',
        loadComponent: () =>
          import('./features/plans/plan-list/plan-list.component').then(
            (m) => m.PlanListComponent,
          ),
      },
      {
        path: 'vinculos',
        loadComponent: () =>
          import('./features/user-companies/user-company-list.component').then(
            (m) => m.UserCompanyListComponent,
          ),
      },
      {
        path: 'notas-fiscais',
        loadComponent: () =>
          import('./features/invoices/invoice-xml-list/invoice-xml-list.component').then(
            (m) => m.InvoiceXmlListComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
