import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faCircleExclamation, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../../shared/components/button/button';
import { LoaderComponent } from '../../../shared/components/loader/loader';
import { CSHUB_WHATSAPP_URL } from '../../../shared/components/auth-side-panel/auth-links';
import { SignupService } from '../../../core/services/signup.service';
import { SIGNUP_ERRORS } from '../../../core/models/signup.model';
import { apiErrorCode, httpStatusOf } from '../../../core/models/api-error.model';
import { formatLocalDate } from '../../../shared/utils/format';
import { ResendEmailComponent } from '../resend-email/resend-email.component';

type VerifyState = 'loading' | 'success' | 'invalid' | 'error';

/**
 * Destino do link do e-mail de confirmação: `/auth/verificar?token=...` → `POST /signup/verify`.
 * O token sai da barra de endereços assim que é lido (não fica no histórico do navegador).
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [Button, LoaderComponent, FaIconComponent, ResendEmailComponent, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly signupService = inject(SignupService);

  readonly whatsappUrl = CSHUB_WHATSAPP_URL;
  readonly okIcon = faCircleCheck;
  readonly errorIcon = faCircleExclamation;
  readonly mailIcon = faEnvelope;

  readonly state = signal<VerifyState>('loading');
  readonly trialEndsOn = signal<string | null>(null);
  readonly verificationHours = signal(24);
  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    // Tira o token da barra de endereços e do histórico (replaceUrl), pelo Router - sem dessincronizar a rota.
    this.router.navigate([], { relativeTo: this.route, queryParams: { token: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.signupService.getConfig().subscribe({
      next: (config) => this.verificationHours.set(config.verificationHours ?? 24),
      error: () => undefined,
    });
    this.verify();
  }

  verify(): void {
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    this.state.set('loading');
    this.signupService.verify(this.token).subscribe({
      next: (response) => {
        this.trialEndsOn.set(response.trialEndsOn);
        this.state.set('success');
      },
      error: (error: unknown) => {
        const status = httpStatusOf(error);
        const invalid = apiErrorCode(error) === SIGNUP_ERRORS.tokenInvalid || status === 400;
        this.state.set(invalid ? 'invalid' : 'error');
      },
    });
  }

  formatDate(value: string | null): string {
    return formatLocalDate(value);
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
