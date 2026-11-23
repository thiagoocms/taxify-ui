import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { Button } from '../button/button';
import { ConfirmDialogService } from '../confirm-dialog/confirm-dialog.service';

export interface PageButton {
  id?: string;
  label?: string;
  icon?: string;
  severity?: any;
  variant?: 'text' | 'outlined' | undefined;
  isDisabled?: boolean;
  isShow?: boolean;
  handler?: () => void;
}

const CONFIRM_MESSAGES: Record<string, string> = {
  new: 'Deseja limpar os campos do formulário para criar um novo?',
  delete: 'Esta ação irá apagar permanentemente os dados, deseja continuar?',
};

@Component({
  selector: 'app-page',
  standalone: true,
  imports: [CommonModule, Button],
  templateUrl: './page.html',
  styleUrl: './page.scss',
})
export class Page {
  private readonly confirmDialog = inject(ConfirmDialogService);

  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() pageButtons: PageButton[] = [];

  async action(pageButton: PageButton): Promise<void> {
    const confirmMessage = pageButton.id ? CONFIRM_MESSAGES[pageButton.id] : undefined;
    if (confirmMessage && !(await this.confirmDialog.ask(confirmMessage, pageButton.id === 'delete'
        ? { title: 'Excluir', confirmLabel: 'Excluir', danger: true }
        : { title: 'Novo registro', confirmLabel: 'Limpar campos' }))) {
      return;
    }

    pageButton.handler?.();
  }
}
