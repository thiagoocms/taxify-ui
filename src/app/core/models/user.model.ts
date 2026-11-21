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
