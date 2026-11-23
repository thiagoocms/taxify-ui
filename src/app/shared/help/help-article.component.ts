import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { findArticle, HelpArticle } from './help-content';

/** Um artigo da ajuda: resumo, seções e relacionados. Usado na Central de Ajuda e no painel do "?". */
@Component({
  selector: 'app-help-article',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (article) {
      <article class="help-article">
        <p class="summary">{{ article.summary }}</p>
        @for (section of article.sections; track section.title) {
          <section>
            <h6>{{ section.title }}</h6>
            @for (paragraph of section.paragraphs ?? []; track $index) {
              <p>{{ paragraph }}</p>
            }
            @if (section.items?.length) {
              <ul>
                @for (item of section.items; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </section>
        }
        @if (related().length) {
          <section class="related">
            <h6>Veja também</h6>
            <div class="related-links">
              @for (other of related(); track other.id) {
                <button type="button" class="chip" (click)="openRelated.emit(other.id)">{{ other.title }}</button>
              }
            </div>
          </section>
        }
      </article>
    }
  `,
  styles: `
    .help-article { font-size: 14px; color: var(--text-title); line-height: 1.55; }
    .summary { font-size: 15px; color: #4b5563; margin-bottom: 16px; }
    section { margin-bottom: 18px; }
    h6 { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: var(--text-title); }
    p { margin-bottom: 8px; }
    ul { padding-left: 18px; margin-bottom: 0; }
    li { margin-bottom: 6px; }
    .related-links { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { border: 1px solid #dde1ea; background: #fff; color: var(--text-title); border-radius: 999px; padding: 6px 14px;
      font-size: 13px; line-height: 1.2; }
    .chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
  `,
})
export class HelpArticleComponent {
  @Input() article: HelpArticle | undefined;
  @Output() openRelated = new EventEmitter<string>();

  related(): HelpArticle[] {
    return (this.article?.related ?? []).map((id) => findArticle(id)).filter((item): item is HelpArticle => !!item);
  }
}
