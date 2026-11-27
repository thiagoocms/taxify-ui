import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EMPTY_FILTER } from '../../features/reform/stock-credit/stock-credit-url';
import { IbsCbsRateService } from './ibs-cbs-rate.service';
import { StockCreditService } from './stock-credit.service';

describe('StockCreditService', () => {
  let service: StockCreditService;
  let controller: HttpTestingController;
  const base = `${environment.apiUrl}/reform/stock-credit`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StockCreditService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista: year=2026 sempre, listas com vírgula, página da API começando em 0', () => {
    service.getAll({ ...EMPTY_FILTER, classification: ['HYPOTHESIS_I', 'OUT_OF_SCOPE'], status: ['NOTIFIED'], search: ' textil ', sort: 'yearPurchases,desc', page: 2 }).subscribe();
    const req = controller.expectOne((r) => r.url === base);
    expect(req.request.params.get('year')).toBe('2026');
    expect(req.request.params.get('classification')).toBe('HYPOTHESIS_I,OUT_OF_SCOPE');
    expect(req.request.params.get('status')).toBe('NOTIFIED');
    expect(req.request.params.get('search')).toBe('textil');
    expect(req.request.params.get('sort')).toBe('yearPurchases,desc');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.has('coverage')).toBeFalse();
    req.flush({});
  });

  it('busca com menos de 3 caracteres não vai para a API', () => {
    service.getAll({ ...EMPTY_FILTER, search: 'ab' }).subscribe();
    const req = controller.expectOne((r) => r.url === base);
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({});
  });

  it('CSV com os mesmos filtros, sem paginação, como blob', () => {
    service.exportCsv({ ...EMPTY_FILTER, coverage: ['PARTIAL'], page: 3 }).subscribe();
    const req = controller.expectOne((r) => r.url === `${base}/export.csv`);
    expect(req.request.params.get('coverage')).toBe('PARTIAL');
    expect(req.request.params.has('page')).toBeFalse();
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('situação: PUT com year, status, note e version', () => {
    service.updateStatus('c1', { year: 2026, status: 'NOTIFIED', note: null, version: 3 }).subscribe();
    const req = controller.expectOne(`${base}/c1/status`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ year: 2026, status: 'NOTIFIED', note: null, version: 3 });
    req.flush({});
    service.refresh('c1').subscribe();
    const refresh = controller.expectOne((r) => r.url === `${base}/c1/refresh`);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.params.get('year')).toBe('2026');
    refresh.flush({});
  });
});

describe('IbsCbsRateService', () => {
  let service: IbsCbsRateService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(IbsCbsRateService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('PUT por ano no console; criação vai com version nula', () => {
    const body = { cbsRate: 8.8, ibsStateRate: null, ibsMunicipalRate: null, status: 'PENDING' as const, legalBasis: null, sourceUrl: null, version: null };
    service.save(2027, body).subscribe();
    const req = controller.expectOne(`${environment.apiUrl}/platform/ibs-cbs-rates/2027`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('referência dos escritórios: uma chamada compartilhada entre as telas; falha vira null', () => {
    const results: unknown[] = [];
    service.reference().subscribe((r) => results.push(r));
    service.reference().subscribe((r) => results.push(r));
    controller.expectOne(`${environment.apiUrl}/reform/ibs-cbs-rates`).flush('x', { status: 500, statusText: 'erro' });
    expect(results).toEqual([null, null]);
    service.reference().subscribe();
    controller.expectOne(`${environment.apiUrl}/reform/ibs-cbs-rates`).flush({ years: [], warnings: [] });
  });
});
