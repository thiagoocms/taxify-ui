import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CapturePanelResponseDTO, CapturePanelRowDTO } from '../../core/models/capture-panel.model';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.service';
import { CapturePanelComponent } from './capture-panel.component';

// Dados fictícios (CT-CP-41: Z na posição 150, pedido às 10:01).
const ROW: CapturePanelRowDTO = {
  companyId: 'z',
  companyName: 'Comércio Teste Ltda',
  establishment: '0001',
  active: true,
  firmId: null,
  firmName: null,
  status: 'ATRASADA',
  statusReason: 'Sem verificação completa há 26 h',
  lastFailure: null,
  channels: {
    SIEG: {
      status: 'ATRASADA',
      lastAttemptAt: '2026-11-26T08:00:00-03:00',
      verifiedAt: '2026-11-26T08:00:00-03:00',
      queuePosition: 149,
      nextAttemptEstimate: '2026-11-27T16:20:00-03:00',
      received: { imported: 60, totalSieg: 60, from: '2026-11-01', to: '2026-11-27', checkedAt: '2026-11-26T08:00:00-03:00', previousMonth: null },
      issued: null,
      eventsCheckedOn: null,
      serviceInvoicesCheckedOn: null,
      priorityRequest: null,
    },
    SEFAZ: { status: 'EM_DIA' },
    ADN: { status: 'FORA_DO_PLANO' },
  },
};

function response(rows: CapturePanelRowDTO[] = [ROW]): CapturePanelResponseDTO {
  return {
    summary: { byStatus: { ATRASADA: 1 }, lastAttemptAt: '2026-11-27T09:58:12-03:00' },
    queue: { health: 'RUNNING', stalledSince: null, observedLapMinutes: null, neverAttempted: null, theoreticalLapMinutes: null, nextTickAt: '2026-11-27T10:05:00-03:00' },
    page: { content: rows, totalElements: rows.length, totalPages: 1, number: 0, size: 50 },
  };
}

