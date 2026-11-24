import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, computed, ElementRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../shared/components/input/input';
import { StepIndicator } from '../../shared/components/step-indicator/step-indicator';
import { AuthSidePanel } from '../../shared/components/auth-side-panel/auth-side-panel';
import { CSHUB_WHATSAPP_URL, SITE_URL } from '../../shared/components/auth-side-panel/auth-links';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';

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

const STEP_FIELDS: Record<number, string[]> = {
  1: ['name', 'documentType', 'documentNumber'],
  2: ['login', 'email'],
  3: ['password', 'confirmPassword'],
};

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
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
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

  /** 0 = login slide, 1 = register slide — both live in the same carousel track. */
  readonly activeIndex = signal(0);

  // ---------------------------------------------------------------- Login --
  readonly loginLoading = signal(false);
  readonly hideLoginPassword = signal(true);
  readonly loginEyeIcon = computed(() => (this.hideLoginPassword() ? faEye : faEyeSlash));
  /** Erro do login perto do formulário (o toast do interceptor continua aparecendo). */
  readonly loginError = signal<string | null>(null);
  /** Aviso depois do cadastro: a conta foi criada, agora é entrar. */
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

  readonly buttonLabel = computed(() => {
    if (this.registerLoading()) return 'Enviando...';
    if (this.step() === 0) return 'Começar o cadastro';
    if (this.step() === this.lastStep) return 'Criar a conta do escritório';
    return 'Continuar';
  });

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CPF', label: 'CPF' },
    { value: 'CNPJ', label: 'CNPJ' },
  ];

  readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required]],
      documentType: ['CPF', [Validators.required]],
      documentNumber: ['', [Validators.required]],
      login: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    if (this.route.snapshot.routeConfig?.path === 'register') {
      this.activeIndex.set(1);
    }
  }

  ngAfterViewInit(): void {
    this.focusFirstField();
  }

  showLogin(): void {
    this.activeIndex.set(0);
    this.registerError.set(null);
    this.location.replaceState('/auth/login');
    this.focusFirstField();
  }

  showRegister(): void {
    this.activeIndex.set(1);
    this.step.set(0);
    this.loginError.set(null);
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
      const fields = Array.from(slide?.querySelectorAll<HTMLInputElement>('input, select') ?? []);
      // O primeiro campo vazio (depois do cadastro o login já vem preenchido: vai direto para a senha).
      const target = fields.find((field) => !field.value) ?? fields[0];
      target?.focus({ preventScroll: true });
    });
  }

  /** Mensagem do login perto do formulário: credencial errada x sistema fora do ar. */
  private describeLoginError(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : -1;
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
    this.loginNotice.set(null);

    this.authService.login(login, password).subscribe({
      next: () => {
        this.loginLoading.set(false);
        this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.loginLoading.set(false);
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

  /** Cadastro recusado: a mensagem da API (login ou documento já usado...) ou sistema fora do ar. */
  private describeRegisterError(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : -1;
    const apiMessage =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : null;
    if (status >= 400 && status < 500 && apiMessage) {
      return apiMessage;
    }
    if (status === 0) {
      return 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo em instantes.';
    }
    if (status >= 500) {
      return 'O Taxify está fora do ar no momento. Tente de novo em alguns minutos.';
    }
    return 'Não foi possível criar a conta. Confira os dados e tente de novo.';
  }

  private registerSubmit(): void {
    this.registerLoading.set(true);

    const { confirmPassword, ...value } = this.registerForm.getRawValue();

    // Usuários que se cadastram pelo formulário público são donos da conta,
    // por isso entram como ADMIN. Usuários criados dentro do sistema pelo
    // admin (ver features/users) entram como EMPLOYEE.
    this.userService.create({ ...value, profile: 'ADMIN' }).subscribe({
      next: () => {
        this.registerLoading.set(false);
        // Volta ao login já com o login preenchido: falta só a senha que acabou de criar.
        this.loginForm.patchValue({ login: value.login, password: '' });
        this.loginNotice.set('Conta do escritório criada. Entre com a senha que você acabou de cadastrar.');
        this.showLogin();
      },
      error: (error: unknown) => {
        this.registerLoading.set(false);
        this.registerError.set(this.describeRegisterError(error));
      },
    });
  }
}
