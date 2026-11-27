import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { FirmAccessService } from '../../core/services/firm-access.service';
import { ReformFeaturesService } from '../../core/services/reform-features.service';
import { AccessBannerComponent } from './access-banner/access-banner.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

/** Releitura da situação do escritório ao trocar de tela, no máximo uma vez a cada 5 minutos. */
const ACCESS_MAX_AGE_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, AccessBannerComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly firmAccess = inject(FirmAccessService);
  private readonly reformFeatures = inject(ReformFeaturesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sidebarOpen = signal(false);

  ngOnInit(): void {
    // Situação do escritório (faixas, somente leitura, limite do teste, menu "Plataforma").
    this.firmAccess.reload();
    // Recursos da Reforma ligados no ambiente (menu "Reforma Tributária").
    this.reformFeatures.reload();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.firmAccess.reloadIfStale(ACCESS_MAX_AGE_MS));
  }

  ngOnDestroy(): void {
    // Saiu da área logada (logout/sessão vencida): o próximo usuário não vê a situação deste.
    this.firmAccess.clear();
    this.reformFeatures.clear();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
