import { Routes } from '@angular/router';

/**
 * Rotas públicas (usuário não autenticado).
 * /auth/login    -> tela de login
 * /auth/register -> tela de cadastro (mesmo componente, aba inicial diferente)
 */
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth.component').then((m) => m.AuthComponent),
  },
];
