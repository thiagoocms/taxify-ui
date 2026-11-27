import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { StockCreditDetailDTO, StockCreditListDTO, StockCreditRowDTO } from '../../../core/models/stock-credit.model';
import { AuthService } from '../../../core/services/auth.service';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { ReformFeaturesService } from '../../../core/services/reform-features.service';
import { StockCreditDetailComponent } from './stock-credit-detail.component';
import { StockCreditComponent } from './stock-credit.component';

// Dados fictícios (CT-CE-01: E1 = 11.222.333/0001-81).
export const ROW: StockCreditRowDTO = {
  companyId: 'e1', companyName: 'Empresa Teste Um Ltda', cnpj: '11222333000181', referenceRegime: 'LUCRO_PRESUMIDO',
  nextYearRegime: null, classification: 'HYPOTHESIS_I', classificationReason: 'Lucro Presumido em dez/2026: hipótese I (LC 214/2025, art. 381, I).',
  yearPurchases: 160000, purchaseItems: 3, inboundInvoices: 3, monthsWithInbound: 2, monthsEvaluated: 11, coverage: 'PARTIAL',
  firstInbound: '2026-10-02', lastInbound: '2026-11-20', status: 'NOT_EVALUATED', statusChangedBy: null, statusChangedAt: null,
  note: null, version: 0, calculatedAt: '2026-12-10T06:15:42-03:00',
};

function list(rows: StockCreditRowDTO[] = [ROW], totalPages = 1): StockCreditListDTO {
  return {
    notice: 'Texto fixo do backend (CE-RN-13).',
    summary: { companies: rows.length, notCalculated: 0, byClassification: { HYPOTHESIS_I: rows.length }, byStatus: { NOT_EVALUATED: rows.length }, yearPurchasesTotal: 160000, oldestCalculatedAt: '2026-12-10T06:15:42-03:00' },
    page: { content: rows, totalElements: rows.length, totalPages, number: 0, size: 50 },
  };
}

