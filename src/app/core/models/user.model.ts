import { AccessProfile } from './access.model';

export interface UserDTO {
  id?: string;
  name: string;
  documentNumber: string;
  documentType: string;
  login: string;
  password?: string;
  email: string;
  profile: string;
  /** Perfis de acesso do colaborador; ignorado para administrador (que acessa tudo). */
  accessProfiles?: AccessProfile[];
  deleted?: boolean;
}

export interface UserFilterDTO {
  id?: string;
  name?: string;
  documentNumber?: string;
  documentType?: string;
  login?: string;
  email?: string;
  profile?: string;
  deleted?: boolean;
}

/** Códigos dos 409/400 de usuário (POST /signup, POST /users, PUT /users/{id}). */
export const USER_ERRORS = {
  /** Login em uso ou reservado (a mensagem é a mesma nos dois casos, para não revelar a lista). */
  loginExists: 'error.user.login.already.exists',
  documentExists: 'error.user.document.already.exists',
  /** Login novo com `:` (o `:` separa login e senha no POST /auth). Só na criação; logins antigos continuam valendo. */
  loginInvalidChar: 'error.user.login.invalid.char',
  /** ADMIN mudando o próprio login pela tela de usuários (outro ADMIN pode mudar). */
  loginSelfChange: 'error.user.login.self.change',
  /** Senha acima de 72 bytes (limite do BCrypt). */
  passwordInvalid: 'error.user.password.invalid',
  /** Senha em branco onde ela é obrigatória. */
  passwordRequired: 'error.user.password.required',
  /** Senha nova abaixo do mínimo (`minLength` de GET /auth/password/config). */
  passwordTooShort: 'error.user.password.too.short',
  /** Senha nova igual à atual (troca e redefinição). */
  passwordSame: 'error.user.password.same',
  /** ADMIN tentando mudar a própria senha pela tela de usuários: só por Minha conta (P-SN-09). */
  passwordUseSelfChange: 'error.user.password.use.self.change',
} as const;

export const LOGIN_INVALID_CHAR_MESSAGE = 'O login não pode ter ":" (dois-pontos).';

export const LOGIN_SELF_CHANGE_MESSAGE =
  'Você não pode mudar o seu próprio login. Se precisar, peça a outro administrador do escritório.';

/** Códigos só da troca pelo usuário logado (`PUT /users/me/password`). */
export const PASSWORD_CHANGE_ERRORS = {
  /** 400: senha atual errada (não é 401, para não deslogar). */
  currentInvalid: 'error.user.password.current.invalid',
  /** 429: erros demais de senha atual na janela de 60 minutos, mesmo com a senha certa. */
  rateLimited: 'error.user.password.change.rate.limited',
} as const;

/** Códigos da regra de senha (SN-RN-08) que marcam o campo da senha nova. */
export const PASSWORD_RULE_CODES: ReadonlySet<string> = new Set([
  USER_ERRORS.passwordRequired,
  USER_ERRORS.passwordTooShort,
  USER_ERRORS.passwordInvalid,
  USER_ERRORS.passwordSame,
]);

/** Texto padrão de um erro da regra de senha, quando a API não manda `message`. */
export function passwordRuleMessage(code: string | null, minLength: number): string | null {
  switch (code) {
    case USER_ERRORS.passwordRequired:
      return 'Informe a senha.';
    case USER_ERRORS.passwordTooShort:
      return `A senha precisa ter pelo menos ${minLength} caracteres.`;
    case USER_ERRORS.passwordInvalid:
      return PASSWORD_TOO_LONG_MESSAGE;
    case USER_ERRORS.passwordSame:
      return 'A senha nova precisa ser diferente da atual.';
    case USER_ERRORS.passwordUseSelfChange:
      return 'Para trocar a sua própria senha, use Minha conta (ela pede a senha atual).';
    default:
      return null;
  }
}

/** O BCrypt só considera os primeiros 72 bytes da senha. */
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_TOO_LONG_MESSAGE = 'Senha longa demais: use no máximo 72 bytes (acentos e símbolos contam mais de 1).';
