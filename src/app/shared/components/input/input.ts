import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  OnInit,
  Output,
  PipeTransform
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AbstractControl, ControlContainer, ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {IconDefinition} from '@fortawesome/free-solid-svg-icons';
import {debounceTime, distinctUntilChanged, Observable, of, Subject, Subscriber, switchMap} from 'rxjs';


export type SelectOption = {
  value: any;
  label: string;
}

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, FaIconComponent],
  templateUrl: './input.html',
  styleUrls: ['./input.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InputComponent implements ControlValueAccessor, OnInit {
  @Input() label: string = 'text';
  @Input() type: string = 'text';
  @Input() disabled = false;
  @Input() border: boolean = true;
  @Input() icon: IconDefinition | null = null;
  @Input() clickable: boolean = false;
  @Input() formControlName: string = '';
  @Input() pipe: PipeTransform | undefined;
  @Input() maxLength: number = 999;
  @Input() options: SelectOption[] = [];
  @Input() searchFn!: (term: string) => Observable<any[]>;
  @Input() displayField: string = '';
  @Input() displayFieldTooltip: string = '';
  @Input() minRequired: number = 2;

  @Output() onClick: EventEmitter<any> = new EventEmitter();
  @Output() itemSelected = new EventEmitter<any>();

  private controlContainer = inject(ControlContainer, {
    optional: true,
    host: true,
    skipSelf: true,
  });
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

  value: string = '';
  focused = false;
  showDropdown = false;


  private control?: AbstractControl | null = null;
  private search$ = new Subject<string>();

  public  suggestions: any[] = [];


  ngOnInit() {
    this.control = this.controlContainer?.control?.get(this.formControlName);

    // With OnPush, marking the control as touched/invalid from outside this
    // component's own template (e.g. a parent validating a wizard step) does
    // not by itself trigger a re-render, so the error messages stay stale.
    // `control.events` (touched/status/value) covers all of those cases.
    this.control?.events?.subscribe(() => this.cdr.markForCheck());

    if (this.type === 'autocomplete' && this.searchFn) {
      this.search$.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term || term.length < this.minRequired) return of([]);
          return this.searchFn(term);
        })
      ).subscribe(results => {
        this.suggestions = results;
        this.showDropdown = this.suggestions.length > 0;
        if (!this.showDropdown) {
          this.control?.setErrors({ noResults: true });
        }
        this.cdr.markForCheck();
      });
    }
  }

  onChange = (_value: string) => {
  };
  onTouched = () => {
  };

  writeValue(value: any): void {
    if (value && !(typeof value === 'string') && this.displayField) {
      this.value = value[this.displayField];
      return;
    }
    this.value = value ?? '';
    this.cdr.detectChanges();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: any) {
    let newVal = event?.target?.value || '';
    if (this.pipe) {
      let formatted = newVal;
      formatted = this.pipe.transform(newVal);
      newVal = formatted;
    }
    this.value = newVal;
    this.onChange(newVal);
    if (this.type === 'autocomplete') {
      this.search$.next(newVal);
    }
  }

  onSelect(event: any) {
    const item = event;
    setTimeout(() => {
      this.onChange(item);
      this.writeValue(item)
      this.itemSelected.emit(item);
      this.showDropdown = false;
      this.cdr.markForCheck();
    });
  }

  onBlur() {
    this.focused = false;
    this.showDropdown = false;
    this.onTouched();
  }

  toggle(event: Event) {
    event.stopPropagation();
    this.onClick.emit(event);
  }

  get hasValue(): boolean {
    return this.value !== '' && this.value !== null && this.value !== undefined;
  }

  // Native date/time inputs always render their own placeholder (e.g. "dd/mm/aaaa")
  // even when empty, so the floating label must stay floated for them - otherwise
  // it sits on top of that native placeholder instead of floating out of the way.
  get alwaysFloatLabel(): boolean {
    return ['date', 'time', 'datetime-local', 'month', 'week'].includes(this.type);
  }

  get hasErrors() {
    return this.control?.errors && (this.control?.dirty || this.control?.touched);
  }

  get errorMessages() {
    const errors = this.control?.errors;
    if (!errors) return [];
    const messages = [];
    if (errors['required']) {
      messages.push('Campo obrigatório');
    }
    if (errors['email']) {
      messages.push('E-mail inválido');
    }
    if (errors['minlength']) {
      messages.push(`Mínimo de ${errors['minlength'].requiredLength} caracteres`);
    }
    if (errors['maxlength']) {
      messages.push(`Máximo de ${errors['maxlength'].requiredLength} caracteres`);
    }
    if (errors['mismatch']) {
      messages.push('Senhas diferentes');
    }
    if (errors['documentInvalid']) {
      messages.push('CPF/CNPJ inválido');
    }
    if (errors['noResults']) {
      messages.push('Nenhum resultado encontrado');
    }
    return messages;
  }

}
