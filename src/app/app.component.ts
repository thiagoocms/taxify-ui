import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { LoaderComponent } from './shared/components/loader/loader';
import { LoadingOverlayService } from './shared/components/loader/loading-overlay.service';
import { ConfirmDialog } from './shared/components/confirm-dialog/confirm-dialog';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faBan,
  faCheck,
  faFileSignature,
  faFileContract,
  faCircleQuestion,
  faClipboardCheck,
  faChartColumn,
  faHandHoldingDollar,
  faXmark,
  faArrowRight,
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCopy,
  faDownload,
  faEye,
  faFileCode,
  faFileInvoice,
  faFilePdf,
  faUpRightFromSquare,
  faFileZipper,
  faLocationDot,
  faLink,
  faLinkSlash,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRightFromBracket,
  faTrash,
  faUpload,
  faUser,
  faTriangleExclamation,
  faWandMagicSparkles,
  faLock,
  faLockOpen,
  faChevronLeft,
  faChevronRight,
  faCalculator,
  faCloudArrowDown,
  faRotateLeft,
  faToggleOff,
  faToggleOn,
  faEnvelope,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialog, LoaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'taxify-front';

  protected readonly overlay = inject(LoadingOverlayService);
  private releaseNavigation: (() => void) | null = null;
  /** O véu: aparece junto com o pedido e, ao terminar, some com fade (fica 'leaving' o tempo da transição). */
  protected readonly screen = signal<'hidden' | 'shown' | 'leaving'>('hidden');
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;
  private readonly followOverlay = effect(() => {
    const visible = this.overlay.visible();
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
    if (visible) {
      if (this.screen() !== 'shown') {
        this.shownAt = Date.now();
      }
      this.screen.set('shown');
    } else if (this.screen() !== 'hidden') {
      // ainda nem tinha aparecido (o véu espera 150ms): some direto, sem piscar
      if (Date.now() - this.shownAt < 150) {
        this.screen.set('hidden');
        return;
      }
      this.screen.set('leaving');
      this.leaveTimer = setTimeout(() => this.screen.set('hidden'), 220);
    }
  });

  constructor(library: FaIconLibrary) {
    library.addIcons(faBan, faCheck, faFileSignature, faXmark, faFileContract, faHandHoldingDollar, faCircleQuestion, faClipboardCheck, faChartColumn);
    library.addIcons(faLock, faLockOpen, faChevronLeft, faChevronRight, faCalculator, faPlus, faPen, faTrash, faLink, faLinkSlash, faMagnifyingGlass, faUser, faRightFromBracket, faArrowLeft, faUpload, faFileZipper, faCloudArrowDown);
    library.addIcons(
      faArrowRight, faChevronDown, faChevronUp, faCircleCheck, faCopy, faDownload, faEye, faFileCode,
      faFileInvoice, faFilePdf, faUpRightFromSquare, faLocationDot, faTriangleExclamation, faWandMagicSparkles,
      faRotateLeft, faToggleOff, faToggleOn, faEnvelope,
    );

    // Trocando de tela (inclusive baixando o pedaço do app da tela nova): o véu de carregando por cima.
    inject(Router).events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.releaseNavigation?.();
        this.releaseNavigation = this.overlay.show();
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        // segura um instante: se a tela nova também está carregando, o loader dela assume sem o véu piscar
        const release = this.releaseNavigation;
        this.releaseNavigation = null;
        setTimeout(() => release?.(), 60);
      }
    });
  }
}
