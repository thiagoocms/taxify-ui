import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [NgClass],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  @Input() open = false;
  @Input() title = '';
  @Input() size: 'default' | 'lg' | 'xl' = 'default';

  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}
