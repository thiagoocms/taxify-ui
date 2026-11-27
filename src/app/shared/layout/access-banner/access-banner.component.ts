import { Component, computed, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faClock, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FirmAccessService } from '../../../core/services/firm-access.service';
import { FirmAccessDTO } from '../../../core/models/firm-access.model';
import { CSHUB_WHATSAPP_URL } from '../../components/auth-side-panel/auth-links';
import { formatLocalDate } from '../../utils/format';

/** Motivo do bloqueio por extenso, para "Somente leitura: {motivo} desde {data}". */
function blockedReasonText(access: FirmAccessDTO): string {
  switch (access.reason) {
    case 'TRIAL_EXPIRED':
      return 'o teste grátis terminou';
    case 'ACCESS_EXPIRED':
      return 'o prazo de acesso liberado terminou';
    case 'NON_PAYMENT':
      return 'há fatura em aberto';
    default:
      if (access.status === 'CANCELED') return 'a conta do escritório foi cancelada';
      if (access.status === 'SUSPENDED') return 'o acesso foi suspenso pela CS Hub';
      return 'o acesso do escritório está bloqueado';
  }
}

function daysText(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

/**
 * Faixa fixa no topo de todas as telas (F1-RN-09 e F1-RN-16):
 * - teste grátis: dias restantes ("Seu teste termina hoje" no último dia) e o uso do limite;
 * - somente leitura: motivo e data, há quantos dias as capturas estão paradas e o aviso dos ~90 dias da SEFAZ.
 * Os números vêm prontos do `GET /firm-access`; aqui só se formata.
 */
@Component({
  selector: 'app-access-banner',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './access-banner.component.html',
  styleUrl: './access-banner.component.scss',
})
export class AccessBannerComponent {
  private readonly firmAccess = inject(FirmAccessService);

  readonly whatsappUrl = CSHUB_WHATSAPP_URL;
  readonly lockIcon = faLock;
  readonly clockIcon = faClock;
  readonly warnIcon = faTriangleExclamation;

  readonly access = this.firmAccess.access;

  readonly mode = computed<'blocked' | 'trial' | 'past-due' | null>(() => {
    const access = this.access();
    if (!access || access.exempt) return null;
    if (access.readOnly) return 'blocked';
    if (access.status === 'TRIAL') return 'trial';
    if (access.status === 'PAST_DUE') return 'past-due';
    return null;
  });

  readonly blockedTitle = computed(() => {
    const access = this.access();
    if (!access) return '';
    const since = access.blockedSince ? ` desde ${formatLocalDate(access.blockedSince)}` : '';
    return `Somente leitura: ${blockedReasonText(access)}${since}.`;
  });

  readonly capturesText = computed(() => {
    const days = this.access()?.capturesStoppedDays;
    if (days == null) return 'As capturas automáticas estão paradas.';
    if (days <= 0) return 'As capturas automáticas pararam hoje.';
    return `As capturas automáticas estão paradas há ${daysText(days)}.`;
  });

  readonly sefazText = computed(
    () =>
      `A SEFAZ disponibiliza as notas por cerca de ${this.access()?.sefazRetentionDays ?? 90} dias. ` +
      'Um bloqueio longo pode fazer notas de entrada se perderem.',
  );

  readonly trialTitle = computed(() => {
    const access = this.access();
    const days = access?.trialDaysLeft;
    if (days == null) {
      return access?.trialEndsOn ? `Teste grátis até ${formatLocalDate(access.trialEndsOn)}.` : 'Teste grátis.';
    }
    if (days <= 1) return 'Seu teste termina hoje.';
    return `Teste grátis: faltam ${daysText(days)} (até ${formatLocalDate(access?.trialEndsOn)}).`;
  });

  readonly limitsText = computed(() => {
    const limits = this.access()?.limits;
    if (!limits) return null;
    return `Empresas: ${limits.companiesInUse} de ${limits.maxCompanies} · Usuários: ${limits.usersInUse} de ${limits.maxUsers}`;
  });

  readonly lastDay = computed(() => (this.access()?.trialDaysLeft ?? 99) <= 1);
}
