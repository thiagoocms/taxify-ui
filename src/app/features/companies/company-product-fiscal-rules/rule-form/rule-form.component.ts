import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../../shared/components/input/input';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CompanyProductDTO,
  ProductFiscalRuleDTO,
  ProductRuleSuggestionDTO,
  SuggestedValue,
} from '../../../../core/models/product-fiscal-rule.model';
import { ProductFiscalRuleService } from '../../../../core/services/product-fiscal-rule.service';
import { toNumber } from '../../../../shared/utils/to-number';

/** Campos da classificação tributária (opcionais) - mesmos nomes da API. */
const TAX_FIELDS = [
  'origemMercadoria', 'cstIcms', 'csosn', 'aliquotaIcms', 'cest',
  'cstIpi', 'aliquotaIpi', 'cstPis', 'aliquotaPis', 'cstCofins', 'aliquotaCofins',
  'cstIbsCbs', 'classificacaoTributaria',
] as const;
type TaxField = (typeof TAX_FIELDS)[number];
const RATE_FIELDS: TaxField[] = ['aliquotaIcms', 'aliquotaIpi', 'aliquotaPis', 'aliquotaCofins'];

const FIELD_LABELS: Record<string, string> = {
  ncmCorreto: 'NCM',
  cfopCorreto: 'CFOP',
  origemMercadoria: 'Origem',
  cstIcms: 'CST ICMS',
  csosn: 'CSOSN',
  aliquotaIcms: 'Alíq. ICMS interna',
  cest: 'CEST',
  cstIpi: 'CST IPI',
  aliquotaIpi: 'Alíq. IPI',
  cstPis: 'CST PIS',
  aliquotaPis: 'Alíq. PIS',
  cstCofins: 'CST COFINS',
  aliquotaCofins: 'Alíq. COFINS',
  cstIbsCbs: 'CST IBS/CBS',
  classificacaoTributaria: 'cClassTrib',
};

