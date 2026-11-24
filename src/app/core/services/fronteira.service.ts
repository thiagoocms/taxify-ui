import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FormulaCheckDTO, FronteiraReportDTO, FronteiraRuleDTO, FronteiraRuleInput } from '../models/fronteira.model';

@Injectable({ providedIn: 'root' })
export class FronteiraService {
  private readonly baseUrl = `${environment.apiUrl}/fronteira`;

  constructor(private readonly http: HttpClient) {}

  /** Comparativo de um período ("2026-11"); sem período = o último importado. */
  report(companyId: string, periodo?: string | null): Observable<FronteiraReportDTO> {
    let params = new HttpParams().set('companyId', companyId);
    if (periodo) {
      params = params.set('periodo', periodo);
    }
    return this.http.get<FronteiraReportDTO>(this.baseUrl, { params });
  }

  /** O PDF do extrato baixado no e-Fisco; o período sai do próprio arquivo (reimportar substitui). */
  /** Busca agora no e-Fisco o extrato da empresa no período (com o certificado do contador) e importa. */
  syncWithEfisco(companyId: string, periodo: string | null): Observable<EfiscoSyncResponseDTO> {
    const params: Record<string, string> = { companyId };
    if (periodo) {
      params['periodo'] = periodo;
    }
    return this.http.post<EfiscoSyncResponseDTO>(`${this.baseUrl}/sincronizar`, null, { params });
  }

  importExtract(companyId: string, file: File): Observable<FronteiraReportDTO> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FronteiraReportDTO>(`${this.baseUrl}/importar`, formData, { params: { companyId } });
  }

  /** As regras gerais e as da empresa (sem empresa: só as gerais). */
  rules(companyId?: string | null): Observable<FronteiraRuleDTO[]> {
    const params = companyId ? new HttpParams().set('companyId', companyId) : new HttpParams();
    return this.http.get<FronteiraRuleDTO[]>(`${this.baseUrl}/regras`, { params });
  }

  /** Valida e calcula a fórmula: com os valores do item ({@code variaveis}) ou com valores de exemplo. */
  checkFormula(formula: string, variaveis?: Record<string, number> | null): Observable<FormulaCheckDTO> {
    return this.http.post<FormulaCheckDTO>(`${this.baseUrl}/regras/testar`, { formula, variaveis: variaveis ?? null });
  }

  /** Regra geral (todas as empresas) usa outro endereço e outra permissão. */
  saveRule(input: FronteiraRuleInput, id?: string | null): Observable<FronteiraRuleDTO> {
    const base = input.companyId ? `${this.baseUrl}/regras` : `${this.baseUrl}/regras/geral`;
    return id ? this.http.put<FronteiraRuleDTO>(`${base}/${id}`, input) : this.http.post<FronteiraRuleDTO>(base, input);
  }

  deleteRule(rule: FronteiraRuleDTO): Observable<void> {
    const base = rule.companyId ? `${this.baseUrl}/regras` : `${this.baseUrl}/regras/geral`;
    return this.http.delete<void>(`${base}/${rule.id}`);
  }

  reviewRule(id: string, conferida: boolean): Observable<FronteiraRuleDTO> {
    return this.http.post<FronteiraRuleDTO>(`${this.baseUrl}/regras/${id}/conferencia`, {}, {
      params: new HttpParams().set('conferida', conferida),
    });
  }

  enableRule(id: string, ativa: boolean): Observable<FronteiraRuleDTO> {
    return this.http.post<FronteiraRuleDTO>(`${this.baseUrl}/regras/${id}/ativa`, {}, { params: new HttpParams().set('ativa', ativa) });
  }
}

/** Uma empresa na sincronização: IMPORTADO, SEM_EXTRATO, SEM_IE, ERRO. */
export interface EfiscoCompanyResultDTO {
  companyId: string;
  companyName: string;
  period: string;
  status: 'IMPORTADO' | 'SEM_EXTRATO' | 'SEM_IE' | 'ERRO';
  detail?: string | null;
}

/** OK, PARCIAL, ERRO, BLOQUEADO, SEM_CERTIFICADO, EM_ANDAMENTO. */
export interface EfiscoSyncResponseDTO {
  sync: { status: string; detail?: string | null; companies: EfiscoCompanyResultDTO[] };
  report: FronteiraReportDTO;
}