describe('StockCreditComponent', () => {
  let fixture: ComponentFixture<StockCreditComponent>;
  let controller: HttpTestingController;
  let navigate: jasmine.Spy;
  let featuresReload: jasmine.Spy;
  const base = `${environment.apiUrl}/reform/stock-credit`;

  function setup(params: Record<string, string> = {}, canClose = true): void {
    featuresReload = jasmine.createSpy('reload');
    TestBed.configureTestingModule({
      imports: [StockCreditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']) },
        { provide: AuthService, useValue: { isAdmin: false, can: (p: string) => p !== 'TAX_ASSESSMENT_CLOSE' || canClose } },
        { provide: ReformFeaturesService, useValue: { stockCreditClosed: signal(false), reload: featuresReload } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} }, queryParamMap: new BehaviorSubject<ParamMap>(convertToParamMap(params)) } },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StockCreditComponent);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => controller.verify());

  it('restaura os filtros da URL, mostra o texto fixo, o resumo e a linha com R$ e CNPJ', () => {
    setup({ classificacao: 'HYPOTHESIS_I', cobertura: 'PARTIAL' });
    const req = controller.expectOne((r) => r.url === base);
    expect(req.request.params.get('classification')).toBe('HYPOTHESIS_I');
    expect(req.request.params.get('coverage')).toBe('PARTIAL');
    req.flush(list());
    fixture.detectChanges();
    expect(text()).toContain('Texto fixo do backend (CE-RN-13).');
    expect(text()).toMatch(/R\$\s160\.000,00/); // Intl usa espaço fixo depois do R$
    expect(text()).toContain('11.222.333/0001-81');
    expect(text()).toContain('2 de 11 meses com entrada');
    expect(text()).toContain('Parcial');
  });

  it('recurso desligado (404 disabled): explica e recarrega o menu', () => {
    setup();
    controller.expectOne((r) => r.url === base).flush({ code: 'error.reform.stock.disabled', message: 'Recurso não disponível.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(text()).toContain('Levantamento não disponível neste ambiente');
    expect(featuresReload).toHaveBeenCalled();
  });

  it('erro: mensagem e "Tentar de novo" que busca de novo', () => {
    setup();
    controller.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'erro' });
    fixture.detectChanges();
    expect(text()).toContain('Não foi possível abrir o levantamento');
    fixture.componentInstance.load();
    controller.expectOne((r) => r.url === base).flush(list());
  });

  it('vazio com filtro diz que é o filtro, não que não há empresas', () => {
    setup({ situacao: 'DISCARDED' });
    controller.expectOne((r) => r.url === base).flush(list([]));
    fixture.detectChanges();
    expect(text()).toContain('Nenhuma empresa com esses filtros');
  });

  it('página da URL além do total volta para a última válida', () => {
    setup({ page: '7' });
    controller.expectOne((r) => r.url === base).flush(list([ROW], 2));
    expect(navigate).toHaveBeenCalled();
    expect(navigate.calls.mostRecent().args[1].queryParams.page).toBe(1);
  });

  it('erro do CSV chega como Blob: lê o JSON e mostra a mensagem do code (recurso desligado)', async () => {
    setup();
    controller.expectOne((r) => r.url === base).flush(list());
    fixture.componentInstance.exportCsv();
    const body = new Blob([JSON.stringify({ status: 404, code: 'error.reform.stock.disabled' })], { type: 'application/json' });
    controller.expectOne((r) => r.url === `${base}/export.csv`).flush(body, { status: 404, statusText: 'Not Found' });
    // A leitura do Blob é assíncrona: espera o toast (no máximo 1 s).
    const toastr = TestBed.inject(ToastrService) as jasmine.SpyObj<ToastrService>;
    for (let i = 0; i < 50 && !toastr.warning.calls.count(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(toastr.warning).toHaveBeenCalledWith('Recurso não disponível.', 'Exportar CSV');
    expect(fixture.componentInstance.featureDisabled()).toBeTrue();
    expect(featuresReload).toHaveBeenCalled();
  });

  it('busca curta avisa e não filtra', () => {
    setup({ busca: 'ab' });
    const req = controller.expectOne((r) => r.url === base);
    expect(req.request.params.has('search')).toBeFalse();
    req.flush(list());
    fixture.detectChanges();
    expect(text()).toContain('Digite pelo menos 3 caracteres');
  });
});

describe('StockCreditDetailComponent', () => {
  let fixture: ComponentFixture<StockCreditDetailComponent>;
  let controller: HttpTestingController;
  let readOnly: ReturnType<typeof signal<boolean>>;
  const base = `${environment.apiUrl}/reform/stock-credit`;

  const DETAIL: StockCreditDetailDTO = {
    ...ROW, notice: 'Texto fixo.', referenceRegimeSince: '2025-01-01', referenceRegimeSource: 'HISTORY', note: null,
    purchasesByMonth: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, amount: 0, invoices: 0 })),
    purchasesByPisCst: [{ cst: '01', amount: 120000, items: 1 }], topNcm: [{ ncm: '22030000', amount: 130000, items: 2 }],
    memory: ['Regime de referência: Lucro Presumido.', 'Calculado em 10/12/2026 06:15.'], refreshAvailableAt: null, closed: false,
  };

  function setup(canWrite: boolean): void {
    readOnly = signal(false);
    TestBed.configureTestingModule({
      imports: [StockCreditDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']) },
        { provide: FirmAccessService, useValue: { readOnly, reload: jasmine.createSpy('reload') } },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StockCreditDetailComponent);
    fixture.componentRef.setInput('row', ROW);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === `${base}/e1`).flush(DETAIL);
    controller.expectOne((r) => r.url === `${base}/e1/history`).flush([]);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => controller.verify());

  it('mostra motivo, memória e quebras; sem TAX_ASSESSMENT_CLOSE não há botões de escrita (CA-CE-15)', () => {
    setup(false);
    expect(text()).toContain('hipótese I (LC 214/2025, art. 381, I)');
    expect(text()).toContain('Calculado em 10/12/2026 06:15.');
    expect(text()).toContain('2203.00.00');
    expect(text()).not.toContain('Atualizar agora');
    expect(text()).not.toContain('Salvar situação');
  });

  it('somente leitura: botões desabilitados com o motivo', () => {
    setup(true);
    readOnly.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Somente leitura');
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-button button')] as HTMLButtonElement[];
    expect(buttons.find((b) => b.textContent?.includes('Atualizar agora'))?.disabled).toBeTrue();
  });

  it('QA: encerrado, o select da situação e a observação ficam desabilitados na tela', () => {
    setup(true);
    fixture.componentRef.setInput('surveyClosed', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#sc-status-select') as HTMLSelectElement).disabled).toBeTrue();
    expect((el.querySelector('#sc-note') as HTMLTextAreaElement).disabled).toBeTrue();
    expect(el.textContent).toContain('encerrado em 30/06/2027');
  });

  it('CA-CE-07: 409 de conflito recarrega a empresa e avisa', () => {
    setup(true);
    const component = fixture.componentInstance;
    component.statusControl.setValue('NOTIFIED');
    component.saveStatus();
    const put = controller.expectOne(`${base}/e1/status`);
    expect(put.request.body).toEqual({ year: 2026, status: 'NOTIFIED', note: null, version: 0 });
    put.flush({ code: 'error.reform.stock.status.conflict', currentVersion: 1 }, { status: 409, statusText: 'Conflict' });
    controller.expectOne((r) => r.url === `${base}/e1`).flush({ ...DETAIL, status: 'NOTIFIED', version: 1 });
    controller.expectOne((r) => r.url === `${base}/e1/history`).flush([]);
    fixture.detectChanges();
    expect(text()).toContain('Outra pessoa alterou esta empresa');
    expect(component.detail()?.version).toBe(1);
  });

  it('"Atualizar agora" com cálculo que falhou: aviso no painel e o botão continua liberado (sem cooldown)', () => {
    setup(true);
    const component = fixture.componentInstance;
    component.refresh();
    controller
      .expectOne((r) => r.url === `${base}/e1/refresh`)
      .flush({ code: 'error.reform.stock.calculation.failed', message: 'Regime inválido no histórico.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(component.panelNotice()).toBe('Regime inválido no histórico.');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Regime inválido no histórico.');
    expect(component.refreshView().disabled).toBeFalse();
  });

  it('observação longa demais marca o campo', () => {
    setup(true);
    const component = fixture.componentInstance;
    component.noteControl.setValue('x');
    component.saveStatus();
    controller.expectOne(`${base}/e1/status`).flush({ code: 'error.reform.stock.note.too.long' }, { status: 400, statusText: 'Bad Request' });
    expect(component.noteControl.errors?.['server']).toBe('A observação pode ter até 500 caracteres.');
  });
});
