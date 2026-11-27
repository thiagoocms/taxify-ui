import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { FirmAccessDTO } from '../models/firm-access.model';
import { FirmAccessService } from '../services/firm-access.service';
import { platformAdminGuard } from './platform-admin.guard';

function access(platformAdmin: boolean): FirmAccessDTO {
  return {
    status: 'ACTIVE',
    exempt: false,
    readOnly: false,
    reason: null,
    blockedSince: null,
    trialEndsOn: null,
    accessUntil: null,
    trialDaysLeft: null,
    capturesStoppedDays: null,
    sefazRetentionDays: 90,
    limits: null,
    platformAdmin,
  };
}

/** QA fase 1 (F1-5): console da plataforma só para o admin da plataforma; os demais voltam para /home. */
describe('platformAdminGuard', () => {
  const state = signal<FirmAccessDTO | null>(null);

  function run(ensureLoaded: () => Observable<FirmAccessDTO | null>): Promise<boolean | UrlTree> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FirmAccessService, useValue: { ensureLoaded, platformAdmin: state } }],
    });
    return new Promise((resolve) => {
      TestBed.runInInjectionContext(() => {
        (platformAdminGuard({} as never, {} as never) as Observable<boolean | UrlTree>).subscribe(resolve);
      });
    });
  }

  it('admin da plataforma entra', async () => {
    expect(await run(() => of(access(true)))).toBeTrue();
  });

  it('ADMIN de escritório comum vai para /home', async () => {
    const result = await run(() => of(access(false)));
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('falha ao carregar a situação (nulo) também vai para /home, nunca abre o console', async () => {
    const result = await run(() => of(null));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });
});
