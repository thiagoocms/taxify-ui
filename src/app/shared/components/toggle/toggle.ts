import {Component, EventEmitter, forwardRef, Input, OnChanges, Output} from '@angular/core';
import {NgClass} from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [NgClass],
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Toggle),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => Toggle),
      multi: true
    }
  ]
})
export class Toggle implements ControlValueAccessor, Validator
{
  @Input() label: string = '';
  @Input() isDisabled: boolean = false;
  @Input() icon: string = '';
  @Input() idInput: string = 'toggle-input' + Math.floor(Math.random() * 1000);

  @Input() styleClass: string = '';
  @Input() invalid: boolean = false;
  @Input() readonly: boolean = false;
  @Input() trueValue: any = true;
  @Input() falseValue: any = false;

  @Output() selectionChange = new EventEmitter<any>();

  protected onChange: any = () => {};
  protected onTouched: any = () => {};

  public checked: boolean = false;

  writeValue(obj: any): void {
    // this.checked = obj;
    this.checked = obj === this.trueValue;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return this.invalid ? { invalid: true } : null;
  }

  onSelectionChange(): void {
    this.selectionChange.emit(this.checked);
    this.onChange(this.checked);
  }

  public handleChange(event: any): void {
    this.checked = event.target.checked;

    const value = this.checked ? this.trueValue : this.falseValue;

    this.onChange(value);
    this.onTouched();
    this.selectionChange.emit(value);
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }


}
