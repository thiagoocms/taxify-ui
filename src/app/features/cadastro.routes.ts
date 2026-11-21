import { Routes } from '@angular/router';
import { adminGuard, permissionGuard } from '../core/guards/permission.guard';

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
    canActivate: [permissionGuard('COMPANIES_VIEW')],
    loadComponent: () =>
      import('./companies/company-list/company-list.component').then(
        (m) => m.CompanyListComponent,
      ),
  },
  {
    path: 'planos',
    canActivate: [permissionGuard('PLANS_VIEW')],
    loadComponent: () =>
      import('./plans/plan-list/plan-list.component').then((m) => m.PlanListComponent),
  },
  {
    path: 'usuarios',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./users/user-list/user-list.component').then((m) => m.UserListComponent),
  },
];
