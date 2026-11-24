import { Component, Input } from '@angular/core';

/**
 * Carregando do Taxify: a logo se montando (o "T" desenha, a bolinha quica), no lugar do texto solto.
 * - block: centralizado na área, para a tela ou a seção que ainda não chegou;
 * - inline: pequeno, ao lado do texto (dentro de cartões e linhas);
 * - overlay: por cima de uma tabela que está recarregando, com o fundo esmaecido.
 */
@Component({
  selector: 'app-loader',
  standalone: true,
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
  host: { '[class]': "'loader-' + variant", role: 'status', 'aria-live': 'polite' },
})
export class LoaderComponent {
  @Input() message = 'Carregando...';
  @Input() variant: 'block' | 'inline' | 'overlay' = 'block';
}
