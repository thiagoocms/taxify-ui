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
});
