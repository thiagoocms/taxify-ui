import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { IbsCbsRateDTO, IbsCbsRatesResponseDTO } from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsRateFormComponent } from './ibs-cbs-rate-form.component';
import { IbsCbsRateListComponent } from './ibs-cbs-rate-list.component';

const R2026: IbsCbsRateDTO = {
  year: 2026, cbsRate: 0.9, ibsStateRate: 0.1, ibsMunicipalRate: 0, status: 'LAW', generatesFindings: true,
  legalBasis: 'LC 214/2025', sourceUrl: 'https://exemplo.test/ato', version: 0, changedBy: 'system', changedAt: '2026-11-27T08:00:00-03:00',
};
const R2027: IbsCbsRateDTO = { ...R2026, year: 2027, cbsRate: 8.8, status: 'ESTIMATE', generatesFindings: false, legalBasis: null, sourceUrl: null, version: 1 };
const RESPONSE: IbsCbsRatesResponseDTO = {
  years: [R2026, R2027],
  warnings: [{ year: 2027, type: 'NO_LAW', text: '2027: sem alíquota oficial cadastrada. A conferência não compara as alíquotas de IBS/CBS das notas desse ano.' }],
};
const url = `${environment.apiUrl}/platform/ibs-cbs-rates`;

function providers() {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']) },
  ];
}

describe('IbsCbsRateListComponent', () => {
  let fixture: ComponentFixture<IbsCbsRateListComponent>;
  let controller: HttpTestingController;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IbsCbsRateListComponent], providers: providers() });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IbsCbsRateListComponent);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('CA-AL-06: lista os anos com o selo e o aviso NO_LAW do backend', () => {
    controller.expectOne(url).flush(RESPONSE);
    fixture.detectChanges();
    expect(text()).toContain('2027: sem alíquota oficial cadastrada');
    expect(text()).toContain('Gera achado na conferência');
    expect(text()).toContain('Só referência, sem achado');
    expect(text()).toContain('0,9%');
    expect(fixture.componentInstance.suggestedYear()).toBe(2028);
  });

  it('erro ao carregar: mensagem e tentar de novo', () => {
    controller.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text()).toContain('Só o administrador da plataforma');
  });

  it('AL-RN-04: 409 recarrega e reabre o ano com a versão atual e o aviso', () => {
    controller.expectOne(url).flush(RESPONSE);
    const component = fixture.componentInstance;
    component.openEditForm(R2027);
    component.onConflict({ year: 2027, message: 'Outra pessoa alterou este ano. Recarregue e tente de novo.' });
    controller.expectOne(url).flush({ ...RESPONSE, years: [R2026, { ...R2027, version: 2, status: 'LAW' }] });
    expect(component.editing()?.version).toBe(2);
    expect(component.formNotice()).toContain('Outra pessoa alterou este ano');
    expect(component.viewMode()).toBe('form');
  });
});

describe('IbsCbsRateFormComponent', () => {
  let fixture: ComponentFixture<IbsCbsRateFormComponent>;
  let controller: HttpTestingController;
  let component: IbsCbsRateFormComponent;

  function open(rate: IbsCbsRateDTO | null): void {
    TestBed.configureTestingModule({ imports: [IbsCbsRateFormComponent], providers: providers() });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IbsCbsRateFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rate', rate);
    fixture.componentRef.setInput('suggestedYear', 2027);
    fixture.detectChanges();
  }

  afterEach(() => controller.verify());

  it('CA-AL-04: LAW sem link não envia e marca o campo', () => {
    open(R2027);
    component.form.controls.status.setValue('LAW');
    component.form.controls.legalBasis.setValue('Ato fictício');
    component.submit();
    controller.expectNone(`${url}/2027`);
    expect(component.form.controls.sourceUrl.hasError('required')).toBeTrue();
    expect(component.form.controls.year.disabled).toBeTrue();
  });

  it('QA: na edição o PUT vai sempre para o ano aberto, mesmo com outro ano no campo; o campo fica desabilitado na tela', () => {
    open({ ...R2027, year: 2028, version: 0 });
    const yearInput = (fixture.nativeElement as HTMLElement).querySelector('#rate-year') as HTMLInputElement;
    expect(yearInput.disabled).toBeTrue();
    component.form.controls.year.setValue(2026);
    component.submit();
    controller.expectNone(`${url}/2026`);
    const req = controller.expectOne(`${url}/2028`);
    expect(req.request.body.version).toBe(0);
    req.flush({ ...R2027, year: 2028 });
  });

  it('CT-AL-07: PENDING só com CBS envia os IBS nulos, com a version lida', () => {
    open(R2027);
    component.form.patchValue({ status: 'PENDING', cbsRate: '8,8', ibsStateRate: '', ibsMunicipalRate: '' });
    component.submit();
    const req = controller.expectOne(`${url}/2027`);
    expect(req.request.body).toEqual({ cbsRate: 8.8, ibsStateRate: null, ibsMunicipalRate: null, status: 'PENDING', legalBasis: null, sourceUrl: null, version: 1 });
    req.flush({ ...R2027, status: 'PENDING' });
  });

  it('ano novo vai sem version; 400 com invalidField marca o campo', () => {
    open(null);
    component.form.patchValue({ status: 'ESTIMATE', cbsRate: '8,8', ibsStateRate: '0,1', ibsMunicipalRate: '0' });
    component.submit();
    const req = controller.expectOne(`${url}/2027`);
    expect(req.request.body.version).toBeNull();
    req.flush({ code: 'error.reform.rate.invalid', invalidField: 'ibsStateRate' }, { status: 400, statusText: 'Bad Request' });
    expect(component.form.controls.ibsStateRate.errors?.['server']).toContain('Alíquota inválida');
    expect(component.formError()).toContain('Alíquota inválida');
  });

  it('409 sobe para a lista (conflict) em vez de virar erro do formulário', () => {
    open(R2027);
    const emitted: unknown[] = [];
    component.conflict.subscribe((event) => emitted.push(event));
    component.submit();
    controller.expectOne(`${url}/2027`).flush({ code: 'error.reform.rate.conflict', currentVersion: 2 }, { status: 409, statusText: 'Conflict' });
    expect(emitted).toEqual([{ year: 2027, message: 'Outra pessoa alterou este ano. Recarregue e tente de novo.' }]);
  });
});
