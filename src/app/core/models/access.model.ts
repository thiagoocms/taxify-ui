/** Permissões vindas do token (ver Permission.java) — a tela checa permissão, nunca nome de perfil. */
export type Permission =
  | 'COMPANIES_VIEW'
  | 'INVOICES_VIEW'
  | 'INVOICES_SYNC'
  | 'INVOICES_RECTIFY'
  | 'INVOICES_AUDIT'
  | 'FISCAL_RULES_VIEW'
  | 'FISCAL_RULES_MANAGE'
  | 'TAX_ASSESSMENT_VIEW'
  | 'PLANS_VIEW'
  | 'SUBSCRIPTIONS_VIEW'
  | 'SUBSCRIPTIONS_MANAGE'
  | 'BILLING_VIEW'
  | 'BILLING_SYNC';

/** Perfis fixos de acesso (ver AccessProfile.java); um colaborador pode ter vários. */
export type AccessProfile = 'FISCAL' | 'ACCOUNTING' | 'FINANCIAL' | 'PAYROLL' | 'MANAGEMENT';

export const ACCESS_PROFILE_OPTIONS: { value: AccessProfile; label: string; description: string }[] = [
  { value: 'FISCAL', label: 'Fiscal', description: 'Notas, SIEG, auditoria, retificação, regras fiscais e apuração' },
  { value: 'ACCOUNTING', label: 'Contábil', description: 'Consulta notas, regras fiscais e apuração' },
  { value: 'FINANCIAL', label: 'Financeiro', description: 'Planos, assinaturas, honorários e cobranças' },
  { value: 'PAYROLL', label: 'Departamento pessoal', description: 'Carteira de empresas (módulos de DP em breve)' },
  { value: 'MANAGEMENT', label: 'Gestão', description: 'Vê tudo, sem alterar' },
];

export const ACCESS_PROFILE_LABELS: Record<AccessProfile, string> = Object.fromEntries(
  ACCESS_PROFILE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AccessProfile, string>;
