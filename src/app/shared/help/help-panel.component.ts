import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { HelpArticleComponent } from './help-article.component';
import { findArticle, HelpArticle } from './help-content';

/** Painel lateral com o artigo da tela — aberto pelo "?" do cabeçalho, sem sair da página. */
@Component({
  selector: 'app-help-panel',
  standalone: true,
  imports: [FaIconComponent, HelpArticleComponent],
  template: `
    @if (open && article) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <aside class="panel" role="dialog" aria-modal="true" [attr.aria-label]="'Ajuda: ' + article.title">
        <header>
          <div>
            <span class="eyebrow">Ajuda</span>
            <h5>{{ article.title }}</h5>
          </div>
          <button type="button" class="close" aria-label="Fechar ajuda" (click)="closed.emit()">
            <fa-icon [icon]="['fas', 'xmark']"></fa-icon>
          </button>
        </header>
        <div class="body">
          <app-help-article [article]="article" (openRelated)="article = find($event)"></app-help-article>
        </div>
        <footer>
          <button type="button" class="link" (click)="openCenter()">Abrir na Central de Ajuda</button>
        </footer>
      </aside>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.25); z-index: 1040; }
    .panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: #fff; z-index: 1045;
      display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(15, 23, 42, 0.12); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 20px 12px;
      border-bottom: 1px solid #eef1f6; }
    .eyebrow { font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.04em; }
    h5 { margin: 2px 0 0; font-weight: 700; color: var(--color-primary); font-size: 17px; }
    .close { border: none; background: transparent; color: #6c757d; font-size: 18px; padding: 4px 8px; border-radius: 6px; }
    .close:hover { background: #eef1f6; color: var(--text-title); }
    .body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    footer { padding: 12px 20px; border-top: 1px solid #eef1f6; }
    .link { border: none; background: transparent; color: var(--color-primary); font-size: 14px; padding: 0; }
    .link:hover { text-decoration: underline; }
  `,
})
export class HelpPanelComponent {
  @Input() open = false;
  @Input() set articleId(id: string | undefined) {
    this.article = findArticle(id);
  }
  @Output() closed = new EventEmitter<void>();

  article: HelpArticle | undefined;

  constructor(private readonly router: Router) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  find(id: string): HelpArticle | undefined {
    return findArticle(id) ?? this.article;
  }

  openCenter(): void {
    const id = this.article?.id;
    this.closed.emit();
    this.router.navigate(id ? ['/ajuda', id] : ['/ajuda']);
  }
}
