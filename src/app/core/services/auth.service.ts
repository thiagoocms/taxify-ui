import {HttpClient} from '@angular/common/http';
import {computed, Injectable, signal} from '@angular/core';
import {jwtDecode} from 'jwt-decode';
import {Observable, Subject, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {AccessProfile, Permission} from '../models/access.model';
import {AuthenticatedDTO, AuthLoginDTO} from '../models/auth.model';

const TOKEN_KEY = 'taxify_token';
const USER_ID_KEY = 'taxify_user_id';
const USER_NAME_KEY = 'taxify_user_name';
const ADMIN_PROFILE = 'ADMIN';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly userIdSignal = signal<string | null>(localStorage.getItem(USER_ID_KEY));
  private readonly userNameSignal = signal<string | null>(localStorage.getItem(USER_NAME_KEY));

  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly userId = computed(() => this.userIdSignal());
  readonly userName = computed(() => this.userNameSignal());

  /** Trocas da própria senha no ar (`PUT /users/me/password`): o token pode mudar quando ela terminar. */
  private passwordChanges = 0;
  private readonly passwordChangeSettledSubject = new Subject<void>();
  /** Emite quando a última troca de senha no ar termina (com sucesso ou erro). */
  readonly passwordChangeSettled$ = this.passwordChangeSettledSubject.asObservable();
  /** A sessão já foi encerrada por um 401: os 401 seguintes não repetem toast nem navegação até o próximo login. */
  private sessionEnded = false;

  constructor(private readonly http: HttpClient) {
  }

  get token(): string | null {
    return this.tokenSignal();
  }

  get passwordChangeInFlight(): boolean {
    return this.passwordChanges > 0;
  }

  beginPasswordChange(): void {
    this.passwordChanges++;
  }

  endPasswordChange(): void {
    this.passwordChanges = Math.max(0, this.passwordChanges - 1);
    if (this.passwordChanges === 0) {
      this.passwordChangeSettledSubject.next();
    }
  }

  /** O primeiro 401 da sessão ganha (true) e encerra a sessão; os outros até o próximo login recebem false. */
  claimSessionEnd(): boolean {
    if (this.sessionEnded) {
      return false;
    }
    this.sessionEnded = true;
    return true;
  }

  /**
   * A API espera o campo `auth` como "login:senha" codificado em Base64,
   * seguindo o padrão Basic Auth. Ajuste aqui caso o backend use outro formato.
   */
  login(login: string, password: string): Observable<AuthenticatedDTO> {
    const auth = btoa(`${login}:${password}`);
    const payload: AuthLoginDTO = {auth};
    return this.http.post<AuthenticatedDTO>(this.baseUrl, payload).pipe(
      tap((result) => this.setSession(result)),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    this.tokenSignal.set(null);
    this.userIdSignal.set(null);
    this.userNameSignal.set(null);
  }

  get profile(): string | null {
    const token = this.tokenSignal();
    if (!token) {
      return null;
    }

    try {
      return jwtDecode<{ profile: string }>(token).profile ?? null;
    } catch {
      return null;
    }
  }

  get isAdmin(): boolean {
    return this.profile === ADMIN_PROFILE;
  }

  /** Permissões do usuário (todas, para ADMIN) - vêm no token, ver TokenService. */
  readonly permissions = computed<Set<Permission>>(() => new Set(this.claim<Permission[]>('permissions') ?? []));

  /** Perfis de acesso do colaborador (Fiscal, Financeiro...). */
  readonly accessProfiles = computed<AccessProfile[]>(() => this.claim<AccessProfile[]>('accessProfiles') ?? []);

  // Admin da plataforma (CS Hub): não é lido do token. A fonte única é o `platformAdmin` de GET /firm-access
  // (FirmAccessService.platformAdmin), usado pelo menu "Plataforma", pelo platformAdminGuard e pelas regras gerais.

  /** Pode fazer isto? ADMIN sempre pode. Use nas telas em vez de checar o perfil pelo nome. */
  can(permission: Permission): boolean {
    return this.isAdmin || this.permissions().has(permission);
  }

  private claim<T>(name: string): T | null {
    const token = this.tokenSignal();
    if (!token) {
      return null;
    }
    try {
      return (jwtDecode<Record<string, unknown>>(token)[name] as T) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Troca só o token da sessão atual (troca da própria senha: `PUT /users/me/password` devolve um JWT novo com a
   * versão de sessão nova). Mesmo armazenamento do login; userId e userName não mudam.
   */
  replaceToken(token: string): void {
    if (!token) {
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }

  private setSession(result: AuthenticatedDTO): void {
    this.sessionEnded = false;
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_ID_KEY, result.userId);
    localStorage.setItem(USER_NAME_KEY, result.userName);
    this.tokenSignal.set(result.token);
    this.userIdSignal.set(result.userId);
    this.userNameSignal.set(result.userName);
  }

}
