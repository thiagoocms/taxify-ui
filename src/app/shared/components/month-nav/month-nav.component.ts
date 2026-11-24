import { Component, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { monthLabel, shiftMonth } from '../../../features/assessment/assessment-format';

/**
 * O seletor de mês de todas as telas que filtram por mês: ‹ Novembro de 2026 ›. Recebe "AAAA-MM" (ou vazio, com
 * o texto de `emptyLabel`, como "Todas as competências") e avisa a tela pelas setas: `stepped` com -1 / +1 e
 * `monthChange` com o novo mês (quando havia um).
 */
@Component({
  selector: 'app-month-nav',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    <div class="month-nav" role="group" [attr.aria-label]="ariaLabel()">
      <button type="button" class="chip icon-chip" (click)="go(-1)" aria-label="Mês anterior" title="Mês anterior">
        <fa-icon [icon]="['fas', 'chevron-left']"></fa-icon>
      </button>
      <span class="month-label">{{ label() }}</span>
      <button type="button" class="chip icon-chip" (click)="go(1)" aria-label="Próximo mês" title="Próximo mês">
        <fa-icon [icon]="['fas', 'chevron-right']"></fa-icon>
      </button>
    </div>
  `,
  styles: `
    .month-nav {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .icon-chip {
      width: 34px;
      height: 34px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .month-label {
      min-width: 150px;
      text-align: center;
      font-weight: 600;
      color: var(--text-title);
      display: inline-block;

      /* "Novembro de 2026": só a primeira letra (capitalize daria "Novembro De 2026"). */
      &::first-letter {
        text-transform: uppercase;
      }
    }
  `,
})
export class MonthNavComponent {
  /** "AAAA-MM". */
  readonly month = input<string | null | undefined>(null);
  readonly ariaLabel = input('Competência');
  /** O texto sem mês escolhido (ex.: Pendências, "Todas as competências"). */
  readonly emptyLabel = input('—');
  readonly stepped = output<number>();
  readonly monthChange = output<string>();

  label(): string {
    const month = this.month();
    return month ? monthLabel(month) : this.emptyLabel();
  }

  go(delta: number): void {
    this.stepped.emit(delta);
    const month = this.month();
    if (month) {
      this.monthChange.emit(shiftMonth(month, delta));
    }
  }
}
