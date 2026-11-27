import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { IbsCbsRatesResponseDTO } from '../../../core/models/ibs-cbs-rate.model';
import { IbsCbsReferenceComponent } from './ibs-cbs-reference.component';

const RESPONSE: IbsCbsRatesResponseDTO = {
  years: [
    { year: 2026, cbsRate: 0.9, ibsStateRate: 0.1, ibsMunicipalRate: 0, status: 'LAW', generatesFindings: true, legalBasis: 'LC 214/2025', sourceUrl: 'https://exemplo.test/ato' },
  ],
  warnings: [{ year: 2027, type: 'NO_LAW', text: '2027: sem alíquota oficial cadastrada. A conferência não compara as alíquotas de IBS/CBS das notas desse ano.' }],
};

describe('IbsCbsReferenceComponent', () => {
  function render(from: string, to: string, showReference: boolean): HTMLElement {
    TestBed.configureTestingModule({ imports: [IbsCbsReferenceComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(IbsCbsReferenceComponent);
    fixture.componentRef.setInput('from', from);
    fixture.componentRef.setInput('to', to);
    fixture.componentRef.setInput('showReference', showReference);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/reform/ibs-cbs-rates`).flush(RESPONSE);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('CA-AL-07: conferência de 2027-01 mostra que as alíquotas de 2027 não são comparadas', () => {
    const el = render('2027-01-01', '2027-01-31', false);
    expect(el.textContent).toContain('2027: sem alíquota oficial cadastrada');
    expect(el.querySelector('.reference')).toBeNull();
  });

  it('nota de 2026: a referência com o status e o link do ato, sem aviso', () => {
    const el = render('2026-12-31', '2026-12-31', true);
    expect(el.textContent).toContain('Referência de 2026: CBS 0,9%, IBS UF 0,1%, IBS Mun 0% (Lei)');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('https://exemplo.test/ato');
    expect(el.querySelector('.notice')).toBeNull();
  });
});
