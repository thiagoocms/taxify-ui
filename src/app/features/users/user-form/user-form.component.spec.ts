import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../../environments/environment';
import { UserFormComponent } from './user-form.component';

// Dados fictícios.
describe('UserFormComponent (erros de campo do POST/PUT /users)', () => {
  let fixture: ComponentFixture<UserFormComponent>;
  let component: UserFormComponent;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    component.ngOnChanges({ user: {} as never });
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush({ available: true, resetMinutes: 60, minLength: 8 });
    component.form.patchValue({
      name: 'Pessoa Fictícia',
      documentType: 'CPF',
      documentNumber: '52998224725',
      login: 'pessoa.ficticia',
      email: 'pessoa@example.test',
      password: 'segredo1',
    });
  });

  afterEach(() => controller.verify());

  function failWith(body: object, status: number): void {
    component.submit();
    controller.expectOne(`${environment.apiUrl}/users`).flush(body, { status, statusText: 'Erro' });
    fixture.detectChanges();
  }

  it('login em uso marca o login', () => {
    failWith({ status: 409, code: 'error.user.login.already.exists', message: 'Já existe um usuário com esse login.' }, 409);
    expect(component.form.controls.login.hasError('server')).toBeTrue();
    expect(component.formError()).toBe('Já existe um usuário com esse login.');
  });

  it('documento em uso marca o CPF/CNPJ', () => {
    failWith({ status: 409, code: 'error.user.document.already.exists', message: 'Já existe um documento com esse número e tipo.' }, 409);
    expect(component.form.controls.documentNumber.hasError('server')).toBeTrue();
  });

  it('senha inválida (> 72 bytes no backend) marca a senha', () => {
    failWith({ status: 400, code: 'error.user.password.invalid' }, 400);
    expect(component.form.controls.password.hasError('server')).toBeTrue();
  });

  it('409 com outro code não marca campo (a message vai no toast do interceptor)', () => {
    failWith({ status: 409, code: 'error.plan.limit.users', message: 'Limite de usuários atingido.' }, 409);
    expect(component.form.controls.login.hasError('server')).toBeFalse();
    expect(component.form.controls.documentNumber.hasError('server')).toBeFalse();
    expect(component.formError()).toBeNull();
  });

  it('senha acima de 72 bytes nem é enviada', () => {
    component.form.patchValue({ password: '€'.repeat(25) }); // 75 bytes
    component.submit();
    controller.expectNone(`${environment.apiUrl}/users`);
    expect(component.form.controls.password.hasError('maxBytes')).toBeTrue();
  });

  it('senha curta (error.user.password.too.short) marca a senha com o mínimo da config', () => {
    failWith({ status: 400, code: 'error.user.password.too.short' }, 400);
    expect(component.form.controls.password.hasError('server')).toBeTrue();
    expect(component.formError()).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  it('login com ":" na criação não é enviado; error.user.login.invalid.char marca o login', () => {
    component.form.patchValue({ login: 'pessoa:ficticia' });
    component.submit();
    controller.expectNone(`${environment.apiUrl}/users`);
    expect(component.form.controls.login.hasError('colon')).toBeTrue();
    component.form.patchValue({ login: 'pessoa.ficticia' });
    failWith({ status: 400, code: 'error.user.login.invalid.char', message: 'Login não pode ter dois-pontos.' }, 400);
    expect(component.form.controls.login.hasError('server')).toBeTrue();
  });

  it('senha nova abaixo do mínimo da config nem é enviada', () => {
    component.form.patchValue({ password: 'Abc1234' });
    component.submit();
    controller.expectNone(`${environment.apiUrl}/users`);
    expect(component.form.controls.password.hasError('minlength')).toBeTrue();
  });
});

describe('UserFormComponent (ADMIN editando o próprio cadastro, P-SN-09)', () => {
  let controller: HttpTestingController;

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('a senha fica bloqueada (só em Minha conta) e o PUT vai sem password', () => {
    localStorage.setItem('taxify_token', 'x.e30.y');
    localStorage.setItem('taxify_user_id', 'u-admin');
    TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UserFormComponent);
    const component = fixture.componentInstance;
    component.user = {
      id: 'u-admin',
      name: 'Admin Fictício',
      documentType: 'CPF',
      documentNumber: '52998224725',
      login: 'admin:antigo',
      email: 'admin@example.test',
      profile: 'ADMIN',
    };
    component.ngOnChanges({ user: {} as never });
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush({ available: true, resetMinutes: 60, minLength: 8 });
    controller.match((r) => r.method === 'GET').forEach((r) => r.flush({ content: [], totalPages: 0 }));
    expect(component.isSelf).toBeTrue();
    expect(component.form.controls.password.disabled).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Minha conta');
    // O próprio login também fica bloqueado (error.user.login.self.change), com a dica.
    expect(component.form.controls.login.disabled).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('O seu próprio login não muda por aqui');

    // Login antigo com ":" continua salvando (a regra só vale para login novo); o PUT leva o login atual.
    component.submit();
    const request = controller.expectOne(`${environment.apiUrl}/users/u-admin`);
    expect('password' in request.request.body).toBeFalse();
    expect(request.request.body.login).toBe('admin:antigo');
    request.flush(component.user);
  });
});

describe('UserFormComponent (edição de colaborador: login com ":")', () => {
  let controller: HttpTestingController;

  afterEach(() => controller.verify());

  it('login antigo com ":" sem mudança passa; trocado para outro com ":" é recusado', () => {
    TestBed.configureTestingModule({
      imports: [UserFormComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UserFormComponent);
    const component = fixture.componentInstance;
    component.user = {
      id: 'u-colab',
      name: 'Colaborador Fictício',
      documentType: 'CPF',
      documentNumber: '52998224725',
      login: 'colab:antigo',
      email: 'colab@example.test',
      profile: 'EMPLOYEE',
    };
    component.ngOnChanges({ user: {} as never });
    fixture.detectChanges();
    controller.expectOne(`${environment.apiUrl}/auth/password/config`).flush({ available: true, resetMinutes: 60, minLength: 8 });
    controller.match((r) => r.method === 'GET').forEach((r) => r.flush({ content: [], totalPages: 0 }));

    expect(component.form.controls.login.hasError('colon')).toBeFalse();
    component.form.controls.login.setValue('colab:novo');
    expect(component.form.controls.login.hasError('colon')).toBeTrue();
    component.form.controls.login.setValue('colab.novo');
    expect(component.form.controls.login.valid).toBeTrue();
    expect(component.form.controls.login.enabled).toBeTrue();

    // Se o backend recusar a troca do próprio login (cadastro aberto por outro caminho), marca o campo login.
    component.submit();
    controller
      .expectOne(`${environment.apiUrl}/users/u-colab`)
      .flush({ status: 400, code: 'error.user.login.self.change' }, { status: 400, statusText: 'Bad Request' });
    expect(component.form.controls.login.hasError('server')).toBeTrue();
    expect(component.formError()).toBe('Você não pode mudar o seu próprio login. Se precisar, peça a outro administrador do escritório.');
  });
});