describe('CapturePanelComponent', () => {
  let fixture: ComponentFixture<CapturePanelComponent>;
  let component: CapturePanelComponent;
  let controller: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let navigate: jasmine.Spy;
  let queryParams: BehaviorSubject<ParamMap>;
  const firmBase = `${environment.apiUrl}/capture-panel`;
  const platformBase = `${environment.apiUrl}/platform/capture-panel`;

  function setup(scope: 'firm' | 'platform', admin: boolean, params: Record<string, string | string[]> = {}): void {
    queryParams = new BehaviorSubject(convertToParamMap(params));
    toastr = jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']);
    TestBed.configureTestingModule({
      imports: [CapturePanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: toastr },
        { provide: AuthService, useValue: { isAdmin: admin, can: () => true } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { scope } }, queryParamMap: queryParams } },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CapturePanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    if (scope === 'platform') {
      controller.match(`${environment.apiUrl}/platform/firms?page=0&size=100`).forEach((req) => req.flush({ content: [] }));
    }
  }

  afterEach(() => controller.verify());

  it('busca com os filtros da URL (situação repetida, canal) e mostra a posição somando 1', () => {
    setup('firm', true, { situacao: ['COM_ERRO', 'ATRASADA'], canal: 'SIEG' });
    const req = controller.expectOne((r) => r.url === firmBase);
    expect(req.request.params.getAll('situacao')).toEqual(['COM_ERRO', 'ATRASADA']);
    expect(req.request.params.get('canal')).toBe('SIEG');
    expect(req.request.params.get('size')).toBe('50');
    req.flush(response());
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Posição 150'); // API 149 + 1
    expect(text).toContain('Sem verificação completa há 26 h');
    expect(text).toContain('Atrasada');
  });

  it('cartão do resumo coloca a situação na URL e volta para a página 1', () => {
    setup('firm', true, { page: '2' });
    controller.expectOne((r) => r.url === firmBase).flush(response());
    component.toggleStatusFilter('COM_ERRO');
    const [, extras] = navigate.calls.mostRecent().args;
    expect(extras.queryParams.situacao).toEqual(['COM_ERRO']);
    expect(extras.queryParams.page).toBeNull();
  });

  it('FISCAL (sem ADMIN) não vê o "Sincronizar agora"', () => {
    setup('firm', false);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    expect(buttons.some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Sincronizar agora'))).toBeFalse();
    expect(component.syncView(ROW).show).toBeFalse();
  });

  it('Sincronizar agora: confirma, pede e mostra "Na fila: posição 1" (CA-CP-13)', async () => {
    setup('firm', true);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    const confirm = spyOn(TestBed.inject(ConfirmDialogService), 'ask').and.resolveTo(true);
    await component.syncNow(ROW);
    const message = confirm.calls.mostRecent().args[0];
    expect(message).toContain('A posição e a estimativa aparecem depois do pedido');
    expect(message).not.toContain('próxima rodada'); // não promete a próxima rodada (QA B-3)
    expect(message).not.toMatch(/10 pedidos|1 hora/);
    const req = controller.expectOne(`${firmBase}/companies/z/sync-now`);
    expect(req.request.method).toBe('POST');
    req.flush({ requestId: 'r1', status: 'PENDING', position: 0, estimatedAt: '2026-11-27T10:05:00-03:00' }, { status: 202, statusText: 'Accepted' });
    expect(toastr.success).toHaveBeenCalledWith('Na fila: posição 1; estimativa 27/11 10:05.', 'Comércio Teste Ltda /0001');
    expect(component.rows()[0].channels.SIEG.priorityRequest?.requestId).toBe('r1');
    expect(component.syncView(component.rows()[0]).queued).toContain('Na fila: posição 1');
  });

  it('cancelar a confirmação não pede nada', async () => {
    setup('firm', true);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    spyOn(TestBed.inject(ConfirmDialogService), 'ask').and.resolveTo(false);
    await component.syncNow(ROW);
    controller.expectNone(`${firmBase}/companies/z/sync-now`);
  });

  it('429 do teto diário vira mensagem clara com o limite', async () => {
    setup('firm', true);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    spyOn(TestBed.inject(ConfirmDialogService), 'ask').and.resolveTo(true);
    await component.syncNow(ROW);
    controller
      .expectOne(`${firmBase}/companies/z/sync-now`)
      .flush(
        { status: 429, code: 'error.capture.priority.firm.daily.limit', limit: 10, retryAt: '2026-11-28T00:00:00-03:00' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    const [message, title] = toastr.warning.calls.mostRecent().args;
    expect(title).toBe('Limite do dia');
    expect(message).toContain('os 10 pedidos');
    expect(component.syncing().size).toBe(0);
  });

  it('detalhe abre e carrega pela rota da empresa', () => {
    setup('firm', true);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    component.open(ROW);
    controller.expectOne(`${firmBase}/companies/z`).flush({ ...ROW, stages: [], lastDocuments: null, recoveringMonths: ['2026-10', '2026-11'] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Recuperando 2026-10 e 2026-11');
    component.close();
    expect(component.selected()).toBeNull();
  });

  it('plataforma: 404 = visão desligada (explica e esconde o item do menu)', () => {
    setup('platform', true);
    controller
      .expectOne((r) => r.url === platformBase)
      .flush({ status: 404, code: 'error.generic.not.found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(component.platformDisabled()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Visão da plataforma desligada neste ambiente');
  });

  it('ADMIN do escritório: volta observada, teórica e "parada desde" nulas ficam escondidas sem quebrar', () => {
    setup('firm', true);
    const body = response();
    body.queue = { ...body.queue, health: 'STALLED', stalledSince: null, observedLapMinutes: null, theoreticalLapMinutes: null, neverAttempted: 4 };
    controller.expectOne((r) => r.url === firmBase).flush(body);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fila SIEG parada');
    expect(text).not.toContain('Volta observada');
    expect(text).not.toContain('Volta teórica');
    expect(text).not.toContain('Volta incompleta');
    expect(text).not.toContain('null');
  });

  it('detalhe usa as memórias prontas do backend', () => {
    setup('firm', true);
    controller.expectOne((r) => r.url === firmBase).flush(response());
    component.open(ROW);
    const sieg = ROW.channels.SIEG;
    controller.expectOne(`${firmBase}/companies/z`).flush({
      ...ROW,
      channels: {
        ...ROW.channels,
        SIEG: {
          ...sieg,
          received: { ...sieg.received!, memory: 'MEMÓRIA RECEBIDAS DO BACKEND', missing: 7, previousMonth: { month: '2026-10', imported: 1, totalSieg: 2, memory: 'MEMÓRIA MÊS ANTERIOR' } },
        },
        SEFAZ: { status: 'COM_ERRO', reason: null, failureCode: 'CERT_MISSING', failureMessage: 'MENSAGEM SEFAZ DO BACKEND' },
      },
      stages: [
        { stage: 'SIEG_RECEIVED', lastOutcome: 'FAILURE', lastOutcomeAt: null, lastSuccessAt: null, lastFailureAt: null, failureCode: 'SIEG_TIMEOUT',
          providerStatus: null, failureMessage: null, warningCode: null, warningCount: null, warningMessage: null, consecutiveFailures: 3, memory: 'MEMÓRIA ETAPA' },
      ],
      lastDocuments: null,
      recoveringMonths: ['2026-10'],
      memory: { queue: 'MEMÓRIA FILA', verification: 'MEMÓRIA VERIFICAÇÃO', recovery: 'MEMÓRIA RECUPERAÇÃO' },
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    for (const expected of ['MEMÓRIA RECEBIDAS DO BACKEND', 'MEMÓRIA MÊS ANTERIOR', 'MEMÓRIA ETAPA', 'MEMÓRIA FILA', 'MEMÓRIA VERIFICAÇÃO', 'MEMÓRIA RECUPERAÇÃO', 'MENSAGEM SEFAZ DO BACKEND']) {
      expect(text).toContain(expected);
    }
    // "missing" do backend (7), não a conta local (60 − 60 = 0).
    expect((fixture.nativeElement as HTMLElement).querySelector('.missing .count-value')?.textContent?.trim()).toBe('7');
    expect(text).not.toContain('Recuperando 2026-10');
  });

  it('página da URL além do total volta para a última página válida (QA B-4)', () => {
    setup('firm', true, { page: '7' });
    const body = response();
    body.page = { ...body.page, totalPages: 3, number: 7 };
    controller.expectOne((r) => r.url === firmBase).flush(body);
    const [, extras] = navigate.calls.mostRecent().args;
    expect(extras.queryParams.page).toBe(2);
    expect(component.loaded()).toBeFalse(); // não mostra "nenhuma empresa" enquanto corrige
  });

  it('captura SIEG desligada: só o estado, sem próxima rodada nem voltas (QA B-5)', () => {
    setup('platform', true);
    const body = response();
    body.queue = { ...body.queue, health: 'DISABLED', observedLapMinutes: 600, theoreticalLapMinutes: 750, neverAttempted: 2 };
    controller.expectOne((r) => r.url === platformBase).flush(body);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Captura SIEG desligada neste ambiente');
    expect(text).not.toContain('Próxima rodada');
    expect(text).not.toContain('Volta teórica');
    expect(text).not.toContain('Volta observada');
  });

  it('lista: com explainsStatus a mensagem da falha não se repete; sem ele, aparece (detalhe mostra tudo)', () => {
    setup('firm', true);
    const failure = {
      stage: 'SIEG_RECEIVED' as const, at: '2026-11-27T09:40:00-03:00', code: 'SIEG_UNAVAILABLE', providerStatus: '503',
      message: 'MENSAGEM DA FALHA', resolved: false, consecutiveFailures: 3,
    };
    const rows = [
      { ...ROW, companyId: 'a', status: 'COM_ERRO' as const, statusReason: 'MOTIVO A', lastFailure: { ...failure, explainsStatus: true } },
      { ...ROW, companyId: 'b', status: 'COM_ERRO' as const, statusReason: 'MOTIVO B', lastFailure: { ...failure, explainsStatus: false } },
    ];
    controller.expectOne((r) => r.url === firmBase).flush(response(rows));
    fixture.detectChanges();
    expect(component.failureLine(rows[0])).toBe('Falhou 3 vezes seguidas');
    expect(component.failureLine({ ...rows[0], lastFailure: { ...rows[0].lastFailure, consecutiveFailures: 1 } })).toBeNull();
    expect(component.failureLine(rows[1])).toBe('MENSAGEM DA FALHA');
    const text = fixture.nativeElement.textContent as string;
    expect(text.split('MENSAGEM DA FALHA').length - 1).toBe(1); // só a linha sem explainsStatus
  });

  it('plataforma: firmId da URL vai na consulta', () => {
    setup('platform', true, { firmId: 'fA' });
    const req = controller.expectOne((r) => r.url === platformBase);
    expect(req.request.params.get('firmId')).toBe('fA');
    req.flush(response([{ ...ROW, firmId: 'fA', firmName: 'Escritório Fictício' }]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Escritório Fictício');
  });
});
