import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { Button } from '../../../../shared/components/button/button';
import { InputComponent } from '../../../../shared/components/input/input';
import { CompanyDTO } from '../../../../core/models/company.model';
import { UserCompanyDTO } from '../../../../core/models/user-company.model';
import { CompanyService } from '../../../../core/services/company.service';
import { UserCompanyService } from '../../../../core/services/user-company.service';

@Component({
  selector: 'app-user-link-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button],
  templateUrl: './link-form.component.html',
})
export class UserLinkFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly userCompanyService = inject(UserCompanyService);

  @Input() userId = '';
  @Input() existingCompanyIds: string[] = [];
  @Output() saved = new EventEmitter<UserCompanyDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);

  readonly form = this.fb.group({
    company: this.fb.control<CompanyDTO | null>(null, Validators.required),
    role: this.fb.nonNullable.control('', Validators.required),
  });

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService
      .getAll({ page: 0, size: 10 }, { name: term })
      .pipe(map((page) => page.content.filter((c) => !this.existingCompanyIds.includes(c.id!))));

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { company, role } = this.form.getRawValue();
    const link: UserCompanyDTO = { userId: this.userId, companyId: company!.id!, role };

    this.userCompanyService.create(this.userId, link).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.saved.emit(result);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
