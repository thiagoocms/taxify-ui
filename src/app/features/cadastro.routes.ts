import { Routes } from '@angular/router';

/**
 * Submenu "Cadastro" (área administrativa).
 * /cadastro/empresas
 * /cadastro/planos
 * /cadastro/usuarios
 */
export const CADASTRO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'empresas' },
  {
    path: 'empresas',
    loadComponent: () =>
      import('./companies/company-list/company-list.component').then(
        (m) => m.CompanyListComponent,
      ),
  },
  {
    path: 'planos',
    loadComponent: () =>
      import('./plans/plan-list/plan-list.component').then((m) => m.PlanListComponent),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./users/user-list/user-list.component').then((m) => m.UserListComponent),
  },
];
