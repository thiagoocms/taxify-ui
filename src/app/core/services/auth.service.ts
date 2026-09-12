import {HttpClient} from '@angular/common/http';
import {computed, Injectable, signal} from '@angular/core';
import {jwtDecode} from 'jwt-decode';
import {Observable, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
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

  constructor(private readonly http: HttpClient) {
  }

  get token(): string | null {
    return this.tokenSignal();
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

  private setSession(result: AuthenticatedDTO): void {
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_ID_KEY, result.userId);
    localStorage.setItem(USER_NAME_KEY, result.userName);
    this.tokenSignal.set(result.token);
    this.userIdSignal.set(result.userId);
    this.userNameSignal.set(result.userName);
  }

}
