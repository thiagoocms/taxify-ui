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
  /** Senha acima de 72 bytes (limite do BCrypt). */
  passwordInvalid: 'error.user.password.invalid',
} as const;

/** O BCrypt só considera os primeiros 72 bytes da senha. */
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_TOO_LONG_MESSAGE = 'Senha longa demais: use no máximo 72 bytes (acentos e símbolos contam mais de 1).';
