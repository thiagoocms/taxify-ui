import { Component, Input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

/**
 * Dica curta ao lado de um termo que costuma confundir: um "?" pequeno que mostra o texto ao passar
 * o mouse ou ao focar pelo teclado.
 */
@Component({
  selector: 'app-help-tip',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    <span class="help-tip" tabindex="0" role="note" [attr.aria-label]="text" (click)="$event.stopPropagation()">
      <fa-icon [icon]="['fas', 'circle-question']"></fa-icon>
      <span class="bubble" [class.left]="align === 'left'">{{ text }}</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; vertical-align: middle; }
    .help-tip { position: relative; display: inline-flex; align-items: center; color: #9aa3b2; cursor: help; font-size: 13px;
      margin-left: 4px; outline: none; }
    .help-tip:hover, .help-tip:focus { color: var(--color-primary); }
    .bubble { position: absolute; z-index: 50; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); width: max-content;
      max-width: 280px; padding: 8px 10px; border-radius: 8px; background: #1f2937; color: #fff; font-size: 12px; font-weight: 400;
      line-height: 1.4; text-align: left; white-space: normal; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
      opacity: 0; visibility: hidden; transition: opacity 0.12s; pointer-events: none; }
    .bubble.left { left: auto; right: -6px; transform: none; }
    .help-tip:hover .bubble, .help-tip:focus .bubble { opacity: 1; visibility: visible; }
  `,
})
export class HelpTipComponent {
  @Input({ required: true }) text = '';
  /** "left": a bolha abre para a esquerda (para ícones perto da borda direita). */
  @Input() align: 'center' | 'left' = 'center';
}
