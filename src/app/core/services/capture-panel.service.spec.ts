import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EMPTY_FILTER } from '../../features/capture-panel/capture-url';
import { CapturePanelService } from './capture-panel.service';

describe('CapturePanelService', () => {
  let service: CapturePanelService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CapturePanelService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('só os filtros informados vão na query; firmId só na plataforma', () => {
    const filter = { ...EMPTY_FILTER, situacao: ['COM_ERRO' as const], busca: '  textil ', firmId: 'f1' };
    service.list('firm', filter).subscribe();
    const firm = controller.expectOne((r) => r.url === `${environment.apiUrl}/capture-panel`);
    expect(firm.request.params.keys().sort()).toEqual(['busca', 'page', 'situacao', 'size']);
    expect(firm.request.params.get('busca')).toBe('textil');
    firm.flush({});
    service.list('platform', filter).subscribe();
    const platform = controller.expectOne((r) => r.url === `${environment.apiUrl}/platform/capture-panel`);
    expect(platform.request.params.get('firmId')).toBe('f1');
    platform.flush({});
  });

  it('não sonda a visão da plataforma: o menu usa a flag do /firm-access', () => {
    expect((service as unknown as Record<string, unknown>)['ensurePlatformChecked']).toBeUndefined();
    controller.expectNone((r) => r.url.includes('/platform/capture-panel'));
  });
});
