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
import {faXmark, IconDefinition} from '@fortawesome/free-solid-svg-icons';
import {debounceTime, distinctUntilChanged, Observable, of, Subject, Subscriber, switchMap} from 'rxjs';
import {formatDocument, maskCnpj, maskCpf, maskDocument, onlyDigits} from '../../utils/document-mask';
import {maskPhone} from '../../utils/format';

/** Máscaras de exibição: o formulário sempre recebe só os dígitos. */
const MASKS: Record<string, { apply: (value?: string | null) => string; maxLength: number }> = {
  document: { apply: maskDocument, maxLength: 18 },
  cnpj: { apply: maskCnpj, maxLength: 18 },
  cpf: { apply: maskCpf, maxLength: 14 },
  phone: { apply: maskPhone, maxLength: 15 },
};


let nextInputId = 0;

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
  /**
   * Campo obrigatório: só anuncia (aria-required) ao leitor de tela; quem valida continua sendo o formulário. Não se
   * chama `required` porque esse atributo, junto com formControl/ngModel, liga o RequiredValidator do Angular.
   */
  @Input() ariaRequired = false;
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
  /** Autocomplete: monta o texto de cada sugestão (e do item escolhido); sem ele, usa displayField. */
  @Input() displayFn?: (item: any) => string;
  @Input() minRequired: number = 2;
  /** Máscara na tela ('document' = CPF/CNPJ, 'cnpj', 'cpf', 'phone'); o formulário recebe só os dígitos. */
  @Input() mask: 'document' | 'cnpj' | 'cpf' | 'phone' | '' = '';
  /** 'sm': a versão compacta, para edições em linha e cartões (sem a reserva da linha de erro). */
  @Input() size: 'default' | 'sm' = 'default';
  /** Número: o passo do campo (ex.: '0.01'); o formulário recebe number (ou null, vazio). */
  @Input() step: string | null = null;
  @Input() min: string | number | null = null;
  @Input() autocomplete: string | null = null;
  /** Id do campo (o label aponta para ele); sem valor, um único é gerado. */
  @Input() inputId = `app-input-${++nextInputId}`;
  /** Rótulo acessível do ícone clicável (ex.: "Mostrar senha"): com ele, o ícone vira um botão. */
  @Input() iconLabel: string | null = null;
  /** Estado de alternância do botão do ícone (aria-pressed), ex.: senha visível. */
  @Input() iconPressed: boolean | null = null;

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
  readonly clearIcon = faXmark;
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
    if (value && !(typeof value === 'string') && (this.displayFn || this.displayField)) {
      this.value = this.itemLabel(value);
      // A value set later (e.g. a company loaded from a ?empresa= link) must repaint too,
      // or the autocomplete stays empty under OnPush.
      this.cdr.markForCheck();
      return;
    }
    this.value = this.mask ? MASKS[this.mask].apply(value) : (value ?? '');
    if (typeof this.value === 'number') {
      this.value = String(this.value);
    }
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
    if (this.mask) {
      const masked = MASKS[this.mask].apply(newVal);
      if (event?.target) {
        event.target.value = masked;
      }
      this.value = masked;
      this.onChange(onlyDigits(masked));
      return;
    }
    if (this.pipe) {
      let formatted = newVal;
      formatted = this.pipe.transform(newVal);
      newVal = formatted;
    }
    this.value = newVal;
    this.onChange(this.type === 'number' ? (newVal === '' ? null : Number(newVal)) as any : newVal);
    if (this.type === 'autocomplete') {
      this.search$.next(newVal);
    }
  }

  /** Dica da sugestão do autocomplete; CPF/CNPJ aparece formatado. */
  itemTooltip(item: any): string {
    const tooltip = this.displayFieldTooltip ? item?.[this.displayFieldTooltip] : null;
    return tooltip ? formatDocument(String(tooltip)) : this.itemLabel(item);
  }

  itemLabel(item: any): string {
    return this.displayFn ? this.displayFn(item) : item?.[this.displayField];
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

  /** O ✕ do autocomplete: esvazia o campo e o valor do formulário (null), como apagar o texto à mão. */
  clear(): void {
    this.value = '';
    this.suggestions = [];
    this.showDropdown = false;
    this.search$.next('');
    this.onChange(null as any);
    this.onTouched();
    this.cdr.markForCheck();
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

  /** Teclado numérico no celular para os campos com máscara. */
  get inputMode(): string | null {
    if (this.mask === 'phone') return 'tel';
    return this.mask ? 'numeric' : null;
  }

  get effectiveMaxLength(): number {
    return this.mask ? MASKS[this.mask].maxLength : this.maxLength;
  }

  get hasValue(): boolean {
    return this.value !== '' && this.value !== null && this.value !== undefined;
  }

  // Native date/time inputs always render their own placeholder (e.g. "dd/mm/aaaa")
  // even when empty, so the floating label must stay floated for them - otherwise
  // it sits on top of that native placeholder instead of floating out of the way.
  get alwaysFloatLabel(): boolean {
    return ['date', 'time', 'datetime-local', 'month', 'week'].includes(this.type) || (this.type === 'select' && this.hasEmptyOption);
  }

  /** Select com uma opção de valor vazio ("Todas", "Toda origem"): ela é a escolha "sem filtro", não o placeholder. */
  get hasEmptyOption(): boolean {
    return this.options.some((option) => option.value === '' || option.value === null);
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
    if (errors['samePassword']) {
      messages.push('A senha nova precisa ser diferente da atual');
    }
    if (errors['colon']) {
      messages.push('O login não pode ter ":"');
    }
    if (errors['documentInvalid']) {
      messages.push('CPF/CNPJ inválido');
    }
    if (errors['cnpjInvalid']) {
      messages.push('CNPJ inválido: confira os dígitos');
    }
    if (errors['cpfInvalid']) {
      messages.push('CPF inválido: confira os dígitos');
    }
    if (errors['phoneInvalid']) {
      messages.push('Informe DDD + número (10 ou 11 dígitos)');
    }
    if (errors['maxBytes']) {
      messages.push(`Senha longa demais: no máximo ${errors['maxBytes'].max} bytes (acentos contam 2)`);
    }
    if (errors['server'] && typeof errors['server'] === 'string') {
      messages.push(errors['server']);
    }
    if (errors['noResults']) {
      messages.push('Nenhum resultado encontrado');
    }
    return messages;
  }

}
