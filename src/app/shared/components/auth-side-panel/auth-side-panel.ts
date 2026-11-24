import { Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowRight,
  faComments,
  faCalendarCheck,
  faFileCircleCheck,
  faUsers,
  faStopwatch,
} from '@fortawesome/free-solid-svg-icons';
import { CSHUB_WHATSAPP_URL, SITE_URL } from './auth-links';

/**
 * Lado institucional das telas de login e cadastro: continua o site de apresentação
 * (https://taxify.cshub.com.br/) - mesma mensagem, mesmos destaques e a volta para o site.
 * Só o que o sistema faz de verdade, sem números.
 */
@Component({
  selector: 'app-auth-side-panel',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './auth-side-panel.html',
  styleUrl: './auth-side-panel.scss',
})
export class AuthSidePanel {
  readonly siteUrl = SITE_URL;
  readonly whatsappUrl = CSHUB_WHATSAPP_URL;
  readonly arrowIcon = faArrowRight;
  readonly whatsappIcon = faComments;

  readonly features = [
    { icon: faFileCircleCheck, title: 'Notas conferidas', text: 'NF-e de entrada e saída da SIEG e da SEFAZ, com os impostos refeitos item a item.' },
    { icon: faUsers, title: 'Carteira, equipe e honorários', text: 'Cada pessoa com o seu perfil e as suas empresas, e o financeiro de cada cliente.' },
    { icon: faStopwatch, title: 'Manifestação no prazo', text: 'Cada nota com o prazo da manifestação conclusiva e envio em lote.' },
    { icon: faCalendarCheck, title: 'Apuração e fechamento do mês', text: 'Faturamento, RBT12 e impostos estimados por empresa, com relatório.' },
  ];
}
