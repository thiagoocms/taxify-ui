export interface UserDTO {
  id?: string;
  name: string;
  documentNumber: string;
  documentType: string;
  login: string;
  password?: string;
  email: string;
  profile: string;
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
