import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { Button } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { CompanyDTO } from '../../../core/models/company.model';
import { UserCompanyDTO } from '../../../core/models/user-company.model';
import { UserDTO } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { UserCompanyService } from '../../../core/services/user-company.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-link-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputComponent, Button],
  templateUrl: './link-form.component.html',
  styles: `.form-container { max-width: 900px; }`,
})
export class LinkFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
  private readonly userService = inject(UserService);
  private readonly userCompanyService = inject(UserCompanyService);

  @Input() userId = '';
  @Input() existingCompanyIds: string[] = [];
  @Output() saved = new EventEmitter<UserCompanyDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly isAdmin = this.authService.isAdmin;

  readonly form = this.fb.group({
    user: this.fb.control<UserDTO | null>(null, this.isAdmin ? Validators.required : []),
    company: this.fb.control<CompanyDTO | null>(null, Validators.required),
    role: this.fb.nonNullable.control('', Validators.required),
  });

  readonly searchCompanies = (term: string): Observable<CompanyDTO[]> =>
    this.companyService
      .getAll({ page: 0, size: 10 }, { name: term })
      .pipe(map((page) => page.content.filter((c) => !this.existingCompanyIds.includes(c.id!))));

  readonly searchUsers = (term: string): Observable<UserDTO[]> =>
    this.userService.getAll({ page: 0, size: 10 }, { name: term }).pipe(map((page) => page.content));

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const { user, company, role } = this.form.getRawValue();
    const userId = this.isAdmin ? user!.id! : this.userId;
    const link: UserCompanyDTO = { userId, companyId: company!.id!, role };

    this.userCompanyService.create(userId, link).subscribe({
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
