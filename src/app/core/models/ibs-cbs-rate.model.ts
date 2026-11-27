/**
 * Alíquotas de referência de IBS/CBS por ano, com status (spec 2026-11-27-aliquotas-ibs-cbs-por-ano, F1a-0).
 * Contrato de `GET/PUT /platform/ibs-cbs-rates` (console da plataforma) e `GET /reform/ibs-cbs-rates` (leitura dos
 * escritórios). Nomes dos campos em inglês (tradução direta da seção 7 da spec); os valores de enum e os codes de
 * erro seguem a spec.
 *
 * Alíquotas chegam como número decimal em % com até 4 casas (`0.9000` = 0,9%). Só o backend decide se a linha gera
 * achado (`generatesFindings`, AL-RN-02) e quais anos ficam sem lei (`warnings`, AL-RN-05): a tela só exibe.
 */

/** AL-RN-01: só `LAW` (ato oficial publicado) gera achado; as outras ficam como referência. */
export type IbsCbsRateStatus = 'LAW' | 'PENDING' | 'ESTIMATE';

export type IbsCbsRateWarningType = 'NO_LAW';

export type IbsCbsRateAction = 'CREATED' | 'UPDATED';

/** Linha do console (com `version` e auditoria). */
export interface IbsCbsRateDTO {
  year: number;
  cbsRate: number | null;
  ibsStateRate: number | null;
  ibsMunicipalRate: number | null;
  status: IbsCbsRateStatus;
  /** `true` só com `LAW` e as três alíquotas preenchidas (calculado pelo backend). */
  generatesFindings: boolean;
  legalBasis: string | null;
  sourceUrl: string | null;
  version?: number | null;
  changedBy?: string | null;
  changedAt?: string | null;
}

/** AL-RN-05: "{ano}: sem alíquota oficial cadastrada. A conferência não compara..." (texto pronto do backend). */
export interface IbsCbsRateWarningDTO {
  year: number;
  type: IbsCbsRateWarningType;
  text: string;
}

export interface IbsCbsRatesResponseDTO {
  /** Ordem crescente de ano. */
  years: IbsCbsRateDTO[];
  warnings: IbsCbsRateWarningDTO[];
}

/** Corpo do `PUT /platform/ibs-cbs-rates/{year}`: sem `version` = criação (AL-RN-04). */
export interface IbsCbsRateSaveDTO {
  cbsRate: number | null;
  ibsStateRate: number | null;
  ibsMunicipalRate: number | null;
  status: IbsCbsRateStatus;
  legalBasis: string | null;
  sourceUrl: string | null;
  version: number | null;
}

/** Evento do histórico (`GET /platform/ibs-cbs-rates/{year}/history`), mais recente primeiro. */
export interface IbsCbsRateChangeDTO {
  action: IbsCbsRateAction;
  statusBefore: IbsCbsRateStatus | null;
  statusAfter: IbsCbsRateStatus | null;
  cbsBefore: number | null;
  cbsAfter: number | null;
  ibsStateBefore: number | null;
  ibsStateAfter: number | null;
  ibsMunicipalBefore: number | null;
  ibsMunicipalAfter: number | null;
  legalBasisAfter: string | null;
  sourceUrlAfter: string | null;
  changedBy: string;
  changedAt: string;
}

/** Campos do formulário que o 400 `error.reform.rate.invalid` pode apontar em `invalidField`. */
export type IbsCbsRateField = 'cbsRate' | 'ibsStateRate' | 'ibsMunicipalRate';

export const IBS_CBS_RATE_ERRORS = {
  yearInvalid: 'error.reform.rate.year.invalid',
  rateInvalid: 'error.reform.rate.invalid',
  basisRequired: 'error.reform.rate.basis.required',
  /** Fundamento acima de 500 caracteres ou link sem https:// (em qualquer status). */
  basisInvalid: 'error.reform.rate.basis.invalid',
  statusInvalid: 'error.reform.rate.status.invalid',
  conflict: 'error.reform.rate.conflict',
  notFound: 'error.reform.rate.not.found',
} as const;

/** Textos de reserva (seção 7), usados só quando a API não manda a `message`. */
export const IBS_CBS_RATE_ERROR_MESSAGES: Record<string, string> = {
  [IBS_CBS_RATE_ERRORS.yearInvalid]: 'Ano inválido. Use de 2026 a 2040.',
  [IBS_CBS_RATE_ERRORS.rateInvalid]: 'Alíquota inválida: use de 0 a 100, com até 4 casas decimais.',
  [IBS_CBS_RATE_ERRORS.basisRequired]: 'Alíquota com status Lei exige o fundamento e o link do ato oficial.',
  [IBS_CBS_RATE_ERRORS.basisInvalid]: 'O fundamento pode ter até 500 caracteres e o link do ato precisa começar com https://.',
  [IBS_CBS_RATE_ERRORS.statusInvalid]: 'Status inválido.',
  [IBS_CBS_RATE_ERRORS.conflict]: 'Outra pessoa alterou este ano. Recarregue e tente de novo.',
  [IBS_CBS_RATE_ERRORS.notFound]: 'Ano não cadastrado.',
};

/** Limites da AL-RN-03 (o backend é a fonte; o formulário só avisa antes de enviar). */
export const IBS_CBS_RATE_LIMITS = {
  minYear: 2026,
  maxYear: 2040,
  legalBasisMax: 500,
  sourceUrlMax: 300,
} as const;

export const IBS_CBS_RATE_STATUS_ORDER: IbsCbsRateStatus[] = ['LAW', 'PENDING', 'ESTIMATE'];

export const IBS_CBS_RATE_STATUS_LABELS: Record<IbsCbsRateStatus, string> = {
  LAW: 'Lei',
  PENDING: 'Pendente',
  ESTIMATE: 'Estimativa',
};

/** O que cada status faz na conferência: o texto acompanha a cor do selo. */
export const IBS_CBS_RATE_STATUS_HINTS: Record<IbsCbsRateStatus, string> = {
  LAW: 'Ato oficial publicado: a conferência compara as alíquotas das notas do ano e aponta erro na diferença.',
  PENDING: 'Aguardando o ato oficial: aparece só como referência, sem achado.',
  ESTIMATE: 'Número de estudo ou projeção, sem ato: aparece só como referência, sem achado.',
};

export const IBS_CBS_RATE_STATUS_TONES: Record<IbsCbsRateStatus, string> = {
  LAW: 'ok',
  PENDING: 'warn',
  ESTIMATE: 'info',
};

export const IBS_CBS_RATE_ACTION_LABELS: Record<IbsCbsRateAction, string> = {
  CREATED: 'Criada',
  UPDATED: 'Alterada',
};
