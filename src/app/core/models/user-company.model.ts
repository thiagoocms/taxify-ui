export interface UserCompanyDTO {
  userId: string;
  companyId: string;
  role: string;
  deleted?: boolean;
}

export interface UserCompanyFilterDTO {
  userId?: string;
  companyId?: string;
  role?: string;
  deleted?: boolean;
}
