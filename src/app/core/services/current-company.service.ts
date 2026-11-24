import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { CompanyDTO } from '../models/company.model';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'taxify_current_company';

/**
 * A última empresa escolhida: as telas que precisam de uma empresa (Notas, Manifestação, Notas de serviço,
 * Relatórios, Fronteira) já abrem com ela no filtro, sem buscar de novo a cada menu. Só preenche o campo
 * vazio - não filtra nada sozinho; as telas da carteira (Pendências, Retenções, Auditoria) não usam.
 * Fica na aba (sessionStorage): recarregar mantém, sair do sistema limpa.
 */
@Injectable({ providedIn: 'root' })
export class CurrentCompanyService {
  private readonly auth = inject(AuthService);
  private readonly companySignal = signal<CompanyDTO | null>(this.restore());

  readonly company = this.companySignal.asReadonly();

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.remember(null);
      }
    });
  }

  remember(company: CompanyDTO | null): void {
    const next = company?.id ? company : null;
    if (next?.id === this.companySignal()?.id) {
      return;
    }
    this.companySignal.set(next);
    try {
      if (next) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Sem storage (aba privada, bloqueado): vale só enquanto a página estiver aberta.
    }
  }

  /**
   * Liga o campo "Empresa" da tela à última empresa. Chame depois de assinar o valueChanges da própria
   * tela, para que preencher o campo já dispare a busca.
   * - campo vazio ao abrir: preenche com a última empresa (se `accept` aceitar);
   * - escolher uma empresa no campo: passa a ser a última. Limpar o campo não esquece - só não preenche.
   */
  bind(
    control: FormControl<CompanyDTO | null>,
    destroyRef: DestroyRef,
    accept: (company: CompanyDTO) => boolean = () => true,
  ): void {
    const current = control.value;
    const last = this.companySignal();
    if (current && typeof current === 'object' && current.id) {
      if (accept(current)) {
        this.remember(current);
      }
    } else if (last && accept(last)) {
      control.setValue(last);
    }

    control.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
      // Texto sendo digitado (string) ou campo limpo: ainda não escolheu, não mexe.
      if (value && typeof value === 'object' && value.id && accept(value)) {
        this.remember(value);
      }
    });
  }

  private restore(): CompanyDTO | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CompanyDTO) : null;
    } catch {
      return null;
    }
  }
}
