import { Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { ACCESS_PROFILE_OPTIONS, AccessProfile } from '../../../core/models/access.model';
import {
  LOGIN_INVALID_CHAR_MESSAGE,
  LOGIN_SELF_CHANGE_MESSAGE,
  PASSWORD_MAX_BYTES,
  PASSWORD_RULE_CODES,
  PASSWORD_TOO_LONG_MESSAGE,
  passwordRuleMessage,
  USER_ERRORS,
  UserDTO,
} from '../../../core/models/user.model';
import { PASSWORD_DEFAULT_MIN_LENGTH } from '../../../core/models/password.model';
import { AuthService } from '../../../core/services/auth.service';
import { PasswordService } from '../../../core/services/password.service';
import { UserService } from '../../../core/services/user.service';
import { apiErrorCode, apiErrorMessage } from '../../../core/models/api-error.model';
import { maxBytesValidator, noColonValidator } from '../../../shared/utils/validators';
import { UserLinksComponent } from '../user-links/user-links.component';

/** Erro de campo do POST/PUT /users: o campo marcado e o texto padrão (se a API não mandar mensagem). */
const USER_FIELD_ERRORS: Record<string, { field: 'login' | 'documentNumber' | 'password'; message: string }> = {
  [USER_ERRORS.loginExists]: { field: 'login', message: 'Já existe um usuário com esse login.' },
  [USER_ERRORS.loginInvalidChar]: { field: 'login', message: LOGIN_INVALID_CHAR_MESSAGE },
  [USER_ERRORS.loginSelfChange]: { field: 'login', message: LOGIN_SELF_CHANGE_MESSAGE },
  [USER_ERRORS.documentExists]: { field: 'documentNumber', message: 'Já existe um usuário com este documento.' },
  [USER_ERRORS.passwordInvalid]: { field: 'password', message: PASSWORD_TOO_LONG_MESSAGE },
};

const EMPLOYEE_PROFILE = 'EMPLOYEE';
const ADMIN_PROFILE = 'ADMIN';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent, Button, UserLinksComponent],
  templateUrl: './user-form.component.html',
  styles: `
    .form-container { max-width: 900px; }
    .field-help { margin-top: -14px; font-size: 12px; line-height: 1.4; }
  `,
})
export class UserFormComponent implements OnChanges, OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly passwordService = inject(PasswordService);
  private readonly authService = inject(AuthService);

  /** Mínimo da senha (GET /auth/password/config). */
  readonly minLength = signal(PASSWORD_DEFAULT_MIN_LENGTH);

  @Input() user: UserDTO | null = null;
  @Output() saved = new EventEmitter<UserDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  /** Erro da gravação perto do botão (o de campo também fica marcado no campo). */
  readonly formError = signal<string | null>(null);
  readonly hidePassword = signal(true);
  readonly eyeIcon = computed(() => (this.hidePassword() ? faEye : faEyeSlash));

  readonly accessProfileOptions = ACCESS_PROFILE_OPTIONS;
  readonly userTypeOptions: SelectOption[] = [
    { value: EMPLOYEE_PROFILE, label: 'Colaborador (acessa conforme os perfis)' },
    { value: ADMIN_PROFILE, label: 'Administrador (acessa tudo)' },
  ];
  /** Perfis marcados - um colaborador pode ter vários; as permissões se somam. */
  readonly selectedProfiles = signal<Set<AccessProfile>>(new Set());

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CPF', label: 'CPF' },
    { value: 'CNPJ', label: 'CNPJ' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    documentType: ['CPF', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    login: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    profile: [EMPLOYEE_PROFILE, [Validators.required]],
  });

  get isAdminType(): boolean {
    return this.form.controls.profile.value === ADMIN_PROFILE;
  }

  toggleProfile(profile: AccessProfile, checked: boolean): void {
    const next = new Set(this.selectedProfiles());
    if (checked) {
      next.add(profile);
    } else {
      next.delete(profile);
    }
    this.selectedProfiles.set(next);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.form.reset({
        name: this.user?.name ?? '',
        documentType: this.user?.documentType ?? 'CPF',
        documentNumber: this.user?.documentNumber ?? '',
        login: this.user?.login ?? '',
        email: this.user?.email ?? '',
        password: '',
        profile: this.user?.profile === ADMIN_PROFILE ? ADMIN_PROFILE : EMPLOYEE_PROFILE,
      });
      this.selectedProfiles.set(new Set(this.user?.accessProfiles ?? []));
      this.formError.set(null);
      this.applyValidators();
    }
  }

  ngOnInit(): void {
    // O mínimo da senha é o do servidor (TAXIFY_PASSWORD_MIN_LENGTH); até chegar, o padrão da spec (8).
    this.passwordService.getConfig().subscribe({
      next: (config) => {
        this.minLength.set(config.minLength || PASSWORD_DEFAULT_MIN_LENGTH);
        this.applyValidators();
      },
      error: () => undefined,
    });
  }

  /**
   * Senha: obrigatória na criação; na edição, em branco mantém a atual. Preenchida, segue a regra (mínimo e 72 bytes).
   * Login: `:` só é recusado em login novo (os antigos continuam valendo). Editando o próprio cadastro, a senha fica
   * bloqueada (a própria senha só se troca em Minha conta, que pede a atual, P-SN-09) e o login também (só outro
   * ADMIN muda).
   */
  private applyValidators(): void {
    const password = this.form.controls.password;
    const rule = [Validators.minLength(this.minLength()), maxBytesValidator(PASSWORD_MAX_BYTES)];
    password.setValidators(this.isEdit ? rule : [Validators.required, ...rule]);
    if (this.isSelf) {
      password.setValue('');
      password.disable({ emitEvent: false });
    } else {
      password.enable({ emitEvent: false });
    }
    password.updateValueAndValidity({ emitEvent: false });

    const login = this.form.controls.login;
    // Na edição, o `:` só é recusado quando o login muda (o backend recusa a troca; o login antigo continua valendo).
    const originalLogin = this.isEdit ? (this.user?.login ?? null) : null;
    const colonWhenChanged = (control: AbstractControl): ValidationErrors | null =>
      originalLogin !== null && control.value === originalLogin ? null : noColonValidator(control);
    login.setValidators([Validators.required, colonWhenChanged]);
    // O próprio login não muda por aqui (o backend responde error.user.login.self.change); outro ADMIN pode mudar.
    // Desabilitado, o getRawValue continua mandando o login atual no PUT.
    if (this.isSelf) {
      login.disable({ emitEvent: false });
    } else {
      login.enable({ emitEvent: false });
    }
    login.updateValueAndValidity({ emitEvent: false });
  }

  get isEdit(): boolean {
    return !!this.user?.id;
  }

  /** O ADMIN editando o próprio cadastro. */
  get isSelf(): boolean {
    return this.isEdit && !!this.user?.id && this.user.id === this.authService.userId();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.formError.set(null);
    const { password, profile, ...rest } = this.form.getRawValue();

    // Administrador acessa tudo - perfis só valem para colaborador. O backend impede que o
    // escritório fique sem nenhum administrador.
    const value: UserDTO = {
      ...rest,
      profile,
      accessProfiles: profile === ADMIN_PROFILE ? [] : [...this.selectedProfiles()],
      ...(password ? { password } : {}),
    };

    const request$ = this.isEdit
      ? this.userService.update(this.user!.id!, { ...this.user, ...value })
      : this.userService.create(value);

    request$.subscribe({
      next: (user) => {
        this.loading.set(false);
        this.saved.emit(user);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.showSaveError(error);
      },
    });
  }

  /**
   * Login/CPF duplicado e senha longa: marca o campo (o interceptor não mostra toast para esses códigos).
   * Qualquer outro erro já foi para o toast do interceptor, com a `message` da API.
   */
  private showSaveError(error: unknown): void {
    const code = apiErrorCode(error);
    const message = apiErrorMessage(error);
    const passwordRule =
      code && (PASSWORD_RULE_CODES.has(code) || code === USER_ERRORS.passwordUseSelfChange)
        ? { field: 'password' as const, message: passwordRuleMessage(code, this.minLength()) ?? 'Senha inválida.' }
        : undefined;
    const mapped = passwordRule ?? (code ? USER_FIELD_ERRORS[code] : undefined);
    if (!mapped) {
      return;
    }
    const text = message ?? mapped.message;
    const control = this.form.controls[mapped.field];
    control.setErrors({ ...(control.errors ?? {}), server: text });
    control.markAsTouched();
    this.formError.set(text);
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