@Component({
  selector: 'app-rule-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button],
  templateUrl: './rule-form.component.html',
  styles: `
    .product-hint { font-size: 0.85rem; opacity: 0.75; margin: -0.25rem 0 0.75rem; }
    .tax-toggle { background: none; border: 0; padding: 0; color: var(--bs-primary); font-size: 0.9rem; margin: 0.25rem 0 0.75rem; }
    .tax-section { border-top: 1px solid #e5e7eb; padding-top: 0.75rem; margin-bottom: 0.5rem; }
    .tax-help { font-size: 0.8rem; opacity: 0.75; margin: 0 0 0.75rem; }
    .suggestion-box { font-size: 0.8rem; background: #f6f8fb; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; }
    .suggestion-box .low { color: #b45309; }
  `,
})
export class RuleFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly productFiscalRuleService = inject(ProductFiscalRuleService);

  @Input() companyId = '';
  /** Regra a editar; sem id = nova regra (pode vir pré-preenchida por uma sugestão). */
  @Input() rule: ProductFiscalRuleDTO | null = null;
  /** Sugestão que pré-preencheu a regra, para mostrar o quanto as notas concordam. */
  @Input() suggestion: ProductRuleSuggestionDTO | null = null;
  @Output() saved = new EventEmitter<ProductFiscalRuleDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly suggesting = signal(false);
  readonly showTax = signal(false);
  /** Produto escolhido na busca (para mostrar NCM/CFOP vistos nas notas). */
  readonly selectedProduct = signal<CompanyProductDTO | null>(null);
  /** Sugestão aplicada: campo → valor e % de concordância das notas. */
  readonly appliedSuggestion = signal<{ label: string; value: SuggestedValue }[]>([]);

  readonly originOptions: SelectOption[] = [
    { value: '', label: 'Não conferir' },
    { value: '0', label: '0 - Nacional' },
    { value: '1', label: '1 - Estrangeira, importação direta' },
    { value: '2', label: '2 - Estrangeira, adquirida no mercado interno' },
    { value: '3', label: '3 - Nacional, conteúdo de importação > 40%' },
    { value: '4', label: '4 - Nacional, processos produtivos básicos' },
    { value: '5', label: '5 - Nacional, conteúdo de importação ≤ 40%' },
    { value: '6', label: '6 - Estrangeira, importação direta sem similar (CAMEX)' },
    { value: '7', label: '7 - Estrangeira, mercado interno sem similar (CAMEX)' },
    { value: '8', label: '8 - Nacional, conteúdo de importação > 70%' },
  ];

  /**
   * Busca os produtos nas notas da empresa. Os que já têm regra ficam de fora na criação
   * (a regra é única por código); na edição o próprio código continua aparecendo.
   */
  readonly searchProducts = (term: string): Observable<CompanyProductDTO[]> =>
    this.productFiscalRuleService
      .produtos(this.companyId, term)
      .pipe(
        map((products) =>
          products.filter((product) => !product.possuiRegra || product.codigo === this.rule?.codigoProduto),
        ),
      );

  readonly form = this.fb.nonNullable.group({
    codigoProduto: ['', [Validators.required]],
    descricaoProduto: [''],
    ncmCorreto: [''],
    cfopCorreto: ['', [Validators.required]],
    observacoes: [''],
    origemMercadoria: [''],
    cstIcms: ['', [Validators.pattern(/^\d{2}$/)]],
    csosn: ['', [Validators.pattern(/^\d{3}$/)]],
    aliquotaIcms: [''],
    cest: ['', [Validators.pattern(/^\d{7}$/)]],
    cstIpi: ['', [Validators.pattern(/^\d{2}$/)]],
    aliquotaIpi: [''],
    cstPis: ['', [Validators.pattern(/^\d{2}$/)]],
    aliquotaPis: [''],
    cstCofins: ['', [Validators.pattern(/^\d{2}$/)]],
    aliquotaCofins: [''],
    cstIbsCbs: ['', [Validators.pattern(/^\d{3}$/)]],
    classificacaoTributaria: ['', [Validators.pattern(/^\d{6}$/)]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rule'] || changes['suggestion']) {
      this.selectedProduct.set(null);
      const rule = this.rule;
      const tax: Record<string, string> = {};
      for (const field of TAX_FIELDS) {
        const value = rule?.[field];
        tax[field] = value === null || value === undefined ? '' : String(value);
      }
      this.form.reset({
        codigoProduto: rule?.codigoProduto ?? '',
        descricaoProduto: rule?.descricaoProduto ?? '',
        ncmCorreto: rule?.ncmCorreto ?? '',
        cfopCorreto: rule?.cfopCorreto ?? '',
        observacoes: rule?.observacoes ?? '',
        ...tax,
      });
      this.showTax.set(TAX_FIELDS.some((field) => !!tax[field]));
      this.appliedSuggestion.set(this.suggestion ? this.describe(this.suggestion) : []);
    }
  }

  /** Ao escolher um produto: preenche código e descrição, e sugere o NCM das notas se ainda vazio. */
  onProductSelected(product: CompanyProductDTO): void {
    this.selectedProduct.set(product);
    this.form.patchValue({
      codigoProduto: product.codigo,
      descricaoProduto: product.descricao ?? '',
      ncmCorreto: this.form.controls.ncmCorreto.value || product.ncm || '',
    });
  }

  /** Preenche os campos ainda vazios com o valor mais frequente nas notas do produto. */
  fillFromNotes(): void {
    const codigo = this.currentCode();
    if (!codigo) {
      return;
    }
    this.suggesting.set(true);
    this.productFiscalRuleService.sugestoes(this.companyId, false).subscribe({
      next: (suggestions) => {
        this.suggesting.set(false);
        const suggestion = suggestions.find((s) => s.codigoProduto === codigo);
        if (!suggestion) {
          this.appliedSuggestion.set([]);
          return;
        }
        const patch: Record<string, string> = {};
        for (const [field, value] of Object.entries(suggestion.campos)) {
          const control = this.form.get(field);
          if (control && value && !control.value) {
            patch[field] = value.valor;
          }
        }
        this.form.patchValue(patch);
        this.showTax.set(true);
        this.appliedSuggestion.set(this.describe(suggestion));
      },
      error: () => this.suggesting.set(false),
    });
  }

  toggleTax(): void {
    this.showTax.update((value) => !value);
  }

  get isEdit(): boolean {
    return !!this.rule?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showTax.set(true);
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();
    const value: ProductFiscalRuleDTO = {
      ...raw,
      codigoProduto: this.currentCode(),
      companyId: this.companyId,
      origemMercadoria: null,
      cstIcms: null,
      csosn: null,
      aliquotaIcms: null,
      cest: null,
      cstIpi: null,
      aliquotaIpi: null,
      cstPis: null,
      aliquotaPis: null,
      cstCofins: null,
      aliquotaCofins: null,
      cstIbsCbs: null,
      classificacaoTributaria: null,
    };
    const target = value as unknown as Record<TaxField, string | number | null>;
    for (const field of TAX_FIELDS) {
      const text = String(raw[field] ?? '').trim();
      target[field] = RATE_FIELDS.includes(field) ? toNumber(text) : text || null;
    }

    const request$ = this.isEdit
      ? this.productFiscalRuleService.update(this.rule!.id!, { ...this.rule, ...value })
      : this.productFiscalRuleService.create(value);

    request$.subscribe({
      next: (rule) => {
        this.loading.set(false);
        this.saved.emit(rule);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  /** O autocomplete guarda o objeto do produto escolhido; a API espera só o código. */
  private currentCode(): string {
    const codigo: unknown = this.form.controls.codigoProduto.value;
    return typeof codigo === 'string' ? codigo : ((codigo as CompanyProductDTO | null)?.codigo ?? '');
  }

  private describe(suggestion: ProductRuleSuggestionDTO): { label: string; value: SuggestedValue }[] {
    return Object.entries(suggestion.campos)
      .filter((entry): entry is [string, SuggestedValue] => !!entry[1])
      .map(([field, value]) => ({ label: FIELD_LABELS[field] ?? field, value }));
  }
}
