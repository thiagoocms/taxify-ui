import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../environments/environment';
import { SignupConfigDTO } from '../../core/models/signup.model';
import { AuthComponent } from './auth.component';

const CONFIG: SignupConfigDTO = {
  available: true,
  termsVersion: '2026-11',
  termsUrl: 'https://example.test/termos',
  privacyUrl: 'https://example.test/privacidade',
  dpaUrl: 'https://example.test/dpa',
  trialDays: 14,
  verificationHours: 24,
};

// Dados fictícios (CNPJ e CPF de teste com DV válido).
const VALID = {
  firmName: 'Escritório Fictício',
  firmDocument: '11222333000181',
  billingEmail: 'financeiro@example.test',
  contactPhone: '81999990000',
  name: 'Pessoa Fictícia',
  document: '52998224725',
  email: 'pessoa@example.test',
  login: 'pessoa.ficticia',
  password: 'segredo1',
  confirmPassword: 'segredo1',
  acceptTerms: true,
};

describe('AuthComponent (cadastro da fase 1)', () => {
  let fixture: ComponentFixture<AuthComponent>;
  let component: AuthComponent;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function flushConfig(config: SignupConfigDTO): void {
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush(config);
    fixture.detectChanges();
  }

  function submitValidSignup(): void {
    component.registerForm.setValue(VALID);
    component.step.set(3);
    component.changeStep();
  }

  it('esconde "crie a conta" quando o cadastro está indisponível (CA1-13)', () => {
    flushConfig({ ...CONFIG, available: false });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('crie a conta do seu escritório');
  });

  it('mostra "crie a conta" quando o cadastro está aberto', () => {
    flushConfig(CONFIG);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('crie a conta do seu escritório');
  });

  it('envia o cadastro novo sem profile, com a versão dos termos e só os dígitos', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    const request = controller.expectOne(`${environment.apiUrl}/signup`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      firm: {
        name: 'Escritório Fictício',
        documentNumber: '11222333000181',
        billingEmail: 'financeiro@example.test',
        contactPhone: '81999990000',
      },
      user: {
        name: 'Pessoa Fictícia',
        document: '52998224725',
        login: 'pessoa.ficticia',
        email: 'pessoa@example.test',
        password: 'segredo1',
      },
      termsVersion: '2026-11',
    });
    expect('profile' in request.request.body).toBeFalse();
    request.flush({ status: 'PENDING_VERIFICATION', verificationHours: 24 }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(component.registered()?.email).toBe('pessoa@example.test');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Verifique seu e-mail');
  });

  it('CNPJ já cadastrado volta para a etapa do escritório com a mensagem da API', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.firm.document.exists', message: 'Este CNPJ já tem conta no Taxify. Fale com a CS Hub.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(1);
    expect(component.registerError()).toBe('Este CNPJ já tem conta no Taxify. Fale com a CS Hub.');
    expect(component.registerForm.controls.firmDocument.hasError('server')).toBeTrue();
  });

  it('login em uso (error.user.login.already.exists) marca o login na etapa 2', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.user.login.already.exists', message: 'Já existe um usuário com esse login.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.login.hasError('server')).toBeTrue();
  });

  it('409 com code sem campo próprio: mostra a message da API no rodapé, sem marcar campo (fallback genérico)', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.conflict', message: 'Não foi possível concluir o cadastro com esses dados.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.registerError()).toBe('Não foi possível concluir o cadastro com esses dados.');
    expect(component.registerForm.controls.login.hasError('server')).toBeFalse();
    expect(component.registerForm.controls.document.hasError('server')).toBeFalse();
  });

  it('termos desatualizados: desmarca o aceite e busca a versão nova', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.signup.terms.outdated' },
      { status: 409, statusText: 'Conflict' },
    );
    controller.expectOne(`${environment.apiUrl}/signup/config`).flush({ ...CONFIG, termsVersion: '2026-12' });
    expect(component.registerForm.controls.acceptTerms.value).toBeFalse();
    expect(component.signupConfig()?.termsVersion).toBe('2026-12');
    expect(component.step()).toBe(3);
  });

  it('não avança com CNPJ de DV inválido', () => {
    flushConfig(CONFIG);
    component.registerForm.patchValue({ ...VALID, firmDocument: '11111111000111' });
    component.step.set(1);
    component.changeStep();
    expect(component.step()).toBe(1);
    expect(component.registerForm.controls.firmDocument.hasError('cnpjInvalid')).toBeTrue();
  });

  it('login antes de confirmar o e-mail oferece reenviar', () => {
    flushConfig(CONFIG);
    component.loginForm.setValue({ login: 'pessoa.ficticia', password: 'segredo1' });
    component.loginSubmit();
    controller.expectOne(`${environment.apiUrl}/auth`).flush(
      { status: 403, code: 'error.signup.email.not.verified' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(component.loginNotVerified()).toBe('pessoa.ficticia');
    expect(component.loginError()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reenviar e-mail');
  });

  it('CPF duplicado (error.user.document.already.exists) marca o CPF na etapa 2', () => {
    flushConfig(CONFIG);
    submitValidSignup();
    controller.expectOne(`${environment.apiUrl}/signup`).flush(
      { status: 409, code: 'error.user.document.already.exists', message: 'Já existe um documento com esse número e tipo.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.step()).toBe(2);
    expect(component.registerForm.controls.document.hasError('server')).toBeTrue();
    expect(component.registerError()).toBe('Já existe um documento com esse número e tipo.');
  });

  it('senha acima de 72 bytes não avança (o BCrypt ignoraria o resto)', () => {
    flushConfig(CONFIG);
    const longa = 'ç'.repeat(37); // 74 bytes em UTF-8
    component.registerForm.setValue({ ...VALID, password: longa, confirmPassword: longa });
    component.step.set(3);
    component.changeStep();
    controller.expectNone(`${environment.apiUrl}/signup`);
    expect(component.registerForm.controls.password.hasError('maxBytes')).toBeTrue();
  });
});
