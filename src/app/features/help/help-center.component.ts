import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputComponent } from '../../shared/components/input/input';
import { Page } from '../../shared/components/page/page';
import { HelpArticleComponent } from '../../shared/help/help-article.component';
import {
  FAQ, findArticle, findTutorial, GLOSSARY, HELP_ARTICLES, HELP_TUTORIALS, HelpArticle, HelpTutorial,
} from '../../shared/help/help-content';

type View = { kind: 'article'; id: string } | { kind: 'tutorial'; id: string } | { kind: 'glossary' } | { kind: 'faq' };

const GROUPS: HelpArticle['group'][] = ['Notas e documentos', 'Obrigações e controles', 'Configuração'];

/** Remove acentos e caixa: "Ciência" acha "ciencia". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Central de Ajuda: os tutoriais dos fluxos principais, um artigo por tela, o glossário e as perguntas frequentes, com busca. O "?" de cada
 * tela abre o mesmo artigo num painel lateral.
 */
@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputComponent, Page, HelpArticleComponent],
  template: `
    <app-page pageTitle="Ajuda" pageDescription="Tutoriais passo a passo, como cada tela funciona, o glossário fiscal e as perguntas frequentes">
      <div class="search-field">
        <app-input label="Buscar na ajuda (ex.: ciência, retenção, certificado)" [formControl]="search"></app-input>
      </div>

      <div class="help-layout">
        <nav class="help-nav" aria-label="Artigos da ajuda">
          @if (tutorials().length) {
            <div class="nav-group">Tutoriais</div>
            @for (tutorial of tutorials(); track tutorial.id) {
              <button type="button" class="nav-item" [class.active]="isTutorial(tutorial.id)" (click)="go(tutorial.id)">
                {{ tutorial.title }} <span class="count">{{ tutorial.minutes }} min</span>
              </button>
            }
          }
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
            @case ('tutorial') {
              @if (currentTutorial(); as t) {
                <h5>{{ t.title }}</h5>
                <p class="tutorial-summary">{{ t.summary }} <span class="count">· cerca de {{ t.minutes }} min</span></p>
                @if (t.prerequisites.length) {
                  <div class="tutorial-box">
                    <strong>Antes de começar</strong>
                    <ul>
                      @for (item of t.prerequisites; track $index) { <li>{{ item }}</li> }
                    </ul>
                  </div>
                }
                <ol class="tutorial-steps">
                  @for (step of t.steps; track $index) {
                    <li>
                      <span class="step-number">{{ $index + 1 }}</span>
                      <div class="step-body">
                        <h6>{{ step.title }}</h6>
                        <p>{{ step.text }}</p>
                        @if (step.route) {
                          <button type="button" class="link" (click)="router.navigate([step.route])">{{ step.routeLabel || 'Abrir a tela' }} →</button>
                        }
                      </div>
                    </li>
                  }
                </ol>
                @if (t.pitfalls?.length) {
                  <div class="tutorial-box warn">
                    <strong>O que pode dar errado</strong>
                    <ul>
                      @for (item of t.pitfalls; track $index) { <li>{{ item }}</li> }
                    </ul>
                  </div>
                }
                @if (t.related?.length) {
                  <div class="tutorial-related">
                    <span class="count">Para saber mais:</span>
                    @for (id of t.related; track id) {
                      <button type="button" class="link inline" (click)="openArticle(id)">{{ titleOf(id) }}</button>
                    }
                  </div>
                }
              } @else {
                <p class="empty">Nenhum tutorial com "{{ search.value }}".</p>
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
    .link.inline { display: inline; margin-left: 10px; }
    .tutorial-summary { color: #4b5563; margin-bottom: 14px; }
    .tutorial-box { border: 1px solid #e3e8f0; background: #f8fafc; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 14px; }
    .tutorial-box.warn { border-color: #f5d9a8; background: #fffaf0; margin-top: 8px; }
    .tutorial-box ul { margin: 6px 0 0; padding-left: 18px; color: #4b5563; }
    .tutorial-steps { list-style: none; padding: 0; margin: 0 0 8px; }
    .tutorial-steps li { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef1f6; }
    .tutorial-steps li:last-child { border-bottom: none; }
    .step-number { flex: 0 0 28px; height: 28px; border-radius: 50%; background: #e6eefb; color: var(--color-primary);
      font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .step-body { flex: 1; min-width: 0; }
    .step-body h6 { font-weight: 600; margin: 3px 0 4px; }
    .step-body p { margin-bottom: 4px; color: #4b5563; font-size: 14px; }
    .tutorial-related { margin-top: 12px; font-size: 14px; }
  `,
})
export class HelpCenterComponent implements OnInit {
  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly groups = GROUPS;
  readonly search = new FormControl('', { nonNullable: true });
  private readonly term = signal('');
  readonly view = signal<View>({ kind: 'tutorial', id: HELP_TUTORIALS[0].id });

  /** Tutoriais que batem com a busca (título, resumo, passos e cuidados). */
  readonly tutorials = computed(() => {
    const term = normalize(this.term().trim());
    if (!term) {
      return HELP_TUTORIALS;
    }
    return HELP_TUTORIALS.filter((t) =>
      normalize([t.title, t.summary, ...t.prerequisites, ...t.steps.flatMap((s) => [s.title, s.text]), ...(t.pitfalls ?? [])].join(' ')).includes(term),
    );
  });
  readonly currentTutorial = computed<HelpTutorial | undefined>(() => {
    const view = this.view();
    if (view.kind !== 'tutorial') {
      return undefined;
    }
    return this.tutorials().find((t) => t.id === view.id) ?? this.tutorials()[0];
  });

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
      } else if (findTutorial(id)) {
        this.view.set({ kind: 'tutorial', id: id! });
      } else if (findArticle(id)) {
        this.view.set({ kind: 'article', id: id! });
      } else {
        // a Central abre pelos tutoriais: os fluxos de ponta a ponta são o caminho mais curto para quem chega
        this.view.set({ kind: 'tutorial', id: HELP_TUTORIALS[0].id });
      }
    });
    this.search.valueChanges.subscribe((value) => this.term.set(value ?? ''));
  }

  articlesOf(group: HelpArticle['group']): HelpArticle[] {
    return this.articles().filter((article) => article.group === group);
  }

  isTutorial(id: string): boolean {
    return this.view().kind === 'tutorial' && this.currentTutorial()?.id === id;
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
