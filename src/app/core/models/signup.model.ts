/** Contratos do cadastro público (spec 2026-11-26 taxify-saas, F1-RN-01 a F1-RN-03 e F1-RN-11). */

/** `GET /signup/config`: com `available = false`, a tela esconde "Criar conta". */
export interface SignupConfigDTO {
  available: boolean;
  termsVersion: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  dpaUrl: string | null;
  trialDays: number;
  verificationHours: number;
}

/** `POST /signup`. Sem campo de perfil: quem se cadastra é sempre o ADMIN do escritório novo. */
export interface SignupRequestDTO {
  firm: {
    name: string;
    /** CNPJ, só dígitos. */
    documentNumber: string;
    billingEmail: string;
    /** DDD + número, só dígitos. */
    contactPhone: string;
  };
  user: {
    name: string;
    /** CPF, só dígitos. */
    document: string;
    login: string;
    email: string;
    password: string;
  };
  termsVersion: string;
}

export interface SignupResponseDTO {
  status: 'PENDING_VERIFICATION';
  verificationHours: number;
}

export interface SignupVerifyResponseDTO {
  status: 'TRIAL';
  trialEndsOn: string;
}

export const SIGNUP_ERRORS = {
  unavailable: 'error.signup.unavailable',
  termsRequired: 'error.signup.terms.required',
  termsOutdated: 'error.signup.terms.outdated',
  firmDocumentInvalid: 'error.signup.firm.document.invalid',
  firmDocumentExists: 'error.signup.firm.document.exists',
  billingEmailInvalid: 'error.signup.billing.email.invalid',
  phoneInvalid: 'error.signup.phone.invalid',
  userDocumentInvalid: 'error.signup.user.document.invalid',
  emailInvalid: 'error.signup.email.invalid',
  loginInvalid: 'error.signup.login.invalid',
  conflict: 'error.signup.conflict',
  rateLimited: 'error.signup.rate.limited',
  tokenInvalid: 'error.signup.token.invalid',
  emailNotVerified: 'error.signup.email.not.verified',
} as const;
