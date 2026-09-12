import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Button } from '../button/button';

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
})
export class Page {
  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() pageButtons: PageButton[] = [];

  action(pageButton: PageButton): void {
    const confirmMessage = pageButton.id ? CONFIRM_MESSAGES[pageButton.id] : undefined;
    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    pageButton.handler?.();
  }
}
