import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../../shared/components/button/button';
import { InputComponent, SelectOption } from '../../../shared/components/input/input';
import { ACCESS_PROFILE_OPTIONS, AccessProfile } from '../../../core/models/access.model';
import { UserDTO } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';
import { UserLinksComponent } from '../user-links/user-links.component';

const EMPLOYEE_PROFILE = 'EMPLOYEE';
const ADMIN_PROFILE = 'ADMIN';

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

  readonly accessProfileOptions = ACCESS_PROFILE_OPTIONS;
  readonly userTypeOptions: SelectOption[] = [
    { value: EMPLOYEE_PROFILE, label: 'Colaborador (acessa conforme os perfis)' },
    { value: ADMIN_PROFILE, label: 'Administrador (acessa tudo)' },
  ];
  /** Perfis marcados - um colaborador pode ter vários; as permissões se somam. */
  readonly selectedProfiles = signal<Set<AccessProfile>>(new Set());

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
    profile: [EMPLOYEE_PROFILE, [Validators.required]],
  });

  get isAdminType(): boolean {
    return this.form.controls.profile.value === ADMIN_PROFILE;
  }

  toggleProfile(profile: AccessProfile, checked: boolean): void {
    const next = new Set(this.selectedProfiles());
    if (checked) {
      next.add(profile);
    } else {
      next.delete(profile);
    }
    this.selectedProfiles.set(next);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.form.reset({
        name: this.user?.name ?? '',
        documentType: this.user?.documentType ?? 'CPF',
        documentNumber: this.user?.documentNumber ?? '',
        login: this.user?.login ?? '',
        email: this.user?.email ?? '',
        password: '',
        profile: this.user?.profile === ADMIN_PROFILE ? ADMIN_PROFILE : EMPLOYEE_PROFILE,
      });
      this.selectedProfiles.set(new Set(this.user?.accessProfiles ?? []));

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
    const { password, profile, ...rest } = this.form.getRawValue();

    // Administrador acessa tudo - perfis só valem para colaborador. O backend impede que o
    // escritório fique sem nenhum administrador.
    const value: UserDTO = {
      ...rest,
      profile,
      accessProfiles: profile === ADMIN_PROFILE ? [] : [...this.selectedProfiles()],
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
