import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ReformFeaturesDTO } from '../models/stock-credit.model';
import { ReformFeaturesService } from '../services/reform-features.service';
import { stockCreditGuard } from './reform-feature.guard';

/** CA-CE-12: com o recurso desligado, a rota não abre (o menu também esconde). */
describe('stockCreditGuard', () => {
  function run(features: ReformFeaturesDTO | null): Promise<boolean | UrlTree> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ReformFeaturesService, useValue: { ensureLoaded: () => of(features) } }],
    });
    return new Promise((resolve) => {
      TestBed.runInInjectionContext(() => {
        (stockCreditGuard({} as never, {} as never) as Observable<boolean | UrlTree>).subscribe(resolve);
      });
    });
  }

  it('ligado: entra (também encerrado, como histórico)', async () => {
    expect(await run({ stockCredit: { enabled: true, closed: true, closesOn: '2027-06-30' } })).toBeTrue();
  });

  it('desligado ou sem resposta: volta para /home', async () => {
    const off = await run({ stockCredit: { enabled: false, closed: false, closesOn: '2027-06-30' } });
    expect(TestBed.inject(Router).serializeUrl(off as UrlTree)).toBe('/home');
  });

  it('falha na leitura (null) também volta para /home', async () => {
    const result = await run(null);
    expect(result instanceof UrlTree).toBeTrue();
  });
});
