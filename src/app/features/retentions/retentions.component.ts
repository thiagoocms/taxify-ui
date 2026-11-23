import { HelpTipComponent } from '../../shared/help/help-tip.component';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ToastrService } from 'ngx-toastr';
import { map, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CompanyDTO } from '../../core/models/company.model';
import {
  NATURE_HINTS,
  NATURE_LABELS,
  RetentionNature,
  RetentionRowDTO,
  RetentionScreenDTO,
  TAX_LABELS,
} from '../../core/models/retention.model';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { RetentionQuery, RetentionService } from '../../core/services/retention.service';
import { InputComponent } from '../../shared/components/input/input';
import { Page, PageButton } from '../../shared/components/page/page';
import { Table, TableColumn, TableConfig } from '../../shared/components/table/table';
import { formatDocument } from '../../shared/utils/document-mask';
import { downloadBlob } from '../../shared/utils/download-blob';
import { formatCurrency } from '../../shared/utils/format';
import { monthLabel, previousMonth, shiftMonth } from '../assessment/assessment-format';

type QuickFilter = 'UNDUE' | 'PENDING';

/**
 * Retenções da competência (roadmap M1): o que os clientes têm a recolher (reteram como tomador)
 * e a compensar (sofreram como prestador), com a ação, o vencimento e a conferência por linha.
 * Mesmo desenho da Apuração: navegação de mês, resumo, atalhos e tabela.
 */
