import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { READ_ONLY_HINT } from '../../../core/models/firm-access.model';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { Button } from './button';

describe('Button', () => {
  let component: Button;
  let fixture: ComponentFixture<Button>;
  const readOnly = signal(false);

  beforeEach(async () => {
    readOnly.set(false);
    await TestBed.configureTestingModule({
      imports: [Button],
      providers: [{ provide: FirmAccessService, useValue: { readOnly: computed(() => readOnly()) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(Button);
    component = fixture.componentInstance;
    component.label = 'Salvar';
    await fixture.whenStable();
  });

  function button(): HTMLButtonElement {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ação de escrita com o escritório em somente leitura: desabilitada e com o motivo no title', () => {
    component.write = true;
    readOnly.set(true);
    const el = button();
    expect(el.disabled).toBeTrue();
    expect(el.title).toBe(READ_ONLY_HINT);
    expect(el.getAttribute('aria-label')).toBe('Salvar');
  });

  it('ação de escrita com o escritório liberado: habilitada', () => {
    component.write = true;
    expect(button().disabled).toBeFalse();
  });

  it('ação de leitura (sem write) continua habilitada no somente leitura', () => {
    readOnly.set(true);
    const el = button();
    expect(el.disabled).toBeFalse();
    expect(el.title).toBe('');
  });

  it('não emite o clique quando bloqueada', () => {
    component.write = true;
    readOnly.set(true);
    const spy = jasmine.createSpy('click');
    component.onClick.subscribe(spy);
    button().click();
    expect(spy).not.toHaveBeenCalled();
  });
});
