import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputComponent } from '../../shared/components/input/input';
import { Page } from '../../shared/components/page/page';
import { HelpArticleComponent } from '../../shared/help/help-article.component';
import { FAQ, findArticle, GLOSSARY, HELP_ARTICLES, HelpArticle } from '../../shared/help/help-content';

type View = { kind: 'article'; id: string } | { kind: 'glossary' } | { kind: 'faq' };

const GROUPS: HelpArticle['group'][] = ['Notas e documentos', 'Obrigações e controles', 'Configuração'];

/** Remove acentos e caixa: "Ciência" acha "ciencia". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Central de Ajuda: um artigo por tela, o glossário e as perguntas frequentes, com busca. O "?" de cada
 * tela abre o mesmo artigo num painel lateral.
 */
@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputComponent, Page, HelpArticleComponent],
  template: `
    <app-page pageTitle="Ajuda" pageDescription="Como cada tela funciona, o glossário fiscal e as perguntas frequentes">
      <div class="search-field">
        <app-input label="Buscar na ajuda (ex.: ciência, retenção, certificado)" [formControl]="search"></app-input>
      </div>

      <div class="help-layout">
        <nav class="help-nav" aria-label="Artigos da ajuda">
          @for (group of groups; track group) {
            @if (articlesOf(group).length) {
              <div class="nav-group">{{ group }}</div>
              @for (article of articlesOf(group); track article.id) {
                <button type="button" class="nav-item" [class.active]="isArticle(article.id)" (click)="openArticle(article.id)">
                  {{ article.title }}
                </button>
              }
            }
          }
          <div class="nav-group">Referência</div>
          <button type="button" class="nav-item" [class.active]="view().kind === 'glossary'" (click)="go('glossario')">
            Glossário <span class="count">{{ glossary().length }}</span>
          </button>
          <button type="button" class="nav-item" [class.active]="view().kind === 'faq'" (click)="go('perguntas')">
            Perguntas frequentes <span class="count">{{ faq().length }}</span>
          </button>
        </nav>

        <section class="help-content">
          @switch (view().kind) {
            @case ('glossary') {
              <h5>Glossário</h5>
              @if (!glossary().length) { <p class="empty">Nenhum termo com "{{ search.value }}".</p> }
              <dl class="glossary">
                @for (entry of glossary(); track entry.term) {
                  <dt>{{ entry.term }}</dt>
                  <dd>{{ entry.definition }}</dd>
                }
              </dl>
            }
            @case ('faq') {
              <h5>Perguntas frequentes</h5>
              @if (!faq().length) { <p class="empty">Nenhuma pergunta com "{{ search.value }}".</p> }
              @for (entry of faq(); track entry.question) {
                <div class="faq-item">
                  <h6>{{ entry.question }}</h6>
                  <p>{{ entry.answer }}</p>
                  @if (entry.articleId) {
                    <button type="button" class="link" (click)="openArticle(entry.articleId)">Ver: {{ titleOf(entry.articleId) }}</button>
                  }
                </div>
              }
            }
            @default {
              @if (current(); as article) {
                <h5>{{ article.title }}</h5>
                @if (article.route) {
                  <button type="button" class="link mb-3" (click)="router.navigate([article.route])">Ir para a tela →</button>
                }
                <app-help-article [article]="article" (openRelated)="openArticle($event)"></app-help-article>
              } @else {
                <p class="empty">Nenhum artigo com "{{ search.value }}". Tente o glossário ou as perguntas frequentes.</p>
              }
            }
          }
        </section>
      </div>
    </app-page>
  `,
  styles: `
    .search-field { max-width: 520px; margin-bottom: 8px; }
    .help-layout { display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 900px) { .help-layout { grid-template-columns: 1fr; } }
    .help-nav { display: flex; flex-direction: column; gap: 2px; position: sticky; top: 12px; }
    .nav-group { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6c757d; margin: 14px 0 4px 10px; }
    .nav-group:first-child { margin-top: 0; }
    .nav-item { text-align: left; border: none; background: transparent; padding: 7px 10px; border-radius: 8px; font-size: 14px;
      color: var(--text-title); display: flex; justify-content: space-between; align-items: center; }
    .nav-item:hover { background: #f1f4f9; }
    .nav-item.active { background: #e6eefb; color: var(--color-primary); font-weight: 600; }
    .count { font-size: 12px; color: #6c757d; font-weight: 400; }
    .help-content { border: 1px solid #eef1f6; border-radius: var(--border-radius); padding: 20px 24px; min-height: 320px; }
    h5 { font-weight: 700; color: var(--color-primary); margin-bottom: 8px; }
    .link { border: none; background: transparent; color: var(--color-primary); padding: 0; font-size: 14px; display: block; }
    .link:hover { text-decoration: underline; }
    .glossary dt { font-weight: 600; margin-top: 12px; color: var(--text-title); }
    .glossary dd { margin: 2px 0 0; color: #4b5563; font-size: 14px; }
    .faq-item { padding: 12px 0; border-bottom: 1px solid #eef1f6; }
    .faq-item:last-child { border-bottom: none; }
    .faq-item h6 { font-weight: 600; margin-bottom: 4px; }
    .faq-item p { margin-bottom: 6px; color: #4b5563; font-size: 14px; }
    .empty { color: #6c757d; }
  `,
})
export class HelpCenterComponent implements OnInit {
  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly groups = GROUPS;
  readonly search = new FormControl('', { nonNullable: true });
  private readonly term = signal('');
  readonly view = signal<View>({ kind: 'article', id: HELP_ARTICLES[0].id });

  /** Artigos que batem com a busca (título, resumo ou conteúdo). */
  readonly articles = computed(() => {
    const term = normalize(this.term().trim());
    if (!term) {
      return HELP_ARTICLES;
    }
    return HELP_ARTICLES.filter((article) =>
      normalize(
        [article.title, article.summary, ...article.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? [])])].join(' '),
      ).includes(term),
    );
  });
  readonly glossary = computed(() => {
    const term = normalize(this.term().trim());
    return term ? GLOSSARY.filter((e) => normalize(`${e.term} ${e.definition}`).includes(term)) : GLOSSARY;
  });
  readonly faq = computed(() => {
    const term = normalize(this.term().trim());
    return term ? FAQ.filter((e) => normalize(`${e.question} ${e.answer}`).includes(term)) : FAQ;
  });
  readonly current = computed(() => {
    const view = this.view();
    if (view.kind !== 'article') {
      return undefined;
    }
    const found = this.articles().find((article) => article.id === view.id);
    return found ?? this.articles()[0];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id === 'glossario') {
        this.view.set({ kind: 'glossary' });
      } else if (id === 'perguntas') {
        this.view.set({ kind: 'faq' });
      } else {
        this.view.set({ kind: 'article', id: findArticle(id)?.id ?? HELP_ARTICLES[0].id });
      }
    });
    this.search.valueChanges.subscribe((value) => this.term.set(value ?? ''));
  }

  articlesOf(group: HelpArticle['group']): HelpArticle[] {
    return this.articles().filter((article) => article.group === group);
  }

  isArticle(id: string): boolean {
    return this.view().kind === 'article' && this.current()?.id === id;
  }

  openArticle(id: string): void {
    this.go(id);
  }

  go(id: string): void {
    this.router.navigate(['/ajuda', id]);
  }

  titleOf(id: string): string {
    return findArticle(id)?.title ?? '';
  }
}
