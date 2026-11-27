import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ResetPasswordComponent, tokenFromFragment } from './reset-password.component';

const API = `${environment.apiUrl}/auth/password`;

// Dados e tokens fictícios (F-SN-2, SN-RN-03, SN-RN-05, SN-RN-06, CA-SN-05, CA-SN-07).
describe('ResetPasswordComponent', () => {
  let controller: HttpTestingController;
  let navigate: jasmine.Spy;
  let replaceState: jasmine.Spy;

  function create(fragment: string | null, minLength = 8) {
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment } } },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const location = TestBed.inject(Location);
    spyOn(location, 'path').and.returnValue('/auth/redefinir-senha');
    replaceState = spyOn(location, 'replaceState');
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    controller.expectOne(`${API}/config`).flush({ available: true, resetMinutes: 60, minLength });
    return fixture;
  }

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('lê o token do fragmento e tira o fragmento da barra de endereços antes de qualquer chamada', () => {
    expect(tokenFromFragment('token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(tokenFromFragment('#token=abc')).toBe('abc');
    expect(tokenFromFragment('')).toBeNull();
    expect(tokenFromFragment('outra=1')).toBeNull();

    create('token=token-ficticio');
    expect(replaceState).toHaveBeenCalledWith('/auth/redefinir-senha');
    const check = controller.expectOne(`${API}/reset/check`);
    expect(check.request.body).toEqual({ token: 'token-ficticio' });
    check.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sem token: link inválido, sem chamar a API', () => {
    const fixture = create(null);
    controller.expectNone(`${API}/reset/check`);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('invalid');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pedir um link novo');
  });

  it('link vencido ou usado (400 error.password.reset.token.invalid) mostra "não vale mais" antes do formulário', () => {
    const fixture = create('token=token-usado');
    controller
      .expectOne(`${API}/reset/check`)
      .flush({ status: 400, code: 'error.password.reset.token.invalid' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('invalid');
    expect((fixture.nativeElement as HTMLElement).querySelector('#reset-new-password')).toBeNull();
  });

  it('recuperação desligada (503) mostra indisponível', () => {
    const fixture = create('token=t');
    controller
      .expectOne(`${API}/reset/check`)
      .flush({ status: 503, code: 'error.password.reset.unavailable' }, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.state()).toBe('unavailable');
  });

  it('senha com 7 caracteres não é enviada (mínimo 8 da config); confirmação diferente também não', () => {
    const fixture = create('token=t');
    controller.expectOne(`${API}/reset/check`).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.setValue({ newPassword: 'Abc1234', confirmPassword: 'Abc1234' });
    component.submit();
    controller.expectNone(`${API}/reset`);
    expect(component.form.controls.newPassword.hasError('minlength')).toBeTrue();

    component.form.setValue({ newPassword: 'Abc12345', confirmPassword: 'Abc12346' });
    component.submit();
    controller.expectNone(`${API}/reset`);
    expect(component.form.controls.confirmPassword.hasError('mismatch')).toBeTrue();
  });

  it('senha com ":" é aceita (o login divide só no primeiro ":")', () => {
    const fixture = create('token=t');
    controller.expectOne(`${API}/reset/check`).flush(null, { status: 204, statusText: 'No Content' });
    const component = fixture.componentInstance;
    component.form.setValue({ newPassword: 'abc:12345', confirmPassword: 'abc:12345' });
    component.submit();
    const request = controller.expectOne(`${API}/reset`);
    expect(request.request.body.newPassword).toBe('abc:12345');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('regra de senha recusada no backend marca o campo e o formulário continua (o link não foi consumido)', () => {
    const fixture = create('token=t');
    controller.expectOne(`${API}/reset/check`).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.setValue({ newPassword: 'SenhaAntiga1', confirmPassword: 'SenhaAntiga1' });
    component.submit();
    controller
      .expectOne(`${API}/reset`)
      .flush({ status: 400, code: 'error.user.password.same' }, { status: 400, statusText: 'Bad Request' });
    expect(component.state()).toBe('form');
    expect(component.form.controls.newPassword.hasError('server')).toBeTrue();
    expect(component.submitError()).toBe('A senha nova precisa ser diferente da atual.');

    // O erro da tentativa anterior não trava a próxima.
    component.submit();
    expect(component.submitError()).toBeNull();
    controller.expectOne(`${API}/reset`).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sucesso: limpa a sessão velha e volta ao login com "Senha alterada"', () => {
    localStorage.setItem('taxify_token', 'token-de-sessao-velho');
    const fixture = create('token=token-ficticio');
    controller.expectOne(`${API}/reset/check`).flush(null, { status: 204, statusText: 'No Content' });
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBeTrue();
    const logout = spyOn(auth, 'logout').and.callThrough();
    const component = fixture.componentInstance;
    component.form.setValue({ newPassword: 'NovaSenha#2026', confirmPassword: 'NovaSenha#2026' });
    component.submit();
    const request = controller.expectOne(`${API}/reset`);
    expect(request.request.body).toEqual({ token: 'token-ficticio', newPassword: 'NovaSenha#2026' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      ['/auth/login'],
      jasmine.objectContaining({ replaceUrl: true, state: { notice: 'password-changed' } }),
    );
  });
});
