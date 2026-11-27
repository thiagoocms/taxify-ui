import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

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

  it('control.disable()/enable() de fora aparece no DOM (OnPush): input, select e textarea', () => {
    @Component({
      standalone: true,
      imports: [InputComponent, ReactiveFormsModule],
      template: `
        <app-input label="Texto" [formControl]="control"></app-input>
        <app-input label="Lista" type="select" [options]="[{ value: 'A', label: 'A' }]" [formControl]="control"></app-input>
        <app-input label="Obs" type="textarea" [formControl]="control"></app-input>
      `,
    })
    class HostComponent {
      readonly control = new FormControl('A');
    }
    const host = TestBed.createComponent(HostComponent);
    host.detectChanges();
    const fields = () => [...(host.nativeElement as HTMLElement).querySelectorAll('input, select, textarea')] as HTMLInputElement[];
    expect(fields().length).toBe(3);
    expect(fields().every((field) => !field.disabled)).toBeTrue();
    host.componentInstance.control.disable();
    host.detectChanges();
    expect(fields().every((field) => field.disabled)).toBeTrue();
    host.componentInstance.control.enable();
    host.detectChanges();
    expect(fields().every((field) => !field.disabled)).toBeTrue();
  });
});
