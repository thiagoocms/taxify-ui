import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../shared/components/input/input';
import { StepIndicator } from '../../shared/components/step-indicator/step-indicator';
import { AuthSidePanel } from '../../shared/components/auth-side-panel/auth-side-panel';
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
export class AuthComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly cdr = inject(ChangeDetectorRef);

  /** 0 = login slide, 1 = register slide — both live in the same carousel track. */
  readonly activeIndex = signal(0);

  // ---------------------------------------------------------------- Login --
  readonly loginLoading = signal(false);
  readonly hideLoginPassword = signal(true);
  readonly loginEyeIcon = computed(() => (this.hideLoginPassword() ? faEye : faEyeSlash));

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
  readonly arrowLeft = faArrowLeft;

  readonly buttonLabel = computed(() => {
    if (this.registerLoading()) return 'Enviando...';
    if (this.step() === 0) return 'Iniciar cadastro';
    if (this.step() === this.lastStep) return 'Cadastrar';
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
    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.activeIndex.set(1);
    }
  }

  showLogin(): void {
    this.activeIndex.set(0);
    this.location.replaceState('/login');
  }

  showRegister(): void {
    this.activeIndex.set(1);
    this.step.set(0);
    this.location.replaceState('/register');
  }

  loginSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { login, password } = this.loginForm.getRawValue();
    this.loginLoading.set(true);

    this.authService.login(login, password).subscribe({
      next: () => {
        this.loginLoading.set(false);
        this.router.navigate(['/vinculos']);
      },
      error: () => {
        this.loginLoading.set(false);
      },
    });
  }

  changeStep(delta = 1): void {
    if (delta < 0) {
      this.step.update((value) => Math.max(0, value - 1));
      return;
    }

    if (this.step() === 0) {
      this.step.set(1);
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
  }

  private registerSubmit(): void {
    this.registerLoading.set(true);

    const { confirmPassword, ...value } = this.registerForm.getRawValue();

    this.userService.create({ ...value, profile: 'USER' }).subscribe({
      next: () => {
        this.registerLoading.set(false);
        this.showLogin();
      },
      error: () => {
        this.registerLoading.set(false);
      },
    });
  }
}
