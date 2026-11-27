import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { MyAccountComponent } from './my-account.component';

const ME = `${environment.apiUrl}/users/me`;

// F-SN-3 e F-AV-1 (SN-RN-09, AV-RN-08, CA-SN-12, CA-SN-13). Senhas e tokens fictícios.
describe('MyAccountComponent', () => {
  let fixture: ComponentFixture<MyAccountComponent>;
  let component: MyAccountComponent;
  let controller: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;

  function create(digest = { enabled: true, eligible: true }) {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'warning', 'error', 'info']);
    TestBed.configureTestingModule({
      imports: [MyAccountComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: toastr },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyAccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush({ available: false, resetMinutes: 60, minLength: 8 });
    controller.expectOne(`${ME}/notification-settings`).flush({ pendencyHighDigest: digest });
    fixture.detectChanges();
  }

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  function fill(current: string, next: string, confirm = next): void {
    component.passwordForm.setValue({ currentPassword: current, newPassword: next, confirmPassword: confirm });
  }

  it('troca a senha e substitui o token salvo pelo da resposta (a sessão atual continua)', () => {
    create();
    const replaceToken = spyOn(TestBed.inject(AuthService), 'replaceToken').and.callThrough();
    fill('SenhaAtual1', 'NovaSenha#2026');
    component.changePassword();
    const request = controller.expectOne(`${ME}/password`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ currentPassword: 'SenhaAtual1', newPassword: 'NovaSenha#2026' });
    request.flush({ token: 'jwt-novo-ficticio' });
    expect(replaceToken).toHaveBeenCalledWith('jwt-novo-ficticio');
    expect(TestBed.inject(AuthService).token).toBe('jwt-novo-ficticio');
    expect(component.passwordChanged()).toBeTrue();
    expect(component.passwordForm.controls.currentPassword.value).toBe('');
  });

  it('não envia: senha nova igual à atual, abaixo do mínimo ou confirmação diferente', () => {
    create();
    fill('Mesma123', 'Mesma123');
    component.changePassword();
    expect(component.passwordForm.controls.newPassword.hasError('samePassword')).toBeTrue();
    fill('SenhaAtual1', 'Abc1234');
    component.changePassword();
    expect(component.passwordForm.controls.newPassword.hasError('minlength')).toBeTrue();
    fill('SenhaAtual1', 'NovaSenha1', 'NovaSenha2');
    component.changePassword();
    expect(component.passwordForm.controls.confirmPassword.hasError('mismatch')).toBeTrue();
    controller.expectNone(`${ME}/password`);
  });

  it('senha atual errada (400 error.user.password.current.invalid) marca o campo e continua logado', () => {
    create();
    const logout = spyOn(TestBed.inject(AuthService), 'logout');
    fill('Errada123', 'NovaSenha#2026');
    component.changePassword();
    controller
      .expectOne(`${ME}/password`)
      .flush({ status: 400, code: 'error.user.password.current.invalid' }, { status: 400, statusText: 'Bad Request' });
    expect(component.passwordForm.controls.currentPassword.hasError('server')).toBeTrue();
    expect(component.passwordError()).toBe('Senha atual incorreta.');
    expect(logout).not.toHaveBeenCalled();
  });

  it('depois de "senha atual errada", a nova tentativa é enviada; o 429 explica o bloqueio de 60 minutos', () => {
    create();
    fill('SenhaCerta1', 'NovaSenha#2026');
    component.changePassword();
    controller
      .expectOne(`${ME}/password`)
      .flush({ status: 400, code: 'error.user.password.current.invalid' }, { status: 400, statusText: 'Bad Request' });
    component.changePassword();
    controller
      .expectOne(`${ME}/password`)
      .flush({ status: 429, code: 'error.user.password.change.rate.limited' }, { status: 429, statusText: 'Too Many' });
    expect(component.passwordError()).toContain('60 minutos');
  });

  it('PUT sem resposta em 30 s: cancela, encerra a espera da troca e mostra o erro de rede', fakeAsync(() => {
    create();
    const auth = TestBed.inject(AuthService);
    fill('SenhaAtual1', 'NovaSenha#2026');
    component.changePassword();
    const request = controller.expectOne(`${ME}/password`);
    expect(auth.passwordChangeInFlight).toBeTrue();
    tick(29_999);
    expect(component.passwordError()).toBeNull();
    tick(1);
    expect(request.cancelled).toBeTrue();
    expect(auth.passwordChangeInFlight).toBeFalse();
    expect(component.saving()).toBeFalse();
    expect(component.passwordError()).toContain('não respondeu a tempo');
  }));

  it('desliga o resumo diário (PUT com o booleano) e mostra o estado em texto', () => {
    create();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ligado');
    component.toggleDigest(false);
    const request = controller.expectOne(`${ME}/notification-settings`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ pendencyHighDigest: false });
    request.flush({ pendencyHighDigest: { enabled: false, eligible: true } });
    fixture.detectChanges();
    expect(component.digest()?.enabled).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Desligado');
  });

  it('falha ao gravar volta a chave para o estado anterior', () => {
    create();
    component.toggleDigest(false);
    controller.expectOne(`${ME}/notification-settings`).flush({}, { status: 500, statusText: 'Erro' });
    expect(component.digest()?.enabled).toBeTrue();
    expect(component.digestError()).not.toBeNull();
  });

  it('sem acesso às pendências (eligible=false): chave desabilitada, com o motivo, e não grava', () => {
    create({ enabled: true, eligible: false });
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#digest-switch');
    expect(input?.disabled).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Disponível só para quem tem acesso ao painel de pendências');
    component.toggleDigest(false);
    controller.expectNone(`${ME}/notification-settings`);
  });
});
