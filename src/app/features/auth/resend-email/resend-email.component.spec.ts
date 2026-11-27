import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../../environments/environment';
import { ResendEmailComponent } from './resend-email.component';

/** QA fase 1 (F1-2, F1-RN-03): o reenvio nunca revela se o login existe; a tela diz sempre a mesma coisa. */
describe('ResendEmailComponent', () => {
  let controller: HttpTestingController;
  const url = `${environment.apiUrl}/signup/resend`;

  function create(login: string | null) {
    TestBed.configureTestingModule({
      imports: [ResendEmailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ResendEmailComponent);
    fixture.componentInstance.login = login;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => controller.verify());

  it('mesma mensagem para login existente e inexistente (resposta 202 igual), sem citar o login', fakeAsync(() => {
    const messages: string[] = [];
    for (const login of ['ana.ficticia', 'nao.existe']) {
      TestBed.resetTestingModule();
      const fixture = create(login);
      fixture.componentInstance.resend();
      controller.expectOne(url).flush(null, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();
      messages.push(((fixture.nativeElement as HTMLElement).querySelector('[role="status"].resend-message')?.textContent ?? '').trim());
      tick(61000); // esgota o cooldown de 60 s
      fixture.destroy();
    }
    expect(messages[0]).toBeTruthy();
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain('Se houver um cadastro aguardando confirmação');
    expect(messages[0]).not.toContain('ana.ficticia');
    expect(messages[0]).toContain('no máximo 3 reenvios por hora');
  }));

  it('depois de enviar, o botão fica bloqueado por 60 s (evita estourar o limite por hora)', fakeAsync(() => {
    const fixture = create('ana.ficticia');
    fixture.componentInstance.resend();
    controller.expectOne(url).flush(null, { status: 202, statusText: 'Accepted' });
    expect(fixture.componentInstance.cooldown()).toBe(60);
    expect(fixture.componentInstance.buttonLabel()).toBe('Reenviar e-mail (60s)');
    tick(60000);
    expect(fixture.componentInstance.cooldown()).toBe(0);
    expect(fixture.componentInstance.buttonLabel()).toBe('Reenviar e-mail');
    fixture.destroy();
  }));

  it('sem login conhecido, o campo aparece com rótulo e o envio vazio não chama a API', () => {
    const fixture = create(null);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Seu login');
    fixture.componentInstance.resend();
    controller.expectNone(url);
    expect(fixture.componentInstance.loginControl.touched).toBeTrue();
  });

  it('login digitado é enviado sem espaços nas pontas', () => {
    const fixture = create(null);
    fixture.componentInstance.loginControl.setValue('  ana.ficticia ');
    fixture.componentInstance.resend();
    expect(controller.expectOne(url).request.body).toEqual({ login: 'ana.ficticia' });
  });

  it('falha de rede e erro do servidor têm mensagens claras e em alerta', () => {
    const fixture = create('ana.ficticia');
    fixture.componentInstance.resend();
    controller.expectOne(url).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Verifique sua internet');

    fixture.componentInstance.resend();
    controller.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Tente de novo em alguns minutos');
    expect(fixture.componentInstance.sent()).toBeFalse();
  });
});
