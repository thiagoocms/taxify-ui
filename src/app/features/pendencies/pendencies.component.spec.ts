import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { PendenciesComponent } from './pendencies.component';

const API = `${environment.apiUrl}/pendencias`;

// F-AV-3: o link do resumo por e-mail abre o painel já filtrado.
describe('PendenciesComponent (filtros pela URL)', () => {
  let controller: HttpTestingController;

  let params$: BehaviorSubject<ParamMap>;

  function create(query: Record<string, string>) {
    params$ = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      imports: [PendenciesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'info', 'warning', 'error']) },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: params$ } },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PendenciesComponent);
    fixture.detectChanges();
    return fixture;
  }

  function listRequest() {
    const [request] = controller.match((r) => r.url === API);
    controller.match(() => true).forEach((other) => other.flush([]));
    return request;
  }

  it('?severidade=ALTA&status=ABERTA aplica os dois filtros na primeira busca', () => {
    const fixture = create({ severidade: 'ALTA', status: 'ABERTA' });
    const request = listRequest();
    expect(request.request.params.get('severity')).toBe('ALTA');
    expect(request.request.params.get('status')).toBe('ABERTA');
    expect(fixture.componentInstance.severity()).toBe('ALTA');
  });

  it('aceita minúsculas e status diferente do padrão', () => {
    const fixture = create({ severidade: 'media', status: 'todas' });
    const request = listRequest();
    expect(request.request.params.get('severity')).toBe('MEDIA');
    expect(request.request.params.get('status')).toBe('TODAS');
    expect(fixture.componentInstance.status()).toBe('TODAS');
  });

  it('valor desconhecido fica com o padrão (abertas, toda severidade)', () => {
    create({ severidade: 'URGENTE', status: 'X' });
    const request = listRequest();
    expect(request.request.params.has('severity')).toBeFalse();
    expect(request.request.params.get('status')).toBe('ABERTA');
  });

  it('trocar o chip atualiza a URL sem criar histórico', () => {
    const fixture = create({});
    listRequest();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.setSeverity('ALTA');
    controller.match(() => true).forEach((other) => other.flush({ content: [], totalPages: 0 }));
    expect(navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({ queryParams: { severidade: 'ALTA', status: null }, replaceUrl: true }),
    );
  });

  it('componente reaproveitado: um link novo para /pendencias realinha os chips e busca de novo', () => {
    const fixture = create({});
    listRequest();
    params$.next(convertToParamMap({ severidade: 'ALTA', status: 'TODAS' }));
    const request = listRequest();
    expect(request.request.params.get('severity')).toBe('ALTA');
    expect(request.request.params.get('status')).toBe('TODAS');
    expect(fixture.componentInstance.severity()).toBe('ALTA');
    // Sem filtros na URL: volta ao padrão.
    params$.next(convertToParamMap({}));
    expect(listRequest().request.params.get('status')).toBe('ABERTA');
    expect(fixture.componentInstance.severity()).toBe('');
    // A mesma URL de novo (ex.: o syncUrl dos chips) não busca outra vez.
    params$.next(convertToParamMap({}));
    expect(controller.match((r) => r.url === API).length).toBe(0);
  });
});
