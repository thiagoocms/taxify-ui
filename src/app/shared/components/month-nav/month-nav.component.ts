import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { monthLabel, shiftMonth, toMonth } from '../../../features/assessment/assessment-format';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * O seletor de mês de todas as telas que filtram por mês: ‹ Novembro de 2026 ›. As setas andam um mês; clicar no
 * nome abre o quadro com o ano e os 12 meses, para ir direto a um mês distante. Recebe "AAAA-MM" (ou vazio, com o
 * texto de `emptyLabel`, como "Todas as competências") e avisa a tela por `stepped` (quantos meses andou, a partir
 * do mês atual) e por `monthChange` (o mês escolhido).
 */
@Component({
  selector: 'app-month-nav',
  standalone: true,
  imports: [FaIconComponent],
  template: `
    <div class="month-nav" role="group" [attr.aria-label]="ariaLabel()">
      <button type="button" class="nav-btn" (click)="go(-1)" aria-label="Mês anterior" title="Mês anterior">
        <fa-icon [icon]="['fas', 'chevron-left']"></fa-icon>
      </button>
      <button type="button" class="month-label" [class.open]="open()" (click)="toggle()" title="Escolher o mês"
        aria-haspopup="dialog" [attr.aria-expanded]="open()">
        {{ label() }}
        <fa-icon class="caret" [icon]="['fas', open() ? 'chevron-up' : 'chevron-down']"></fa-icon>
      </button>
      <button type="button" class="nav-btn" (click)="go(1)" aria-label="Próximo mês" title="Próximo mês">
        <fa-icon [icon]="['fas', 'chevron-right']"></fa-icon>
      </button>

      @if (open()) {
        <div class="picker" role="dialog" aria-label="Escolher o mês">
          <div class="picker-year">
            <button type="button" class="nav-btn" (click)="year.set(year() - 1)" aria-label="Ano anterior">
              <fa-icon [icon]="['fas', 'chevron-left']"></fa-icon>
            </button>
            <strong>{{ year() }}</strong>
            <button type="button" class="nav-btn" (click)="year.set(year() + 1)" aria-label="Próximo ano">
              <fa-icon [icon]="['fas', 'chevron-right']"></fa-icon>
            </button>
          </div>
          <div class="picker-months">
            @for (name of months; track name; let i = $index) {
              <button type="button" class="picker-month" [class.selected]="isSelected(i)" [class.today]="isToday(i)"
                (click)="pick(i)">{{ name }}</button>
            }
          </div>
          <button type="button" class="picker-now" (click)="pickToday()">Mês atual</button>
        </div>
      }
    </div>
  `,
  styles: `
    .month-nav {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .nav-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #dde1ea;
      border-radius: 50%;
      background: #fff;
      color: #4b5563;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.15s, border-color 0.15s, color 0.15s;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: #f3f7ff;
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    .month-label {
      min-width: 170px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      font-weight: 600;
      color: var(--text-title);
      cursor: pointer;

      &:hover,
      &.open {
        border-color: #dde1ea;
        background: #f6f8fb;
      }

      .caret {
        font-size: 10px;
        color: #9ca3af;
      }
    }

    .picker {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      width: 250px;
      padding: 10px;
      border: 1px solid #dde1ea;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
    }

    .picker-year {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .nav-btn {
        width: 28px;
        height: 28px;
        font-size: 11px;
      }
    }

    .picker-months {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }

    .picker-month {
      padding: 6px 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: #f6f8fb;
      font-size: 13px;
      color: var(--text-title);
      cursor: pointer;

      &:hover {
        border-color: var(--color-primary);
      }

      &.today {
        border-color: #c7d7fb;
      }

      &.selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
      }
    }

    .picker-now {
      width: 100%;
      margin-top: 8px;
      padding: 5px 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--color-primary);
      font-size: 12px;
      cursor: pointer;

      &:hover {
        background: #f3f7ff;
      }
    }
  `,
})
export class MonthNavComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** "AAAA-MM". */
  readonly month = input<string | null | undefined>(null);
  readonly ariaLabel = input('Competência');
  /** O texto sem mês escolhido (ex.: Pendências, "Todas as competências"). */
  readonly emptyLabel = input('—');
  /** Quantos meses andou a partir do mês atual (setas: -1 / +1; o quadro: a diferença). */
  readonly stepped = output<number>();
  /** O mês escolhido - também quando não havia mês (as setas levam ao mês atual). */
  readonly monthChange = output<string>();

  readonly months = MONTHS;
  readonly open = signal(false);
  readonly year = signal(new Date().getFullYear());

  label(): string {
    const month = this.month();
    // "Novembro de 2026": só a primeira letra (o toLocaleDateString dá "novembro de 2026")
    const text = month ? monthLabel(month) : this.emptyLabel();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  go(delta: number): void {
    const month = this.month();
    this.open.set(false);
    this.stepped.emit(delta);
    this.monthChange.emit(month ? shiftMonth(month, delta) : toMonth(new Date()));
  }

  toggle(): void {
    const month = this.month();
    this.year.set(month ? Number(month.slice(0, 4)) : new Date().getFullYear());
    this.open.set(!this.open());
  }

  isSelected(index: number): boolean {
    return this.month() === this.key(index);
  }

  isToday(index: number): boolean {
    return toMonth(new Date()) === this.key(index);
  }

  pick(index: number): void {
    this.choose(this.key(index));
  }

  pickToday(): void {
    this.choose(toMonth(new Date()));
  }

  /** Fecha o quadro clicando fora ou com Esc. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  private choose(target: string): void {
    this.open.set(false);
    const month = this.month();
    if (target === month) {
      return;
    }
    if (month) {
      const [y1, m1] = month.split('-').map(Number);
      const [y2, m2] = target.split('-').map(Number);
      this.stepped.emit((y2 - y1) * 12 + (m2 - m1));
    }
    this.monthChange.emit(target);
  }

  private key(index: number): string {
    return `${this.year()}-${String(index + 1).padStart(2, '0')}`;
  }
}
