import { Component, HostListener, inject } from '@angular/core';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';
import { ConfirmDialogService } from './confirm-dialog.service';

/** O modal das confirmações pedidas ao {@link ConfirmDialogService}; um só, no AppComponent. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [Modal, Button],
  template: `
    @if (service.request(); as request) {
      <app-modal [open]="true" [title]="request.title" (closed)="service.answer(false)">
        <p class="confirm-message">{{ request.message }}</p>
        <div class="confirm-actions">
          <app-button label="Cancelar" variant="outlined" severity="secondary" (onClick)="service.answer(false)"></app-button>
          <app-button
            [label]="request.confirmLabel"
            [severity]="request.danger ? 'danger' : 'primary'"
            (onClick)="service.answer(true)"
          ></app-button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .confirm-message { margin: 0 0 1.25rem; white-space: pre-line; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `,
})
export class ConfirmDialog {
  protected readonly service = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.service.request()) {
      this.service.answer(false);
    }
  }
}
