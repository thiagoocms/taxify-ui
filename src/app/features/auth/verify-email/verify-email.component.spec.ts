import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../../environments/environment';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  let controller: HttpTestingController;
  let navigate: jasmine.Spy;

  function create(token: string | null) {
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush({ available: true, verificationHours: 24 });
    return fixture;
  }

  afterEach(() => controller.verify());

  it('link válido: teste até a data, em dd/mm/aaaa (CA1-02)', () => {
    const fixture = create('token-ficticio');
    const request = controller.expectOne(`${environment.apiUrl}/signup/verify`);
    expect(request.request.body).toEqual({ token: 'token-ficticio' });
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { token: null }, replaceUrl: true }));
    request.flush({ status: 'TRIAL', trialEndsOn: '2026-12-09' });
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('success');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('09/12/2026');
  });

  it('link vencido ou usado: mensagem e reenviar', () => {
    const fixture = create('token-usado');
    controller
      .expectOne(`${environment.apiUrl}/signup/verify`)
      .flush({ status: 400, code: 'error.signup.token.invalid' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('invalid');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reenviar e-mail');
  });

  it('sem token: não chama a API e mostra o link inválido', () => {
    const fixture = create(null);
    controller.expectNone(`${environment.apiUrl}/signup/verify`);
    expect(fixture.componentInstance.state()).toBe('invalid');
  });
});
