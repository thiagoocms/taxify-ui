import { Component, inject, Input, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { SignupService } from '../../../core/services/signup.service';
import { httpStatusOf } from '../../../core/models/api-error.model';

/** Espera entre dois cliques (o backend aceita até 3 reenvios por hora; acima disso responde 202 e não envia). */
const COOLDOWN_SECONDS = 60;

/**
 * "Reenviar e-mail" de confirmação (`POST /signup/resend`). A resposta é sempre 202, exista ou não o login, então a
 * tela nunca diz "enviado para fulano": diz que, se houver cadastro pendente, um link novo foi enviado.
 * Com `login` vindo de fora (login recusado, cadastro recém-feito) o campo não aparece.
 */
@Component({
  selector: 'app-resend-email',
  standalone: true,
  imports: [ReactiveFormsModule, Button, InputComponent],
  templateUrl: './resend-email.component.html',
  styleUrl: './resend-email.component.scss',
})
export class ResendEmailComponent implements OnDestroy {
  private readonly signupService = inject(SignupService);

  /** Login já conhecido; vazio = o usuário digita. */
  @Input() login: string | null = null;
  @Input() hours = 24;

  readonly loginControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);
  readonly cooldown = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  buttonLabel(): string {
    if (this.sending()) return 'Enviando...';
    if (this.cooldown() > 0) return `Reenviar e-mail (${this.cooldown()}s)`;
    return 'Reenviar e-mail';
  }

  resend(): void {
    const login = (this.login ?? this.loginControl.value).trim();
    if (!login) {
      this.loginControl.markAsTouched();
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    this.signupService.resend(login).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.startCooldown();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        const status = httpStatusOf(error);
        this.error.set(
          status === 0
            ? 'Não foi possível falar com o Taxify. Verifique sua internet e tente de novo.'
            : 'Não foi possível reenviar agora. Tente de novo em alguns minutos.',
        );
      },
    });
  }

  private startCooldown(): void {
    this.cooldown.set(COOLDOWN_SECONDS);
    this.clearTimer();
    this.timer = setInterval(() => {
      this.cooldown.update((value) => value - 1);
      if (this.cooldown() <= 0) {
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
