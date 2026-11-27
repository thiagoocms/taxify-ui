import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { AcessoriasImportResultDTO } from '../../../core/models/acessorias.model';
import { FirmAccessDTO } from '../../../core/models/firm-access.model';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { CompanyListComponent } from './company-list.component';

function b64(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function access(partial: Partial<FirmAccessDTO>): FirmAccessDTO {
  return {
    status: 'TRIAL',
    exempt: false,
    readOnly: false,
    reason: null,
    blockedSince: null,
    trialEndsOn: '2026-12-09',
    accessUntil: null,
    trialDaysLeft: 14,
    capturesStoppedDays: null,
    sefazRetentionDays: 90,
    limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 3, maxUsers: 2, usersInUse: 1 },
    platformAdmin: false,
    capturePanelPlatformEnabled: false,
    ...partial,
  };
}

/** QA fase 1 (F1-3, F1-4, CA1-15/16, CT1-25/29): lista de empresas no limite do teste e no somente leitura. */
describe('CompanyListComponent (limite do teste e somente leitura)', () => {
  const state = signal<FirmAccessDTO | null>(null);
  let controller: HttpTestingController;

  function create() {
    // Token fictício de ADMIN (sem assinatura): a tela só lê o perfil.
    localStorage.setItem('taxify_token', `${b64({ alg: 'none' })}.${b64({ profile: 'ADMIN', exp: 4102444800 })}.x`);
    const firmAccess = {
      access: state.asReadonly(),
      limits: () => state()?.limits ?? null,
      readOnly: () => state()?.readOnly === true,
      companyLimitReached: () => {
        const l = state()?.limits;
        return !!l && l.companiesInUse >= l.maxCompanies;
      },
      reload: jasmine.createSpy('reload'),
    };
    TestBed.configureTestingModule({
      imports: [CompanyListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FirmAccessService, useValue: firmAccess },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']) },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CompanyListComponent);
    fixture.detectChanges();
    // Chamadas de abertura da tela (lista, certidões, escritório): respostas vazias.
    controller.match(() => true).forEach((request) => {
      const empty = /\/(companies|accounting-firms)(\?|$)/.test(request.request.url)
        ? { content: [], totalPages: 0, totalElements: 0, number: 0, size: 10 }
        : [];
      request.flush(empty);
    });
    fixture.detectChanges();
    return fixture;
  }

  function buttonByLabel(host: HTMLElement, label: string): HTMLButtonElement | undefined {
    return [...host.querySelectorAll('button')].find((button) => button.textContent?.includes(label));
  }

  afterEach(() => localStorage.removeItem('taxify_token'));

  it('limite atingido (5 de 5): "Nova empresa" desabilitada e o aviso traz limite, uso e a vaga das inativas', () => {
    state.set(access({ limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 5, maxUsers: 2, usersInUse: 1 } }));
    const host = create().nativeElement as HTMLElement;
    expect(buttonByLabel(host, 'Nova empresa')?.disabled).toBeTrue();
    const notice = host.querySelector('.notice')?.textContent ?? '';
    expect(notice).toContain('Limite do teste atingido.');
    expect(notice).toContain('permite 5 empresas');
    expect(notice).toContain('já tem 5 em uso');
    expect(notice).toContain('Empresas inativas não contam');
  });

  it('uma vaga livre (4 de 5): botão habilitado e sem aviso', () => {
    state.set(access({ limits: { planName: 'Teste grátis', maxCompanies: 5, companiesInUse: 4, maxUsers: 2, usersInUse: 1 } }));
    const host = create().nativeElement as HTMLElement;
    expect(buttonByLabel(host, 'Nova empresa')?.disabled).toBeFalse();
    expect(host.querySelector('.notice')).toBeNull();
  });

  it('liberado sem limite (limits nulo): sem aviso e botão habilitado', () => {
    state.set(access({ status: 'ACTIVE', limits: null, trialDaysLeft: null }));
    const host = create().nativeElement as HTMLElement;
    expect(buttonByLabel(host, 'Nova empresa')?.disabled).toBeFalse();
    expect(host.querySelector('.notice')).toBeNull();
  });

  it('somente leitura: "Nova empresa" desabilitada (o motivo vai no title do botão)', () => {
    state.set(access({ status: 'BLOCKED', readOnly: true, reason: 'TRIAL_EXPIRED', limits: null, trialDaysLeft: null }));
    const host = create().nativeElement as HTMLElement;
    const button = buttonByLabel(host, 'Nova empresa');
    expect(button?.disabled).toBeTrue();
    expect(button?.getAttribute('title')).toContain('Somente leitura');
  });

  it('resumo da importação traz "skippedByLimit" (CT1-29: 2 fora por limite) e some quando é 0 ou ausente', () => {
    state.set(access({}));
    const fixture = create();
    const base: AcessoriasImportResultDTO = {
      received: 5, created: 2, updated: 1, unchanged: 0, linksCreated: 0,
      skipped: ['Empresa Ficticia 3 LTDA: limite de empresas atingido', 'Empresa Ficticia 4 LTDA: limite de empresas atingido'],
      responsiblesNotFound: [], errors: [], skippedByLimit: 2,
    };
    fixture.componentInstance.importResult.set(base);
    fixture.detectChanges();
    let text = (document.body.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('2 empresa(s) ficaram de fora pelo limite do teste grátis');
    expect(text).toContain('Empresa Ficticia 3 LTDA: limite de empresas atingido');

    fixture.componentInstance.importResult.set({ ...base, skippedByLimit: 0 });
    fixture.detectChanges();
    text = (document.body.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).not.toContain('ficaram de fora pelo limite');

    fixture.componentInstance.importResult.set({ ...base, skippedByLimit: undefined }); // API antiga
    fixture.detectChanges();
    expect((document.body.textContent ?? '')).not.toContain('ficaram de fora pelo limite');
  });
});
