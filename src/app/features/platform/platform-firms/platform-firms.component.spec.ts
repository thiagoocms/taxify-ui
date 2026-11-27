import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { PlatformFirmRowDTO } from '../../../core/models/platform-firm.model';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { PlatformFirmsComponent } from './platform-firms.component';

// Dados fictícios.
const ROW: PlatformFirmRowDTO = {
  id: 'f1',
  name: 'Escritório Fictício',
  documentNumber: null,
  createdDate: '2026-01-10T09:00:00',
  status: 'ACTIVE',
  exempt: false,
  readOnly: false,
  reason: null,
  trialEndsOn: null,
  accessUntil: null,
  blockedSince: null,
  migrated: true,
  reviewed: false,
  reviewedAt: null,
  reviewedBy: null,
  companiesInUse: 3,
  companiesInactive: 0,
  usersInUse: 2,
  contactPhone: '81999990000',
  billingEmail: null,
  admins: [{ name: 'Pessoa Fictícia', email: 'pessoa@example.test' }],
};

describe('PlatformFirmsComponent (dados do escritório)', () => {
  let fixture: ComponentFixture<PlatformFirmsComponent>;
  let component: PlatformFirmsComponent;
  let controller: HttpTestingController;
  let confirm: jasmine.Spy;
  const base = `${environment.apiUrl}/platform/firms`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformFirmsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'warning', 'error']) },
      ],
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    confirm = spyOn(TestBed.inject(ConfirmDialogService), 'ask').and.resolveTo(true);
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlatformFirmsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    controller.expectOne((req) => req.url === base).flush({ content: [ROW], totalPages: 1, totalElements: 1 });
    component.open(ROW);
    controller.expectOne(`${base}/f1/events`).flush([]);
    component.openContact();
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('envia só os campos alterados, em dígitos, depois da confirmação', async () => {
    component.contactForm.patchValue({ documentNumber: '11.222.333/0001-81', billingEmail: 'financeiro@example.test' });
    await component.saveContact();
    expect(confirm).toHaveBeenCalled();
    const request = controller.expectOne(`${base}/f1/contact`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ documentNumber: '11222333000181', billingEmail: 'financeiro@example.test' });
    request.flush({ ...ROW, documentNumber: '11222333000181', billingEmail: 'financeiro@example.test' });
    controller.expectOne(`${base}/f1/events`).flush([]);
    expect(component.selected()?.billingEmail).toBe('financeiro@example.test');
    expect(component.contactOpen()).toBeFalse();
  });

  it('CNPJ de outro escritório marca o campo', async () => {
    component.contactForm.patchValue({ documentNumber: '11222333000181' });
    await component.saveContact();
    controller.expectOne(`${base}/f1/contact`).flush(
      { status: 409, code: 'error.signup.firm.document.exists', message: 'Este CNPJ já tem conta no Taxify.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.contactForm.controls.documentNumber.hasError('server')).toBeTrue();
    expect(component.contactError()).toBe('Este CNPJ já tem conta no Taxify.');
  });

  it('não envia valor apagado nem formulário sem alteração', async () => {
    await component.saveContact();
    expect(component.contactError()).toBe('Nada foi alterado.');
    component.contactForm.patchValue({ contactPhone: '' });
    await component.saveContact();
    expect(component.contactError()).toContain('Não dá para apagar Telefone');
    controller.expectNone(`${base}/f1/contact`);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('cadastro pendente de confirmação não pode ser editado', () => {
    expect(component.canEditContact({ ...ROW, status: 'PENDING_VERIFICATION' })).toBeFalse();
  });

  it('lista no app-table: situação em selo com texto, revisão pendente da migração e o botão "Gerenciar"', () => {
    const table = (fixture.nativeElement as HTMLElement).querySelector('app-table') as HTMLElement;
    expect(table).not.toBeNull();
    const text = (table.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Escritório Fictício');
    expect(text).toContain('Liberado sem prazo');
    expect(text).toContain('Não revisado (migração)');
    expect(text).toContain('3 / 0');
    expect(table.querySelector('.state-badge.ok')?.textContent?.trim()).toBe('Liberado sem prazo');
    expect(table.querySelector('button[aria-label="Gerenciar"]')).not.toBeNull();
  });

  it('tocar na linha abre o modal do escritório; o e-mail do ADMIN não abre', () => {
    component.close();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const mailto = host.querySelector('app-table a[href^="mailto:"]') as HTMLElement;
    mailto.addEventListener('click', (event) => event.preventDefault()); // o teste não abre o cliente de e-mail
    mailto.click();
    expect(component.selected()).toBeNull();
    (host.querySelector('app-table tbody tr') as HTMLElement).click();
    expect(component.selected()?.id).toBe('f1');
    controller.expectOne(`${base}/f1/events`).flush([]);
  });
});