@Component({
  selector: 'app-retentions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent, InputComponent, Page, Table, HelpTipComponent],
  templateUrl: './retentions.component.html',
  styleUrl: './retentions.component.scss',
})
export class RetentionsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly retentionService = inject(RetentionService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly companyCell = viewChild.required<TemplateRef<unknown>>('companyCell');
  private readonly noteCell = viewChild.required<TemplateRef<unknown>>('noteCell');
  private readonly natureCell = viewChild.required<TemplateRef<unknown>>('natureCell');
  private readonly counterpartCell = viewChild.required<TemplateRef<unknown>>('counterpartCell');
  private readonly taxCell = viewChild.required<TemplateRef<unknown>>('taxCell');
  private readonly dueCell = viewChild.required<TemplateRef<unknown>>('dueCell');
  private readonly actionCell = viewChild.required<TemplateRef<unknown>>('actionCell');

  readonly canReview = this.auth.can('INVOICES_AUDIT');
  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null),
    search: this.fb.nonNullable.control(''),
  });
  readonly month = signal(previousMonth());
  readonly screen = signal<RetentionScreenDTO | null>(null);
  readonly nature = signal<RetentionNature | null>(null);
  readonly quick = signal<QuickFilter | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly selected = signal<RetentionRowDTO[]>([]);
  /** Recria a tabela ao recarregar - ela guarda a seleção por objeto e não a limpa sozinha. */
  readonly tableKey = signal(0);
  private companyId: string | undefined;

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDocument = formatDocument;
  protected readonly monthLabel = monthLabel;

  /** Linhas da natureza escolhida (o servidor filtra) e do atalho (filtrado aqui). */
  readonly rows = computed(() => {
    const rows = this.screen()?.rows ?? [];
    switch (this.quick()) {
      case 'UNDUE':
        return rows.filter((row) => row.undue);
      case 'PENDING':
        return rows.filter((row) => !row.reviewed && row.nature !== 'INFORMATIVO');
      default:
        return rows;
    }
  });
  readonly undueCount = computed(() => (this.screen()?.rows ?? []).filter((row) => row.undue).length);
  readonly pendingCount = computed(
    () => (this.screen()?.rows ?? []).filter((row) => !row.reviewed && row.nature !== 'INFORMATIVO').length,
  );

  readonly columns = computed<TableColumn[]>(() => [
    { name: 'Empresa', cellTemplate: this.companyCell(), width: '200px' },
    { name: 'Nota', cellTemplate: this.noteCell(), width: '120px' },
    { name: 'Natureza', cellTemplate: this.natureCell(), width: '120px' },
    { name: 'Contraparte', cellTemplate: this.counterpartCell() },
    { name: 'Retido', cellTemplate: this.taxCell(), headerClass: 'justify-content-end', width: '170px' },
    { name: 'Vencimento', cellTemplate: this.dueCell(), width: '110px' },
    { name: 'Ação', cellTemplate: this.actionCell() },
  ]);

  readonly tableConfig = computed<TableConfig>(() => ({ headerVisible: true, selectable: this.canReview, actions: [] }));

  readonly pageButtons = computed<PageButton[]>(() => {
    const noSelection = !this.selected().length;
    return [
      { id: 'retentions-review', label: 'Marcar como conferidas', icon: 'check', isShow: this.canReview,
        isDisabled: noSelection, handler: () => this.review(true) },
      { id: 'retentions-unreview', label: 'Desfazer conferência', variant: 'text', isShow: this.canReview,
        isDisabled: noSelection, handler: () => this.review(false) },
      { id: 'retentions-csv', label: 'Exportar CSV', icon: 'download', variant: 'outlined',
        isDisabled: !this.screen()?.rows.length || this.exporting(), handler: () => this.exportCsv() },
    ];
  });

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService.getAll({ page: 0, size: 10 }, { search: term }).pipe(map((page) => page.content));

  readonly companyLabel = (company: CompanyDTO): string =>
    company.documentNumber ? `${company.name} - ${formatDocument(company.documentNumber)}` : company.name;

  ngOnInit(): void {
    this.form.controls.company.valueChanges.subscribe((company) => {
      const id = company && typeof company === 'object' && company.id ? company.id : undefined;
      if (id !== this.companyId && (id || !company)) {
        this.companyId = id;
        this.load();
      }
    });
    this.form.controls.search.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load());
    this.load();
  }

  shift(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.load();
  }

  private query(): RetentionQuery {
    return {
      companyId: this.companyId,
      competencia: this.month(),
      natureza: this.nature() ?? undefined,
      busca: this.form.controls.search.value.trim() || undefined,
    };
  }

  private load(): void {
    this.loading.set(true);
    this.resetSelection();
    this.retentionService.screen(this.query()).subscribe({
      next: (screen) => {
        this.screen.set(screen);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private resetSelection(): void {
    this.selected.set([]);
    this.tableKey.update((key) => key + 1);
  }

  toggleNature(nature: RetentionNature): void {
    this.nature.set(this.nature() === nature ? null : nature);
    this.load();
  }

  toggleQuick(filter: QuickFilter): void {
    this.quick.set(this.quick() === filter ? null : filter);
    this.resetSelection();
  }

  review(reviewed: boolean): void {
    this.retentionService.review(this.selected().map((row) => row.key), reviewed, this.companyId).subscribe((count) => {
      this.toastr.success(reviewed ? `${count} retenção(ões) conferida(s).` : `Conferência desfeita em ${count}.`);
      this.load();
    });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.retentionService.csv(this.query()).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(blob, `retencoes-${this.month()}.csv`);
      },
      error: () => this.exporting.set(false),
    });
  }

  openNote(row: RetentionRowDTO): void {
    if (row.documentType === 'NFE') {
      this.router.navigate(['/notas-fiscais', row.documentId]);
    } else {
      this.router.navigate(['/notas-servico']);
    }
  }

  /** Notas de uma natureza no mês (os atalhos mostram a contagem mesmo com outra natureza filtrada). */
  countOf(nature: RetentionNature): number {
    return this.screen()?.cards.find((item) => item.nature === nature)?.notes ?? 0;
  }

  taxSummary(byTax: Record<string, number>): string {
    return Object.entries(byTax)
      .map(([tax, value]) => `${TAX_LABELS[tax] ?? tax} ${formatCurrency(value)}`)
      .join(' · ');
  }

  natureLabel(nature: RetentionNature): string {
    return NATURE_LABELS[nature] ?? nature;
  }

  hint(nature: RetentionNature): string {
    return NATURE_HINTS[nature] ?? '';
  }

  taxLabel(tax: string): string {
    return TAX_LABELS[tax] ?? tax;
  }

  natureBadge(nature: RetentionNature): string {
    return nature === 'A_RECOLHER' ? 'danger' : nature === 'A_COMPENSAR' ? 'ok' : '';
  }

  quickClass(nature: RetentionNature): string {
    return nature === 'A_RECOLHER' ? 'danger' : nature === 'A_COMPENSAR' ? 'ok' : '';
  }
}
