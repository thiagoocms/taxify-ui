import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputComponent } from './input';

describe('InputComponent', () => {
  let component: InputComponent;
  let fixture: ComponentFixture<InputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ariaRequired vira aria-required no campo (input, textarea e select); sem ele, o atributo não aparece', () => {
    const host = fixture.nativeElement as HTMLElement;
    for (const type of ['text', 'textarea', 'select']) {
      fixture.componentRef.setInput('type', type);
      fixture.componentRef.setInput('ariaRequired', false);
      fixture.detectChanges();
      const field = host.querySelector('input, textarea, select') as HTMLElement;
      expect(field.hasAttribute('aria-required')).withContext(type).toBeFalse();
      fixture.componentRef.setInput('ariaRequired', true);
      fixture.detectChanges();
      expect((host.querySelector('input, textarea, select') as HTMLElement).getAttribute('aria-required'))
        .withContext(type)
        .toBe('true');
    }
  });
});
