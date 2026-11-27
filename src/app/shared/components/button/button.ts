import {Component, EventEmitter, inject, Input, Output} from '@angular/core';
import {NgClass} from '@angular/common';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {FirmAccessService} from '../../../core/services/firm-access.service';
import {READ_ONLY_HINT} from '../../../core/models/firm-access.model';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass, FaIconComponent],
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class Button {
  @Input() type: 'button' | 'submit' = 'button';
  @Input() size: 'small' | 'large' | undefined = 'small';
  @Input() label: string = '';
  @Input() icon: string = '';
  @Input() severity: any = 'primary';
  @Input() variant: 'text' | 'outlined' | undefined = undefined;
  @Input() disabled: boolean = false;
  @Input() styleClass: string = '';
  @Input() rounded: boolean = false;
  /** Dica (title). Num botão só com ícone também vira o aria-label; com label, o nome acessível é o label. */
  @Input() tooltip: string = '';
  /**
   * Ação de escrita (POST/PUT/DELETE que o backend bloqueia em somente leitura): com o escritório bloqueado, o botão
   * fica desabilitado e o title explica o motivo. Não marque as ações de leitura (buscar, exportar, PDF...).
   */
  @Input() write = false;

  private readonly firmAccess = inject(FirmAccessService);

  /** Desabilitado só por causa do somente leitura. */
  get blockedByReadOnly(): boolean {
    return this.write && this.firmAccess.readOnly();
  }

  get isDisabled(): boolean {
    return this.disabled || this.blockedByReadOnly;
  }

  get titleText(): string | null {
    return this.blockedByReadOnly ? READ_ONLY_HINT : this.tooltip || null;
  }

  @Output() onClick = new EventEmitter<Event>();


  onButtonClick(event: Event): void {
    this.onClick.emit(event);
  }

  getSizeClass(): string {
    switch (this.size) {
      case 'small':
        return 'btn-sm';
      case 'large':
        return 'btn-lg';
      default:
        return '';
    }
  }
  getButtonClass(): string {
    const severity = this.severity || 'primary';

    if (this.variant === 'outlined') {
      return `btn-outline-${severity}`;
    }

    if (this.variant === 'text') {
      return `btn text-${severity} border-0 bg-transparent`;
    }

    return `btn-${severity}`;
  }
}
