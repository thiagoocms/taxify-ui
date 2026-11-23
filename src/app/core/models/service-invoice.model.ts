/** Nota fiscal de serviço (NFS-e), layout nacional ou ABRASF. */
export type ServiceInvoiceDirection = 'PRESTADA' | 'TOMADA' | 'TERCEIRO';

export interface ServiceInvoiceFilter {
  companyId: string;
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  /** PRESTADA, TOMADA ou vazio = todas. */
  direction?: string;
  participant?: string;
  numero?: string;
  somenteComRetencao?: boolean;
  /** SO_SIEG / SO_ADN: há mais de 48h numa fonte e não na outra. */
  fonte?: 'SO_SIEG' | 'SO_ADN';
  page?: number;
  size?: number;
}

export interface ServiceInvoiceSummaryDTO {
  id: string;
  numero?: string | null;
  layout: string;
  issueDate?: string | null;
  competence?: string | null;
  direction: ServiceInvoiceDirection;
  prestadorNome?: string | null;
  prestadorDocumento?: string | null;
  tomadorNome?: string | null;
  tomadorDocumento?: string | null;
  descricaoServico?: string | null;
  valorServico?: number | null;
  valorIss?: number | null;
  issRetido: boolean;
  /** ISS retido + IRRF + CSLL + INSS + PIS/COFINS quando retidos. */
  totalRetido: number;
  canceled: boolean;
  origem: string;
}

export interface ServiceInvoiceDetailDTO extends Omit<ServiceInvoiceSummaryDTO, 'totalRetido'> {
  companyId: string;
  accessKey: string;
  codigoVerificacao?: string | null;
  prestadorMunicipio?: string | null;
  municipioIncidencia?: string | null;
  codigoServico?: string | null;
  codigoTributacaoMunicipal?: string | null;
  valorDeducoes?: number | null;
  baseCalculo?: number | null;
  aliquotaIss?: number | null;
  valorIssRetido?: number | null;
  valorIrrf?: number | null;
  valorPis?: number | null;
  valorCofins?: number | null;
  pisCofinsRetidos: boolean;
  valorCsll?: number | null;
  valorInss?: number | null;
  valorLiquido?: number | null;
  totalRetido: number;
}

export interface ServiceInvoiceDirectionTotalsDTO {
  count: number;
  valorServico: number;
  valorIss: number;
  issRetido: number;
  federaisRetidos: number;
  totalRetido: number;
}

export interface ServiceInvoiceTotalsDTO {
  prestadas: ServiceInvoiceDirectionTotalsDTO;
  tomadas: ServiceInvoiceDirectionTotalsDTO;
  /** Confronto SIEG × Ambiente Nacional: notas numa fonte e não na outra há mais de 48h. */
  soSieg: number;
  soAdn: number;
}

export const SERVICE_INVOICE_ORIGINS: Record<string, string> = {
  SIEG: 'SIEG',
  ADN: 'Ambiente Nacional',
  UPLOAD: 'Upload',
};
