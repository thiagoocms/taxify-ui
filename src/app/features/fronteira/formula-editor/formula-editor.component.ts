import { Component, computed, ElementRef, input, model, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
import { FORMULA_EXAMPLES, FORMULA_FIELDS, FORMULA_FUNCTIONS, FORMULA_OPERATORS, FormulaField } from '../../../core/models/fronteira.model';
import { formatCurrency } from '../../../shared/utils/format';

/** O que o editor sabe de um nome: campo da nota ou função. */
interface Suggestion {
  name: string;
  label: string;
  hint: string;
  value: string | null;
  fn: boolean;
}

/** Um pedaço da fórmula para a leitura em linguagem natural. */
interface PreviewToken {
  kind: 'field' | 'fn' | 'unknown' | 'text';
  text: string;
}

export interface FormulaIssue {
  text: string;
  /** "Trocar por frete": o nome errado e o certo. */
  fix?: { from: string; to: string };
}

const FUNCTION_NAMES = FORMULA_FUNCTIONS.map((fn) => fn.token.split('(')[0]);
const IDENTIFIER = /[A-Za-zÀ-ÿ_][\wÀ-ÿ]*/g;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** O campo mais parecido com um nome que não existe ("fretee" → frete, "icms" → icms_origem). */
function closest(word: string, names: string[]): string | null {
  const w = normalize(word);
  const byStart = names.find((name) => name.startsWith(w) || w.startsWith(name));
  if (byStart) {
    return byStart;
  }
  const byLabel = names.find((name) => normalize(FORMULA_FIELDS[name]?.label ?? '').includes(w));
  if (byLabel) {
    return byLabel;
  }
  const ranked = names.map((name) => ({ name, d: distance(w, name) })).sort((a, b) => a.d - b.d)[0];
  return ranked && ranked.d <= 3 ? ranked.name : null;
}

/** Os problemas que dá para ver sem o servidor: nome que não existe, função desconhecida, parênteses. */
export function formulaIssues(formula: string | null | undefined, variables: string[]): FormulaIssue[] {
  const text = formula ?? '';
  if (!text.trim()) {
    return [{ text: 'Escreva a fórmula ou comece de um exemplo.' }];
  }
  const issues: FormulaIssue[] = [];
  for (const match of text.matchAll(IDENTIFIER)) {
    const word = match[0];
    const isCall = /^\s*\(/.test(text.slice((match.index ?? 0) + word.length));
    if (isCall ? FUNCTION_NAMES.includes(word.toLowerCase()) : variables.includes(word)) {
      continue;
    }
    if (isCall) {
      issues.push({ text: `A função "${word}" não existe. Use ${FUNCTION_NAMES.join(', ')}.` });
      continue;
    }
    const suggestion = closest(word, variables);
    issues.push(suggestion
      ? { text: `"${word}" não é um campo da nota. Você quis dizer ${suggestion}?`, fix: { from: word, to: suggestion } }
      : { text: `"${word}" não é um campo da nota. Escolha um dos campos abaixo.` });
  }
  let depth = 0;
  for (const char of text) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (depth < 0) {
      break;
    }
  }
  if (depth !== 0) {
    issues.push({ text: depth > 0 ? 'Falta fechar um parêntese ")".' : 'Há um ")" sem o "(" correspondente.' });
  }
  return issues;
}

@Component({
  selector: 'app-formula-editor',
  standalone: true,
  templateUrl: './formula-editor.component.html',
  styleUrl: './formula-editor.component.scss',
})
export class FormulaEditorComponent implements OnInit, OnDestroy {
  readonly formula = model<string | null | undefined>('');
  /** nome → descrição, do servidor. */
  readonly variables = input<Record<string, string>>({});
  /** Os valores do item (ou de exemplo), para mostrar ao lado de cada campo. */
  readonly values = input<Record<string, number> | null | undefined>(null);
  /** O resultado do último teste no servidor. */
  readonly result = input<{ ok: boolean; text: string } | null>(null);
  readonly contextLabel = input<string | null | undefined>(null);
  /** Pede ao pai um teste no servidor - sozinho, pouco depois de parar de digitar. */
  readonly test = output<void>();

  readonly operators = FORMULA_OPERATORS;
  readonly functions = FORMULA_FUNCTIONS;
  readonly examples = FORMULA_EXAMPLES;

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private testTimer?: ReturnType<typeof setTimeout>;

  readonly suggestions = signal<Suggestion[]>([]);
  readonly active = signal(0);
  private word = { start: 0, end: 0 };

  readonly names = computed(() => Object.keys(this.variables()));
  readonly fields = computed(() => this.names().map((name) => this.describe(name)));
  readonly money = computed(() => this.fields().filter((field) => !field.rate));
  readonly rates = computed(() => this.fields().filter((field) => field.rate));
  readonly issues = computed(() => this.names().length ? formulaIssues(this.formula(), this.names()) : []);
  readonly preview = computed<PreviewToken[]>(() => this.tokens(this.formula() ?? ''));

  /** Uma regra aberta para editar (ou vinda de um item) já mostra o resultado. */
  ngOnInit(): void {
    if (this.formula()) {
      this.scheduleTest(0);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.testTimer);
  }

  describe(name: string): FormulaField & { name: string; hint: string; value: string | null } {
    const meta = FORMULA_FIELDS[name];
    return {
      name,
      label: meta?.label ?? name,
      rate: meta?.rate ?? false,
      hint: this.variables()[name] ?? meta?.hint ?? meta?.label ?? '',
      value: this.format(name, this.values()?.[name]),
    };
  }

  format(name: string, value: number | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    return FORMULA_FIELDS[name]?.rate
      ? `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`
      : formatCurrency(value);
  }

  onInput(text: string): void {
    this.formula.set(text);
    this.refreshSuggestions();
    this.scheduleTest();
  }

  /** Setas escolhem, Enter/Tab aceitam, Esc fecha - só enquanto a lista está aberta. */
  onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();
    if (!list.length) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + list.length) % list.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.accept(list[this.active()]);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.suggestions.set([]);
    }
  }

  /** A palavra que termina no cursor vira busca por nome ou por rótulo ("fre" → frete, "crédito" → credito...). */
  refreshSuggestions(): void {
    const box = this.textarea()?.nativeElement;
    const text = this.formula() ?? '';
    const caret = box?.selectionStart ?? text.length;
    const typed = /[A-Za-zÀ-ÿ_][\wÀ-ÿ]*$/.exec(text.slice(0, caret))?.[0] ?? '';
    const tail = /^[\wÀ-ÿ]*/.exec(text.slice(caret))?.[0] ?? '';
    if (!typed) {
      this.suggestions.set([]);
      return;
    }
    this.word = { start: caret - typed.length, end: caret + tail.length };
    const query = normalize(typed);
    const fields: Suggestion[] = this.fields()
      .filter((field) => field.name.startsWith(query) || normalize(field.label).split(/\s+/).some((part) => part.startsWith(query))
        || normalize(field.label).includes(query))
      .map((field) => ({ name: field.name, label: field.label, hint: field.hint, value: field.value, fn: false }));
    const functions: Suggestion[] = this.functions
      .filter((fn) => fn.token.startsWith(query))
      .map((fn) => ({ name: fn.token.split('(')[0], label: fn.token, hint: fn.label, value: null, fn: true }));
    const list = [...fields, ...functions].sort((a, b) => Number(!a.name.startsWith(query)) - Number(!b.name.startsWith(query)));
    const exact = list.length === 1 && list[0].name === typed + tail;
    this.suggestions.set(exact ? [] : list.slice(0, 8));
    this.active.set(0);
  }

  accept(suggestion: Suggestion): void {
    const text = this.formula() ?? '';
    const piece = suggestion.fn ? `${suggestion.name}()` : suggestion.name;
    const caret = this.word.start + (suggestion.fn ? piece.length - 1 : piece.length);
    this.formula.set(text.slice(0, this.word.start) + piece + text.slice(this.word.end));
    this.suggestions.set([]);
    this.focus(caret);
    this.scheduleTest();
  }

  /** Insere no cursor; funções e "()" deixam o cursor dentro dos parênteses. */
  insert(text: string): void {
    const box = this.textarea()?.nativeElement;
    const current = this.formula() ?? '';
    const start = box?.selectionStart ?? current.length;
    const end = box?.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const piece = (/^[a-z_]/i.test(text) && /[\w)%]$/.test(before) ? ' ' : '') + text;
    this.formula.set(before + piece + current.slice(end));
    const open = piece.indexOf('(');
    this.suggestions.set([]);
    this.focus(before.length + (open >= 0 && piece.endsWith(')') ? open + 1 : piece.length));
    this.scheduleTest();
  }

  useExample(formula: string): void {
    if (!formula) {
      return;
    }
    this.formula.set(formula);
    this.suggestions.set([]);
    this.scheduleTest(0);
  }

  /** "Trocar por frete": troca o nome errado onde ele aparece sozinho. */
  fix(issue: FormulaIssue): void {
    if (!issue.fix) {
      return;
    }
    const pattern = new RegExp(`(?<![\\wÀ-ÿ])${issue.fix.from}(?![\\wÀ-ÿ])`, 'g');
    this.formula.set((this.formula() ?? '').replace(pattern, issue.fix.to));
    this.scheduleTest(0);
  }

  closeSuggestionsSoon(): void {
    // depois do clique numa sugestão (mousedown) - o blur vem antes
    setTimeout(() => this.suggestions.set([]), 150);
  }

  private scheduleTest(delay = 600): void {
    clearTimeout(this.testTimer);
    this.testTimer = setTimeout(() => {
      if (!this.issues().length) {
        this.test.emit();
      }
    }, delay);
  }

  private focus(caret: number): void {
    setTimeout(() => {
      const box = this.textarea()?.nativeElement;
      box?.focus();
      box?.setSelectionRange(caret, caret);
    });
  }

  private tokens(text: string): PreviewToken[] {
    const out: PreviewToken[] = [];
    let last = 0;
    for (const match of text.matchAll(IDENTIFIER)) {
      const index = match.index ?? 0;
      if (index > last) {
        out.push({ kind: 'text', text: this.symbols(text.slice(last, index)) });
      }
      const word = match[0];
      const isCall = /^\s*\(/.test(text.slice(index + word.length));
      if (isCall) {
        out.push({ kind: FUNCTION_NAMES.includes(word.toLowerCase()) ? 'fn' : 'unknown', text: word });
      } else if (this.names().includes(word)) {
        out.push({ kind: 'field', text: FORMULA_FIELDS[word]?.label ?? word });
      } else {
        out.push({ kind: 'unknown', text: word });
      }
      last = index + word.length;
    }
    if (last < text.length) {
      out.push({ kind: 'text', text: this.symbols(text.slice(last)) });
    }
    return out;
  }

  private symbols(text: string): string {
    return text.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  }
}
