import { Location } from '@angular/common';
import { ChangeDetectorRef, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation, faEye, faEyeSlash, faKey } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { CSHUB_WHATSAPP_URL } from '../../../shared/components/auth-side-panel/auth-links';
import { PasswordService } from '../../../core/services/password.service';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorCode, apiErrorMessage, httpStatusOf } from '../../../core/models/api-error.model';
import {
  LOGIN_NOTICE_PASSWORD_CHANGED,
  PASSWORD_DEFAULT_MIN_LENGTH,
  PASSWORD_DEFAULT_RESET_MINUTES,
  PASSWORD_ERRORS,
} from '../../../core/models/password.model';
import { PASSWORD_MAX_BYTES, PASSWORD_RULE_CODES, passwordRuleMessage } from '../../../core/models/user.model';
import { newPasswordGroupValidator, newPasswordValidators } from '../../../shared/utils/validators';


type ResetState = 'loading' | 'form' | 'invalid' | 'unavailable' | 'error';

/** Lê o token do fragmento `#token=...` (o navegador não manda o fragmento ao servidor: fica fora dos logs). */
export function tokenFromFragment(fragment: string | null | undefined): string | null {
  if (!fragment) {
    return null;
  }
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token')?.trim();
  return token ? token : null;
}

/**
 * Destino do link do e-mail de senha nova: `/auth/redefinir-senha#token=...` (SN-RN-03, SN-RN-05, SN-RN-06).
 * O token sai da barra de endereços assim que é lido; o link é conferido (`reset/check`) antes de mostrar o
 * formulário, para a pessoa não digitar a senha à toa num link vencido.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FaIconComponent, Button, InputComponent, LoaderComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../verify-email/verify-email.component.scss', './reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly passwordService = inject(PasswordService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly whatsappUrl = CSHUB_WHATSAPP_URL;
  readonly errorIcon = faCircleExclamation;
  readonly keyIcon = faKey;

  readonly state = signal<ResetState>('loading');
  readonly minLength = signal(PASSWORD_DEFAULT_MIN_LENGTH);
  readonly resetMinutes = signal(PASSWORD_DEFAULT_RESET_MINUTES);
  readonly saving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly hidePassword = signal(true);
  readonly eyeIcon = computed(() => (this.hidePassword() ? faEye : faEyeSlash));

  private token: string | null = null;

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', newPasswordValidators(PASSWORD_DEFAULT_MIN_LENGTH, PASSWORD_MAX_BYTES)],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: newPasswordGroupValidator({ password: 'newPassword', confirm: 'confirmPassword' }) },
  );

  ngOnInit(): void {
    this.token = tokenFromFragment(this.route.snapshot.fragment ?? window.location.hash);
    // Tira o token da barra de endereços e do histórico (history.replaceState pelo Location: sem o fragmento).
    this.location.replaceState(this.location.path(false));

    this.passwordService.getConfig().subscribe({
      next: (config) => {
        const min = config.minLength || PASSWORD_DEFAULT_MIN_LENGTH;
        this.minLength.set(min);
        this.resetMinutes.set(config.resetMinutes || PASSWORD_DEFAULT_RESET_MINUTES);
        this.form.controls.newPassword.setValidators(newPasswordValidators(min, PASSWORD_MAX_BYTES));
        this.form.controls.newPassword.updateValueAndValidity({ emitEvent: false });
      },
      error: () => undefined,
    });
    this.check();
  }

  /** `POST /auth/password/reset/check`: 204 mostra o formulário; 400 mostra "link vencido". Não consome o link. */
  check(): void {
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    this.state.set('loading');
    this.passwordService.checkResetToken(this.token).subscribe({
      next: () => this.state.set('form'),
      error: (error: unknown) => this.state.set(this.failureState(error) ?? 'error'),
    });
  }

  submit(): void {
    if (this.saving() || !this.token) {
      return;
    }
    // O erro devolvido pela API na tentativa anterior não pode impedir uma nova tentativa (o link continua valendo).
    Object.values(this.form.controls).forEach((control) => {
      if (control.hasError('server')) {
        control.updateValueAndValidity();
      }
    });
    this.form.updateValueAndValidity({ emitEvent: false });
    this.submitError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    this.saving.set(true);
    this.submitError.set(null);
    this.passwordService.reset(this.token, this.form.controls.newPassword.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.token = null;
        // As sessões abertas caíram (SN-RN-11): uma sessão velha neste navegador não serve mais.
        if (this.authService.isAuthenticated()) {
          this.authService.logout();
        }
        this.router.navigate(['/auth/login'], { replaceUrl: true, state: { notice: LOGIN_NOTICE_PASSWORD_CHANGED } });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.handleSubmitError(error);
      },
    });
  }

  /** Senha fora da regra: marca o campo e o link continua valendo. Link vencido no meio: a tela de link inválido. */
  private handleSubmitError(error: unknown): void {
    const code = apiErrorCode(error);
    const failure = this.failureState(error);
    if (failure === 'invalid' || failure === 'unavailable') {
      this.state.set(failure);
      return;
    }
    if (code && PASSWORD_RULE_CODES.has(code)) {
      const message = apiErrorMessage(error) ?? passwordRuleMessage(code, this.minLength()) ?? 'Senha inválida.';
      const control = this.form.controls.newPassword;
      control.setErrors({ ...(control.errors ?? {}), server: message });
      control.markAsTouched();
      this.submitError.set(message);
      this.cdr.detectChanges();
      return;
    }
    const status = httpStatusOf(error);
    this.submitError.set(
      status === 0
        ? 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo; o link continua valendo.'
        : status >= 500
          ? 'O Taxify está fora do ar no momento. Tente de novo em alguns minutos; o link continua valendo.'
          : apiErrorMessage(error) ?? 'Não foi possível salvar a senha agora. Tente de novo.',
    );
  }

  /** Link inválido (400 do token) ou recuperação desligada (503); `null` para os outros erros. */
  private failureState(error: unknown): ResetState | null {
    const code = apiErrorCode(error);
    const status = httpStatusOf(error);
    if (code === PASSWORD_ERRORS.resetTokenInvalid) {
      return 'invalid';
    }
    if (code === PASSWORD_ERRORS.resetUnavailable || status === 503) {
      return 'unavailable';
    }
    if (status === 400 && !code) {
      return 'invalid';
    }
    return null;
  }
}
