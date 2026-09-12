import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass} from '@angular/common';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';

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
