export interface InvoiceAuditLogDTO {
  id?: string;
  externalInvoiceKey: string;
  userId: string;
  companyId: string;
  status: string;
  notes: string;
  deleted?: boolean;
}

export interface InvoiceAuditLogFilterDTO {
  id?: string;
  externalInvoiceKey?: string;
  userId?: string;
  companyId?: string;
  status?: string;
  notes?: string;
  deleted?: boolean;
}
