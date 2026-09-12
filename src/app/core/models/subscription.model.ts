export interface SubscriptionDTO {
  id?: string;
  companyId: string;
  planId: string;
  startDate: string;
  endDate: string;
  deleted?: boolean;
}

export interface SubscriptionFilterDTO {
  id?: string;
  companyId?: string;
  planId?: string;
  deleted?: boolean;
}
