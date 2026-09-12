export interface AuthLoginDTO {
  auth: string;
}

export interface AuthenticatedDTO {
  token: string;
  userId: string;
  userName: string;
}
