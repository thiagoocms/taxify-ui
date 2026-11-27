import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, input, OnDestroy, Output, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

let nextPanelId = 0;

/**
 * Painel lateral (detalhe de uma linha, histórico): abre com o foco no painel, Esc e o fundo fecham, e o foco volta
 * para quem abriu. O conteúdo entra por `<ng-content>`; o rodapé opcional por `[panelFooter]`.
 *
 *   <app-side-panel eyebrow="Crédito de estoque" [title]="row.companyName" (closed)="close()">...</app-side-panel>
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.scss',
})
export class SidePanel implements AfterViewInit, OnDestroy {
  readonly eyebrow = input('');
  readonly title = input('');
  /** Texto curto abaixo do título (ex.: CNPJ). */
  readonly subtitle = input('');
  readonly busy = input(false);

  @Output() closed = new EventEmitter<void>();

  readonly closeIcon = faXmark;
  readonly titleId = `side-panel-title-${++nextPanelId}`;

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly opener = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  ngAfterViewInit(): void {
    this.panel().nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.opener?.focus?.();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
