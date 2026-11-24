import { Component, inject, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { LoadingOverlayService } from './loading-overlay.service';

/**
 * Carregando do Taxify: a logo se montando (o "T" desenha, a bolinha quica).
 * - page (padrão): a tela ainda não chegou - liga o véu escuro por cima da tela inteira (um só, no shell);
 * - section: centralizado na área, para o que carrega dentro de um modal;
 * - inline: pequeno, ao lado do texto (dentro de cartões e linhas);
 * - overlay: a tabela recarregando - também usa o véu escuro da tela (os dados de antes continuam por baixo);
 * - screen: o véu em si (uso interno do AppComponent).
 */
@Component({
  selector: 'app-loader',
  standalone: true,
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
  host: { '[class]': "'loader-' + variant", role: 'status', 'aria-live': 'polite' },
})
export class LoaderComponent implements OnInit, OnChanges, OnDestroy {
  private readonly overlay = inject(LoadingOverlayService);
  private release: (() => void) | null = null;

  @Input() message = 'Carregando...';
  @Input() variant: 'page' | 'section' | 'inline' | 'overlay' | 'screen' = 'page';

  ngOnInit(): void {
    this.sync();
  }

  ngOnChanges(): void {
    if (this.release) {
      this.sync();
    }
  }

  ngOnDestroy(): void {
    this.release?.();
  }

  private sync(): void {
    this.release?.();
    this.release = this.variant === 'page' || this.variant === 'overlay' ? this.overlay.show(this.message) : null;
  }
}
