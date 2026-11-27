import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, computed, ElementRef, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCircleCheck,
  faCircleExclamation,
  faComments,
  faEnvelope,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { StepIndicator } from '../../shared/components/step-indicator/step-indicator';
import { AuthSidePanel } from '../../shared/components/auth-side-panel/auth-side-panel';
import { CSHUB_WHATSAPP_URL, SITE_URL } from '../../shared/components/auth-side-panel/auth-links';
import { AuthService } from '../../core/services/auth.service';
import { SignupService } from '../../core/services/signup.service';
import { SIGNUP_ERRORS, SignupConfigDTO } from '../../core/models/signup.model';
import { apiErrorCode, apiErrorMessage, httpStatusOf } from '../../core/models/api-error.model';
import { cnpjValidator, cpfValidator, maxBytesValidator, phoneValidator } from '../../shared/utils/validators';
import { PASSWORD_MAX_BYTES, PASSWORD_TOO_LONG_MESSAGE, USER_ERRORS } from '../../core/models/user.model';
import { onlyDigits } from '../../shared/utils/document-mask';
import { ResendEmailComponent } from './resend-email/resend-email.component';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password');
  const confirmPassword = group.get('confirmPassword');

  if (!password || !confirmPassword) {
    return null;
  }

  if (confirmPassword.value && password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ ...confirmPassword.errors, mismatch: true });
  } else if (confirmPassword.hasError('mismatch')) {
    const { mismatch, ...rest } = confirmPassword.errors ?? {};
    confirmPassword.setErrors(Object.keys(rest).length ? rest : null);
  }

  return null;
}

type RegisterField =
  | 'firmName'
  | 'firmDocument'
  | 'billingEmail'
  | 'contactPhone'
  | 'name'
  | 'document'
  | 'email'
  | 'login'
  | 'password'
  | 'confirmPassword'
  | 'acceptTerms';

const STEP_FIELDS: Record<number, RegisterField[]> = {
  1: ['firmName', 'firmDocument', 'billingEmail', 'contactPhone'],
  2: ['name', 'document', 'email', 'login'],
  3: ['password', 'confirmPassword', 'acceptTerms'],
};

/** Onde cada erro do cadastro aparece: o campo (e a etapa dele) e o texto padrão, se a API não mandar mensagem. */
const SIGNUP_FIELD_ERRORS: Record<string, { field: RegisterField; message: string }> = {
  [SIGNUP_ERRORS.firmDocumentInvalid]: { field: 'firmDocument', message: 'CNPJ inválido: confira os dígitos.' },
  [SIGNUP_ERRORS.firmDocumentExists]: { field: 'firmDocument', message: 'Este CNPJ já tem conta no Taxify. Fale com a CS Hub.' },
  [SIGNUP_ERRORS.billingEmailInvalid]: { field: 'billingEmail', message: 'E-mail financeiro inválido.' },
  [SIGNUP_ERRORS.phoneInvalid]: { field: 'contactPhone', message: 'Informe DDD + número (10 ou 11 dígitos).' },
  [SIGNUP_ERRORS.userDocumentInvalid]: { field: 'document', message: 'CPF inválido: confira os dígitos.' },
  [SIGNUP_ERRORS.emailInvalid]: { field: 'email', message: 'E-mail inválido.' },
  [SIGNUP_ERRORS.loginInvalid]: { field: 'login', message: 'Login inválido.' },
  [USER_ERRORS.loginExists]: { field: 'login', message: 'Já existe um usuário com esse login.' },
  [USER_ERRORS.documentExists]: { field: 'document', message: 'Já existe um usuário com este CPF.' },
  [USER_ERRORS.passwordInvalid]: { field: 'password', message: PASSWORD_TOO_LONG_MESSAGE },
  [SIGNUP_ERRORS.termsRequired]: { field: 'acceptTerms', message: 'Aceite os termos para criar a conta.' },
};

const SIGNUP_CLOSED_MESSAGE = 'O cadastro está fechado no momento. Fale com a CS Hub para criar a conta do escritório.';

