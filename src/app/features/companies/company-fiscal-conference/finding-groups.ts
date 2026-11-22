/**
 * Agrupa os códigos dos achados da conferência (FiscalCheckFindingDTO.codigo) em temas,
 * para filtrar e rotular. Os códigos vêm do backend (service/fiscalcheck).
 */
export const FINDING_GROUPS = [
  { key: 'RULE', label: 'Regra do produto', test: (code: string) => code.startsWith('RULE_') },
  { key: 'CALC', label: 'Cálculo dos impostos', test: (code: string) => code === 'TAX_CALCULATION' || code === 'TAX_CODE_VALUE' },
  { key: 'REGIME', label: 'Regime do emitente (CRT)', test: (code: string) => code === 'CRT_CST' },
  { key: 'OPERATION', label: 'Operação (CFOP, interestadual)', test: (code: string) => code === 'CFOP_DESTINATION' || code === 'INTERSTATE_RATE' },
  { key: 'IBSCBS', label: 'IBS/CBS', test: (code: string) => code.startsWith('IBSCBS_') },
  { key: 'TOTALS', label: 'Totais da nota', test: (code: string) => code === 'ICMS_TOTALS' },
] as const;

export function findingGroup(code: string): string {
  return FINDING_GROUPS.find((group) => group.test(code))?.key ?? 'OTHER';
}

export function findingGroupLabel(code: string): string {
  return FINDING_GROUPS.find((group) => group.test(code))?.label ?? 'Outros';
}
