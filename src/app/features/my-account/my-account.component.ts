import { ChangeDetectorRef, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faCircleExclamation, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { TimeoutError } from 'rxjs';
import { Button } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { LoaderComponent } from '../../shared/components/loader/loader';
import { Page } from '../../shared/components/page/page';
import { AuthService } from '../../core/services/auth.service';
import { MyAccountService } from '../../core/services/my-account.service';
import { PasswordService } from '../../core/services/password.service';
import { apiErrorCode, apiErrorMessage, httpStatusOf } from '../../core/models/api-error.model';
import { PendencyHighDigestSettingDTO } from '../../core/models/notification-settings.model';
import { PASSWORD_DEFAULT_MIN_LENGTH } from '../../core/models/password.model';
import {
  PASSWORD_CHANGE_ERRORS,
  PASSWORD_MAX_BYTES,
  PASSWORD_RULE_CODES,
  passwordRuleMessage,
} from '../../core/models/user.model';
import { newPasswordGroupValidator, newPasswordValidators } from '../../shared/utils/validators';

const CURRENT_INVALID_MESSAGE = 'Senha atual incorreta.';
const PASSWORD_CHANGE_TIMEOUT_MESSAGE =
  'O Taxify não respondeu a tempo. Verifique sua internet e tente de novo. Se a senha já tiver sido trocada, o ' +
  'Taxify vai pedir para você entrar de novo: use a senha nova.';
const RATE_LIMITED_MESSAGE =
  'Muitas tentativas com a senha atual errada. Por segurança, a troca fica bloqueada por até 60 minutos, mesmo com a ' +
  'senha certa. Tente de novo mais tarde ou peça ao administrador do escritório para definir uma senha nova.';

/**
 * Minha conta (spec 2026-11-27, SN-RN-09 e AV-RN-08): troca da própria senha e o resumo diário de pendências altas.
 * Liberada com o escritório em somente leitura (é credencial e preferência pessoal, não dado do escritório): os
 * botões daqui não são de "escrita" para o bloqueio.
 */
@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, Button, InputComponent, LoaderComponent, Page],
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.scss',
})
export class MyAccountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly myAccount = inject(MyAccountService);
  private readonly passwordService = inject(PasswordService);
  private readonly toastr = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly authService = inject(AuthService);

  readonly okIcon = faCircleCheck;
  readonly errorIcon = faCircleExclamation;

  // ---------------------------------------------------------------- Senha --
  readonly minLength = signal(PASSWORD_DEFAULT_MIN_LENGTH);
  readonly saving = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordChanged = signal(false);
  readonly hidePasswords = signal(true);
  readonly eyeIcon = computed(() => (this.hidePasswords() ? faEye : faEyeSlash));

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', newPasswordValidators(PASSWORD_DEFAULT_MIN_LENGTH, PASSWORD_MAX_BYTES)],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: newPasswordGroupValidator({
        password: 'newPassword',
        confirm: 'confirmPassword',
        current: 'currentPassword',
      }),
    },
  );

  // ------------------------------------------------------- Avisos por e-mail --
  readonly digest = signal<PendencyHighDigestSettingDTO | null>(null);
  readonly digestLoading = signal(true);
  readonly digestLoadError = signal<string | null>(null);
  readonly digestSaving = signal(false);
  readonly digestError = signal<string | null>(null);

  ngOnInit(): void {
    this.passwordService.getConfig().subscribe({
      next: (config) => {
        const min = config.minLength || PASSWORD_DEFAULT_MIN_LENGTH;
        this.minLength.set(min);
        this.passwordForm.controls.newPassword.setValidators(newPasswordValidators(min, PASSWORD_MAX_BYTES));
        this.passwordForm.controls.newPassword.updateValueAndValidity({ emitEvent: false });
      },
      error: () => undefined,
    });
    this.loadDigest();
  }

  // ---------------------------------------------------------------- Senha --
  changePassword(): void {
    if (this.saving()) {
      return;
    }
    this.passwordChanged.set(false);
    // O erro devolvido pela API na tentativa anterior não pode impedir uma nova tentativa (ex.: atual errada → 429).
    Object.values(this.passwordForm.controls).forEach((control) => {
      if (control.hasError('server')) {
        control.updateValueAndValidity();
      }
    });
    this.passwordForm.updateValueAndValidity({ emitEvent: false });
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.saving.set(true);
    this.passwordError.set(null);
    // O serviço troca o token salvo pelo da resposta: esta sessão continua e as outras caem.
    this.myAccount.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.passwordForm.reset();
        this.passwordChanged.set(true);
        this.toastr.success('Senha alterada. As outras sessões abertas foram encerradas.', 'Minha conta');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.handlePasswordError(error);
      },
    });
  }

  /** 400 da senha atual ou da regra marca o campo; 429 explica o bloqueio de 60 minutos. */
  private handlePasswordError(error: unknown): void {
    const code = apiErrorCode(error);
    const status = httpStatusOf(error);
    const apiMessage = apiErrorMessage(error);

    if (status === 401) {
      // Sessão revogada: o interceptor já deslogou e levou para o login.
      return;
    }
    if (code === PASSWORD_CHANGE_ERRORS.rateLimited || status === 429) {
      this.passwordError.set(apiMessage ?? RATE_LIMITED_MESSAGE);
      return;
    }
    if (code === PASSWORD_CHANGE_ERRORS.currentInvalid) {
      this.markField('currentPassword', apiMessage ?? CURRENT_INVALID_MESSAGE);
      return;
    }
    if (code && PASSWORD_RULE_CODES.has(code)) {
      this.markField('newPassword', apiMessage ?? passwordRuleMessage(code, this.minLength()) ?? 'Senha inválida.');
      return;
    }
    if (error instanceof TimeoutError) {
      this.passwordError.set(PASSWORD_CHANGE_TIMEOUT_MESSAGE);
      return;
    }
    if (status === 0) {
      this.passwordError.set('Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.');
      return;
    }
    if (status >= 500) {
      this.passwordError.set('O Taxify está fora do ar no momento. A senha não foi trocada; tente de novo em alguns minutos.');
      return;
    }
    this.passwordError.set(apiMessage ?? 'Não foi possível trocar a senha agora. Tente de novo.');
  }

  private markField(field: 'currentPassword' | 'newPassword', message: string): void {
    const control = this.passwordForm.controls[field];
    control.setErrors({ ...(control.errors ?? {}), server: message });
    control.markAsTouched();
    this.passwordError.set(message);
    this.cdr.detectChanges();
  }

  // ------------------------------------------------------- Avisos por e-mail --
  loadDigest(): void {
    this.digestLoading.set(true);
    this.digestLoadError.set(null);
    this.myAccount.getNotificationSettings().subscribe({
      next: (settings) => {
        this.digest.set(settings.pendencyHighDigest);
        this.digestLoading.set(false);
      },
      error: (error: unknown) => {
        this.digestLoading.set(false);
        if (httpStatusOf(error) === 401) {
          return;
        }
        this.digestLoadError.set(
          httpStatusOf(error) === 0
            ? 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.'
            : 'Não foi possível carregar os seus avisos agora. Tente de novo em instantes.',
        );
      },
    });
  }

  /** Liga ou desliga na hora (sem botão de salvar); volta ao estado anterior se a gravação falhar. */
  toggleDigest(enabled: boolean): void {
    const current = this.digest();
    if (!current || !current.eligible || this.digestSaving() || current.enabled === enabled) {
      return;
    }
    this.digestSaving.set(true);
    this.digestError.set(null);
    this.digest.set({ ...current, enabled });
    this.myAccount.setPendencyHighDigest(enabled).subscribe({
      next: (settings) => {
        this.digestSaving.set(false);
        this.digest.set(settings.pendencyHighDigest);
        this.toastr.success(
          settings.pendencyHighDigest.enabled
            ? 'Resumo diário de pendências altas ligado.'
            : 'Resumo diário de pendências altas desligado.',
          'Avisos por e-mail',
        );
      },
      error: (error: unknown) => {
        this.digestSaving.set(false);
        this.digest.set(current);
        if (httpStatusOf(error) === 401) {
          return;
        }
        this.digestError.set(apiErrorMessage(error) ?? 'Não foi possível gravar a preferência. Tente de novo.');
      },
    });
  }
}