function stepOf(field: RegisterField): number {
  const entry = Object.entries(STEP_FIELDS).find(([, fields]) => fields.includes(field));
  return entry ? Number(entry[0]) : 1;
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FaIconComponent,
    InputComponent,
    Button,
    StepIndicator,
    AuthSidePanel,
    ResendEmailComponent,
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly signupService = inject(SignupService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly siteUrl = SITE_URL;
  readonly whatsappUrl = CSHUB_WHATSAPP_URL;
  readonly arrowRight = faArrowRight;
  readonly whatsappIcon = faComments;
  readonly errorIcon = faCircleExclamation;
  readonly successIcon = faCircleCheck;
  readonly mailIcon = faEnvelope;

  /** 0 = login slide, 1 = register slide — both live in the same carousel track. */
  readonly activeIndex = signal(0);

  // --------------------------------------------------------- Signup config --
  /** `GET /signup/config`; enquanto não chega (ou se falhar), "Criar conta" fica escondido. */
  readonly signupConfig = signal<SignupConfigDTO | null>(null);
  readonly signupAvailable = computed(() => this.signupConfig()?.available === true);
  readonly trialDays = computed(() => this.signupConfig()?.trialDays ?? 14);
  readonly verificationHours = computed(() => this.signupConfig()?.verificationHours ?? 24);
  /** Chegou por /auth/register com o cadastro fechado: explica no login em vez de mostrar um formulário que não envia. */
  readonly signupClosedNotice = signal(false);

  // ---------------------------------------------------------------- Login --
  readonly loginLoading = signal(false);
  readonly hideLoginPassword = signal(true);
  readonly loginEyeIcon = computed(() => (this.hideLoginPassword() ? faEye : faEyeSlash));
  /** Erro do login perto do formulário (o toast do interceptor continua aparecendo). */
  readonly loginError = signal<string | null>(null);
  /** Login recusado porque o e-mail ainda não foi confirmado: guarda o login para o "Reenviar e-mail". */
  readonly loginNotVerified = signal<string | null>(null);
  readonly loginNotice = signal<string | null>(null);
  /** "Esqueceu a senha?": não há troca de senha por e-mail no backend - mostra a quem pedir. */
  readonly showForgotHelp = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  // ------------------------------------------------------------- Register --
  readonly step = signal(0);
  readonly lastStep = 3;

  readonly registerLoading = signal(false);
  readonly hidePassword = signal(true);
  readonly hideConfirmPassword = signal(true);
  readonly eyeIcon = computed(() => (this.hidePassword() ? faEye : faEyeSlash));
  readonly eyeIconConfirm = computed(() => (this.hideConfirmPassword() ? faEye : faEyeSlash));
  readonly registerError = signal<string | null>(null);
  readonly arrowLeft = faArrowLeft;
  /** Cadastro aceito: a tela troca o formulário pelo "verifique seu e-mail". */
  readonly registered = signal<{ email: string; login: string; hours: number } | null>(null);

  readonly buttonLabel = computed(() => {
    if (this.registerLoading()) return 'Enviando...';
    if (this.step() === 0) return 'Começar o cadastro';
    if (this.step() === this.lastStep) return 'Criar a conta';
    return 'Continuar';
  });

  readonly registerForm = this.fb.nonNullable.group(
    {
      firmName: ['', [Validators.required, Validators.maxLength(300)]],
      firmDocument: ['', [Validators.required, cnpjValidator]],
      billingEmail: ['', [Validators.required, Validators.email, Validators.maxLength(300)]],
      contactPhone: ['', [Validators.required, phoneValidator]],
      name: ['', [Validators.required]],
      document: ['', [Validators.required, cpfValidator]],
      email: ['', [Validators.required, Validators.email]],
      login: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6), maxBytesValidator(PASSWORD_MAX_BYTES)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const wantsRegister = this.route.snapshot.routeConfig?.path === 'register';
    if (wantsRegister) {
      this.activeIndex.set(1);
    }
    this.signupService.getConfig().subscribe({
      next: (config) => {
        this.signupConfig.set(config);
        if (!config.available) {
          this.closeRegisterSlide(wantsRegister);
        }
      },
      error: () => this.closeRegisterSlide(wantsRegister),
    });
  }

  ngAfterViewInit(): void {
    this.focusFirstField();
  }

  /** Cadastro fechado (ou a config não veio): quem abriu /auth/register vai para o login com o aviso. */
  private closeRegisterSlide(wantsRegister: boolean): void {
    if (this.activeIndex() === 1) {
      this.signupClosedNotice.set(wantsRegister);
      this.showLogin();
    }
  }

  showLogin(): void {
    this.activeIndex.set(0);
    this.registerError.set(null);
    this.location.replaceState('/auth/login');
    this.focusFirstField();
  }

  showRegister(): void {
    if (!this.signupAvailable()) {
      return;
    }
    this.activeIndex.set(1);
    this.step.set(0);
    this.loginError.set(null);
    this.loginNotVerified.set(null);
    this.location.replaceState('/auth/register');
    this.focusFirstField();
  }

  /**
   * Foco no primeiro campo da tela visível (login: o login; cadastro: o primeiro campo da etapa).
   * Depois da renderização, porque a etapa nova ainda não está no DOM.
   */
  private focusFirstField(): void {
    setTimeout(() => {
      const slide = this.host.nativeElement.querySelectorAll<HTMLElement>('.form-slide')[this.activeIndex()];
      const fields = Array.from(slide?.querySelectorAll<HTMLInputElement>('input:not([type=checkbox]), select') ?? []);
      // O primeiro campo vazio (depois do cadastro o login já vem preenchido: vai direto para a senha).
      const target = fields.find((field) => !field.value) ?? fields[0];
      target?.focus({ preventScroll: true });
    });
  }

  /** Mensagem do login perto do formulário: credencial errada x sistema fora do ar. */
  private describeLoginError(error: unknown): string {
    const status = httpStatusOf(error);
    if (status === 401 || status === 403) {
      return 'Login ou senha incorretos. Confira os dados e tente de novo.';
    }
    if (status === 0) {
      return 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo em instantes.';
    }
    if (status >= 500) {
      return 'O Taxify está fora do ar no momento. Tente de novo em alguns minutos.';
    }
    return 'Não foi possível entrar agora. Tente de novo.';
  }

  loginSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { login, password } = this.loginForm.getRawValue();
    this.loginLoading.set(true);
    this.loginError.set(null);
    this.loginNotVerified.set(null);
    this.loginNotice.set(null);
    this.signupClosedNotice.set(false);

    this.authService.login(login, password).subscribe({
      next: () => {
        this.loginLoading.set(false);
        this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.loginLoading.set(false);
        if (apiErrorCode(error) === SIGNUP_ERRORS.emailNotVerified) {
          this.loginNotVerified.set(login.trim());
          return;
        }
        this.loginError.set(this.describeLoginError(error));
      },
    });
  }

  changeStep(delta = 1): void {
    if (this.registerLoading()) {
      return;
    }
    this.registerError.set(null);

    if (delta < 0) {
      this.step.update((value) => Math.max(0, value - 1));
      this.focusFirstField();
      return;
    }

    if (this.step() === 0) {
      this.step.set(1);
      this.focusFirstField();
      return;
    }

    const fields = STEP_FIELDS[this.step()] ?? [];
    const valid = fields.every((field) => {
      const control = this.registerForm.get(field);
      control?.markAsTouched();
      return control?.valid;
    });

    if (!valid) {
      // The custom app-input components use OnPush change detection and only
      // refresh on events raised from within their own template, so marking
      // controls as touched from here needs a manual detectChanges to show errors.
      this.cdr.detectChanges();
      return;
    }

    if (this.step() === this.lastStep) {
      this.registerSubmit();
      return;
    }

    this.step.update((value) => value + 1);
    this.focusFirstField();
  }

  private registerSubmit(): void {
    const config = this.signupConfig();
    if (!config?.available || !config.termsVersion) {
      this.registerError.set(SIGNUP_CLOSED_MESSAGE);
      return;
    }
    this.registerLoading.set(true);
    const value = this.registerForm.getRawValue();

    // Sem `profile`: o backend sempre cria quem se cadastra como ADMIN do escritório novo.
    this.signupService
      .create({
        firm: {
          name: value.firmName.trim(),
          documentNumber: onlyDigits(value.firmDocument),
          billingEmail: value.billingEmail.trim(),
          contactPhone: onlyDigits(value.contactPhone),
        },
        user: {
          name: value.name.trim(),
          document: onlyDigits(value.document),
          login: value.login.trim(),
          email: value.email.trim(),
          password: value.password,
        },
        termsVersion: config.termsVersion,
      })
      .subscribe({
        next: (response) => {
          this.registerLoading.set(false);
          this.registered.set({
            email: value.email.trim(),
            login: value.login.trim(),
            hours: response?.verificationHours ?? this.verificationHours(),
          });
          this.loginForm.patchValue({ login: value.login.trim(), password: '' });
        },
        error: (error: unknown) => {
          this.registerLoading.set(false);
          this.handleRegisterError(error);
        },
      });
  }

  /** Cadastro recusado: decide pelo `code`; o erro de campo volta para a etapa dele, marcado no campo. */
  private handleRegisterError(error: unknown): void {
    const status = httpStatusOf(error);
    const code = apiErrorCode(error);
    const apiMessage = apiErrorMessage(error);

    if (code === SIGNUP_ERRORS.unavailable || (status === 503 && !code)) {
      this.signupConfig.update((config) => (config ? { ...config, available: false } : config));
      this.registerError.set(SIGNUP_CLOSED_MESSAGE);
      return;
    }
    if (code === SIGNUP_ERRORS.termsOutdated) {
      // Os termos mudaram enquanto a tela estava aberta: busca a versão nova e pede o aceite de novo.
      this.registerForm.controls.acceptTerms.setValue(false);
      this.signupService.getConfig().subscribe({ next: (config) => this.signupConfig.set(config), error: () => undefined });
      this.goToStep(3);
      this.registerError.set('Os termos de uso foram atualizados. Leia a versão nova e marque o aceite de novo.');
      return;
    }
    if (code === SIGNUP_ERRORS.rateLimited || status === 429) {
      this.registerError.set(
        'Já foram feitos muitos cadastros a partir desta rede hoje. Tente de novo amanhã ou fale com a CS Hub.',
      );
      return;
    }
    const mapped = code ? SIGNUP_FIELD_ERRORS[code] : undefined;
    if (mapped) {
      this.markServerError(mapped.field, apiMessage ?? mapped.message);
      return;
    }
    if (status === 0) {
      this.registerError.set('Não foi possível falar com o Taxify. Verifique sua internet e tente de novo em instantes.');
      return;
    }
    if (status >= 500) {
      this.registerError.set('O Taxify está fora do ar no momento. Tente de novo em alguns minutos.');
      return;
    }
    // error.signup.conflict e qualquer outro code sem campo próprio: a mensagem da API.
    this.registerError.set(apiMessage ?? 'Não foi possível criar a conta. Confira os dados e tente de novo.');
  }

  /** Volta para a etapa do campo, marca o erro nele (some quando o usuário edita) e repete a mensagem no rodapé. */
  private markServerError(field: RegisterField, message: string): void {
    const control = this.registerForm.get(field);
    this.goToStep(stepOf(field));
    // Renderiza a etapa antes: ao ligar o campo, o formControlName revalida o controle e apagaria o erro.
    this.cdr.detectChanges();
    control?.setErrors({ ...(control.errors ?? {}), server: message });
    control?.markAsTouched();
    this.registerError.set(message);
    this.cdr.detectChanges();
  }

  private goToStep(step: number): void {
    this.step.set(step);
    this.focusFirstField();
  }

  /** "Verifique seu e-mail" → login, com o login já preenchido. */
  backToLoginAfterSignup(): void {
    const registered = this.registered();
    this.registered.set(null);
    this.registerForm.reset();
    this.step.set(0);
    if (registered) {
      this.loginNotice.set(
        `Depois de clicar no link enviado para ${registered.email}, entre com o login e a senha que você cadastrou.`,
      );
    }
    this.showLogin();
  }
}
