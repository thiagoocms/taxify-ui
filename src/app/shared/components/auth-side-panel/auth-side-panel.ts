import { Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBuilding, faChartLine, faClipboardCheck, faUserShield } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-auth-side-panel',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './auth-side-panel.html',
  styleUrl: './auth-side-panel.scss',
})
export class AuthSidePanel {
  readonly chartIcon = faChartLine;
  readonly features = [
    { icon: faClipboardCheck, text: 'Auditoria de notas fiscais' },
    { icon: faBuilding, text: 'Gestão centralizada de empresas' },
    { icon: faUserShield, text: 'Controle de acesso por papel' },
  ];
}
