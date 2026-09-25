import { Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBuilding, faCircleCheck, faClipboardCheck, faUserShield } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-auth-side-panel',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './auth-side-panel.html',
  styleUrl: './auth-side-panel.scss',
})
export class AuthSidePanel {
  readonly auditedIcon = faCircleCheck;
  // A real NF-e access key is 44 digits, always shown on the DANFE in
  // 11 groups of 4 — the mock below borrows that exact shape.
  readonly mockAccessKey = '3524 0114 2000 9900 0187 5500 1000 0012 3456 7890 1234';
  readonly features = [
    { icon: faClipboardCheck, text: 'Auditoria de notas fiscais' },
    { icon: faBuilding, text: 'Gestão centralizada de empresas' },
    { icon: faUserShield, text: 'Controle de acesso por papel' },
  ];
}
