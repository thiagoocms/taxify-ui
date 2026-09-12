import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { UserDTO } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { UserLinksComponent } from '../user-links/user-links.component';

const EMPLOYEE_PROFILE = 'EMPLOYEE';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, Button, UserLinksComponent],
  templateUrl: './user-form.component.html',
  styles: `
    .form-container { max-width: 900px; }
  `,
})
export class UserFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);

  @Input() user: UserDTO | null = null;
  @Output() saved = new EventEmitter<UserDTO>();
  @Output() cancelled = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly hidePassword = signal(true);
  readonly eyeIcon = computed(() => (this.hidePassword() ? faEye : faEyeSlash));

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CPF', label: 'CPF' },
    { value: 'CNPJ', label: 'CNPJ' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    documentType: ['CPF', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    login: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.form.reset({
        name: this.user?.name ?? '',
        documentType: this.user?.documentType ?? 'CPF',
        documentNumber: this.user?.documentNumber ?? '',
        login: this.user?.login ?? '',
        email: this.user?.email ?? '',
        password: '',
      });

      const passwordControl = this.form.get('password');
      passwordControl?.setValidators(this.isEdit ? [] : [Validators.required, Validators.minLength(6)]);
      passwordControl?.updateValueAndValidity();
    }
  }

  get isEdit(): boolean {
    return !!this.user?.id;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { password, ...rest } = this.form.getRawValue();

    // Usuários criados aqui pelo admin são sempre EMPLOYEE; o perfil ADMIN só
    // é atribuído no cadastro público (dono da conta) — ver AuthComponent.
    const value: UserDTO = {
      ...rest,
      profile: this.user?.profile ?? EMPLOYEE_PROFILE,
      ...(password ? { password } : {}),
    };

    const request$ = this.isEdit
      ? this.userService.update(this.user!.id!, { ...this.user, ...value })
      : this.userService.create(value);

    request$.subscribe({
      next: (user) => {
        this.loading.set(false);
        this.saved.emit(user);
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
