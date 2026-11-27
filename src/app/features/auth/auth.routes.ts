import { Routes } from '@angular/router';

/**
 * Rotas públicas (usuário não autenticado).
 * /auth/login    -> tela de login
 * /auth/register -> tela de cadastro (mesmo componente, aba inicial diferente)
 * /auth/esqueci-a-senha -> login já com o pedido do link de senha nova aberto
 * /auth/verificar?token=... -> confirmação do e-mail do cadastro (link do e-mail)
 * /auth/redefinir-senha#token=... -> senha nova pelo link do e-mail (o token vai no fragmento, fora dos logs)
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
  {
    path: 'esqueci-a-senha',
    loadComponent: () => import('./auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'verificar',
    loadComponent: () => import('./verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'redefinir-senha',
    loadComponent: () => import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
];
