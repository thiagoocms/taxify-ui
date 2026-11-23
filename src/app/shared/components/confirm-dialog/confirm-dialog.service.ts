import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  /** Título do modal; padrão "Confirmar". */
  title?: string;
  /** Texto do botão de confirmação; padrão "Confirmar". */
  confirmLabel?: string;
  /** Ação destrutiva (excluir, remover...): botão vermelho. */
  danger?: boolean;
}

export interface ConfirmRequest extends Required<ConfirmOptions> {
  message: string;
}

/**
 * Confirmação no modal do design system, no lugar do confirm() nativo do navegador.
 * O diálogo fica no AppComponent (<app-confirm-dialog>); quem chama só aguarda a resposta:
 *
 *   if (!(await this.confirmDialog.ask('Excluir?', { danger: true }))) return;
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolve?: (confirmed: boolean) => void;

  ask(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    // Uma confirmação aberta e outra pedida: a anterior conta como cancelada.
    this.resolve?.(false);
    this.request.set({
      message,
      title: options.title ?? 'Confirmar',
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      danger: options.danger ?? false,
    });
    return new Promise<boolean>((resolve) => (this.resolve = resolve));
  }

  answer(confirmed: boolean): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.request.set(null);
    resolve?.(confirmed);
  }
}
