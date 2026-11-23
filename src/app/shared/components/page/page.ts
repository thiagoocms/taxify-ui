import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { HelpPanelComponent } from '../../help/help-panel.component';
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
  imports: [CommonModule, Button, FaIconComponent, HelpPanelComponent],
  templateUrl: './page.html',
  styleUrl: './page.scss',
})
export class Page {
  private readonly confirmDialog = inject(ConfirmDialogService);

  @Input() pageTitle = '';
  @Input() pageDescription = '';
  @Input() pageButtons: PageButton[] = [];
  /** Artigo da Central de Ajuda desta tela (shared/help/help-content.ts) - mostra o "?" ao lado do título. */
  @Input() helpId?: string;

  helpOpen = false;

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
