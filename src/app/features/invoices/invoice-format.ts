import { FiscalXmlEnderecoDTO, FiscalXmlItemDTO, FiscalXmlSummaryDTO } from '../../core/models/fiscal-xml.model';

// The API returns the raw codes from the NFe layout (tpNF, finNFe, CRT, ...);
// these maps turn them into what an accountant actually reads on a DANFE.
const TIPO_OPERACAO: Record<string, string> = { '0': 'Entrada', '1': 'Saída' };
const FINALIDADE: Record<string, string> = { '1': 'Normal', '2': 'Complementar', '3': 'Ajuste', '4': 'Devolução' };
const AMBIENTE: Record<string, string> = { '1': 'Produção', '2': 'Homologação' };
const DESTINO: Record<string, string> = { '1': 'Interna', '2': 'Interestadual', '3': 'Exterior' };
const MODELO: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', '58': 'MDF-e' };
const REGIME: Record<string, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional (excesso de sublimite)',
  '3': 'Regime normal',
  '4': 'MEI',
};
const TIPO_EMISSAO: Record<string, string> = {
  '1': 'Normal',
  '2': 'Contingência FS-IA',
  '4': 'Contingência EPEC',
  '5': 'Contingência FS-DA',
  '6': 'Contingência SVC-AN',
  '7': 'Contingência SVC-RS',
  '9': 'Contingência off-line NFC-e',
};
const PRESENCA: Record<string, string> = {
  '0': 'Não se aplica',
  '1': 'Presencial',
  '2': 'Internet',
  '3': 'Teleatendimento',
  '4': 'Entrega em domicílio',
  '5': 'Presencial fora do estabelecimento',
  '9': 'Não presencial (outros)',
};
const INDICADOR_IE: Record<string, string> = { '1': 'Contribuinte ICMS', '2': 'Contribuinte isento', '9': 'Não contribuinte' };
const DOCUMENT_TYPE: Record<string, string> = { NFE: 'NF-e', CTE: 'CT-e', NFSE: 'NFS-e', NFCE: 'NFC-e', MDFE: 'MDF-e' };

function lookup(map: Record<string, string>, code?: string): string {
  if (code == null || code === '') {
    return '';
  }
  return map[code] ? `${map[code]}` : code;
}

export const tipoOperacaoLabel = (code?: string) => lookup(TIPO_OPERACAO, code);
export const finalidadeLabel = (code?: string) => lookup(FINALIDADE, code);
export const ambienteLabel = (code?: string) => lookup(AMBIENTE, code);
export const destinoLabel = (code?: string) => lookup(DESTINO, code);
export const regimeLabel = (code?: string) => lookup(REGIME, code);
export const tipoEmissaoLabel = (code?: string) => lookup(TIPO_EMISSAO, code);
export const presencaLabel = (code?: string) => lookup(PRESENCA, code);
export const indicadorIeLabel = (code?: string) => lookup(INDICADOR_IE, code);

export function documentTypeLabel(xml: FiscalXmlItemDTO | FiscalXmlSummaryDTO): string {
  const modelo = 'identificacao' in xml ? xml.identificacao?.modelo : (xml as FiscalXmlSummaryDTO).modelo;
  if (modelo && MODELO[modelo]) {
    return MODELO[modelo];
  }
  const type = xml.documentType?.toUpperCase() ?? '';
  return DOCUMENT_TYPE[type] ?? (type && type !== 'UNKNOWN' ? type : 'Documento');
}

export function formatDocument(value?: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value ?? '';
}

/** Access key in blocks of 4 digits, as printed on the DANFE. */
export function formatAccessKey(value?: string): string {
  return (value ?? '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatCep(value?: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits.replace(/^(\d{5})(\d{3})$/, '$1-$2') : value ?? '';
}

export function formatNcm(value?: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3') : value ?? '';
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

export function formatCurrency(value?: number | null): string {
  return value == null ? '—' : currency.format(value);
}

export function formatNumber(value?: number | null): string {
  return value == null ? '—' : decimal.format(value);
}

export function formatPercent(value?: number | null): string {
  return value == null ? '—' : `${decimal.format(value)}%`;
}

export function formatDate(value?: string, withTime = false): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatTime(value?: string): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}

/** yyyy-MM-dd in local time, as the API's LocalDate filters expect. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatAddress(endereco?: FiscalXmlEnderecoDTO): string[] {
  if (!endereco) {
    return [];
  }
  const street = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
  // Emitters often fill optional fields with "-" or "." just to satisfy the layout.
  const complemento = /^[\s.\-_]*$/.test(endereco.complemento ?? '') ? '' : endereco.complemento;
  const line1 = [street, complemento].filter(Boolean).join(' — ');
  const city = [endereco.municipio, endereco.uf].filter(Boolean).join('/');
  const line2 = [endereco.bairro, city].filter(Boolean).join(' · ');
  const line3 = [endereco.cep ? `CEP ${formatCep(endereco.cep)}` : '', endereco.pais && endereco.pais.toUpperCase() !== 'BRASIL' ? endereco.pais : '']
    .filter(Boolean)
    .join(' · ');
  return [line1, line2, line3].filter(Boolean);
}

export function issuerName(xml: FiscalXmlItemDTO): string {
  return xml.emitente?.nome || xml.emitente?.nomeFantasia || formatDocument(xml.issuerCnpj) || '—';
}

export function recipientName(xml: FiscalXmlItemDTO): string {
  return xml.destinatario?.nome || formatDocument(xml.recipientCnpj) || '—';
}

export function issuerDocument(xml: FiscalXmlItemDTO): string {
  return formatDocument(xml.emitente?.cnpj || xml.emitente?.cpf || xml.issuerCnpj);
}

export function recipientDocument(xml: FiscalXmlItemDTO): string {
  return formatDocument(xml.destinatario?.cnpj || xml.destinatario?.cpf || xml.recipientCnpj) || xml.destinatario?.idEstrangeiro || '';
}

// List rows (FiscalXmlSummaryDTO) carry the parties flat instead of nested objects.
export function summaryIssuerName(row: FiscalXmlSummaryDTO): string {
  return row.emitenteNome || formatDocument(row.issuerCnpj || row.emitenteCpf) || '—';
}

export function summaryIssuerDocument(row: FiscalXmlSummaryDTO): string {
  return formatDocument(row.issuerCnpj || row.emitenteCpf);
}

export function summaryRecipientName(row: FiscalXmlSummaryDTO): string {
  return row.destinatarioNome || formatDocument(row.recipientCnpj || row.destinatarioCpf) || '—';
}

export function summaryRecipientDocument(row: FiscalXmlSummaryDTO): string {
  return formatDocument(row.recipientCnpj || row.destinatarioCpf);
}

export function issueDateOf(xml: FiscalXmlItemDTO): string | undefined {
  return xml.identificacao?.dataEmissao || xml.issueDate;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
