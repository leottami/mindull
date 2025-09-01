/**
 * Auth Service - Haupt-Service für Authentifizierung
 * Sign-up/Login/Logout, Session-Handling, Auto-Refresh
 * Implementiert gemäß AUTH.BRIEF und PRD.brief
 */

import { supabase } from '../db/supabase.client';
import { 
  IAuthService, 
  ITokenStore, 
  User, 
  Session, 
  AuthState, 
  AuthError, 
  AuthErrorCode,
  SignUpRequest,
  LoginRequest,
  AppleSignInRequest,
  PasswordResetRequest,
  TokenRefreshResponse,
  AuthEvent
} from './types';
import { getTokenStore } from './token.store';
import { passwordValidator, EmailValidator, authRateLimiter } from './policies';

/**
 * Telemetrie-Interface (ohne PII)
 */
interface ITelemetry {
  track(event: AuthEvent, properties?: Record<string, any>): void;
}

/**
 * Mock Telemetry für Tests
 */
class MockTelemetry implements ITelemetry {
  public events: Array<{ event: AuthEvent; properties?: Record<string, any>; timestamp: number }> = [];

  track(event: AuthEvent, properties?: Record<string, any>): void {
    this.events.push({
      event,
      properties,
      timestamp: Date.now()
    });
  }

  reset(): void {
    this.events = [];
  }
}

/**
 * Auth Service Implementation
 */
export class AuthService implements IAuthService {
  private currentUser: User | null = null;
  private loading = false;
  private error: AuthError | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor(
    private tokenStore: ITokenStore = getTokenStore(),
    private telemetry: ITelemetry = new MockTelemetry()
  ) {
    this.initializeAutoRefresh();
  }

  /**
   * Benutzer-Registrierung mit E-Mail/Passwort
   */
  async signUp(request: SignUpRequest): Promise<User> {
    try {
      this.setLoading(true);
      this.clearError();

      // Input-Validierung
      const emailError = EmailValidator.validate(request.email);
      if (emailError) {
        this.telemetry.track(AuthEvent.SIGNUP_FAIL, { error: emailError.code });
        throw emailError;
      }

      const passwordError = passwordValidator.validate(request.password);
      if (passwordError) {
        this.telemetry.track(AuthEvent.SIGNUP_FAIL, { error: passwordError.code });
        throw passwordError;
      }

      // Rate-Limiting prüfen
      const rateLimitError = authRateLimiter.checkRateLimit(request.email);
      if (rateLimitError) {
        this.telemetry.track(AuthEvent.SIGNUP_FAIL, { error: rateLimitError.code });
        throw rateLimitError;
      }

      // Supabase Sign-up
      const { data, error } = await supabase.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          emailRedirectTo: undefined // Keine URL-Redirect in der App
        }
      });

      if (error) {
        authRateLimiter.recordFailedAttempt(request.email);
        const authError = this.mapSupabaseError(error);
        this.telemetry.track(AuthEvent.SIGNUP_FAIL, { error: authError.code });
        throw authError;
      }

      if (!data.user) {
        const authError = this.createError(AuthErrorCode.UNKNOWN_ERROR, 'Benutzer konnte nicht erstellt werden');
        this.telemetry.track(AuthEvent.SIGNUP_FAIL, { error: authError.code });
        throw authError;
      }

      authRateLimiter.recordSuccessfulAttempt(request.email);
      const user = this.mapSupabaseUser(data.user);
      this.telemetry.track(AuthEvent.SIGNUP_SUCCESS);
      
      return user;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Anmeldung mit E-Mail/Passwort
   */
  async signIn(request: LoginRequest): Promise<Session> {
    try {
      this.setLoading(true);
      this.clearError();

      // Input-Validierung
      const emailError = EmailValidator.validate(request.email);
      if (emailError) {
        this.telemetry.track(AuthEvent.LOGIN_FAIL, { error: emailError.code });
        throw emailError;
      }

      // Rate-Limiting prüfen
      const rateLimitError = authRateLimiter.checkRateLimit(request.email);
      if (rateLimitError) {
        this.telemetry.track(AuthEvent.LOGIN_FAIL, { error: rateLimitError.code });
        throw rateLimitError;
      }

      // Supabase Sign-in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: request.email,
        password: request.password
      });

      if (error) {
        authRateLimiter.recordFailedAttempt(request.email);
        const authError = this.mapSupabaseError(error);
        this.telemetry.track(AuthEvent.LOGIN_FAIL, { error: authError.code });
        throw authError;
      }

      if (!data.session || !data.user) {
        const authError = this.createError(AuthErrorCode.INVALID_CREDENTIALS, 'Anmeldung fehlgeschlagen');
        this.telemetry.track(AuthEvent.LOGIN_FAIL, { error: authError.code });
        throw authError;
      }

      authRateLimiter.recordSuccessfulAttempt(request.email);
      const session = await this.processSession(data.session, data.user);
      this.telemetry.track(AuthEvent.LOGIN_SUCCESS);
      
      return session;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Anmeldung mit Apple SSO
   */
  async signInWithApple(request: AppleSignInRequest): Promise<Session> {
    try {
      this.setLoading(true);
      this.clearError();

      // Apple Identity Token validieren
      if (!request.identityToken || !request.nonce) {
        const authError = this.createError(AuthErrorCode.APPLE_INVALID_TOKEN, 'Ungültiges Apple Token');
        this.telemetry.track(AuthEvent.APPLE_FAIL, { error: authError.code });
        throw authError;
      }

      // Supabase Apple Sign-in
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: request.identityToken,
        nonce: request.nonce
      });

      if (error) {
        const authError = this.mapSupabaseError(error);
        this.telemetry.track(AuthEvent.APPLE_FAIL, { error: authError.code });
        throw authError;
      }

      if (!data.session || !data.user) {
        const authError = this.createError(AuthErrorCode.APPLE_FAILED, 'Apple-Anmeldung fehlgeschlagen');
        this.telemetry.track(AuthEvent.APPLE_FAIL, { error: authError.code });
        throw authError;
      }

      const session = await this.processSession(data.session, data.user);
      this.telemetry.track(AuthEvent.APPLE_SUCCESS);
      
      return session;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Abmeldung und Token-Bereinigung
   */
  async signOut(): Promise<void> {
    try {
      this.setLoading(true);
      this.clearError();

      // Auto-Refresh stoppen
      this.stopAutoRefresh();

      // Supabase Sign-out
      await supabase.auth.signOut();

      // Token löschen
      await this.tokenStore.clearTokens();

      // State zurücksetzen
      this.currentUser = null;
      this.isRefreshing = false;

      this.telemetry.track(AuthEvent.LOGOUT);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Passwort-Reset anfordern
   */
  async resetPassword(request: PasswordResetRequest): Promise<void> {
    try {
      this.setLoading(true);
      this.clearError();

      // Input-Validierung
      const emailError = EmailValidator.validate(request.email);
      if (emailError) {
        throw emailError;
      }

      // Rate-Limiting prüfen
      const rateLimitError = authRateLimiter.checkRateLimit(request.email);
      if (rateLimitError) {
        throw rateLimitError;
      }

      // Supabase Password Reset
      const { error } = await supabase.auth.resetPasswordForEmail(request.email);

      if (error) {
        authRateLimiter.recordFailedAttempt(request.email);
        throw this.mapSupabaseError(error);
      }

      authRateLimiter.recordSuccessfulAttempt(request.email);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Aktueller Benutzer abrufen
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.currentUser = this.mapSupabaseUser(user);
      }
      return this.currentUser;
    } catch {
      return null;
    }
  }

  /**
   * Session-Refresh (manuell oder auto)
   * Gemäß AUTH.BRIEF: on401 → einmaliger Refresh, dann Logout
   */
  async refreshSession(): Promise<Session> {
    if (this.isRefreshing) {
      throw this.createError(AuthErrorCode.REFRESH_FAILED, 'Refresh bereits in Bearbeitung');
    }

    try {
      this.isRefreshing = true;

      const refreshToken = await this.tokenStore.getRefreshToken();
      if (!refreshToken) {
        throw this.createError(AuthErrorCode.REFRESH_FAILED, 'Kein Refresh Token verfügbar');
      }

      // Supabase Session Refresh
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session) {
        this.telemetry.track(AuthEvent.TOKEN_REFRESH_FAIL);
        // Bei Refresh-Fehler: Auto-Logout gemäß AUTH.BRIEF
        await this.signOut();
        this.telemetry.track(AuthEvent.AUTO_LOGOUT);
        throw this.mapSupabaseError(error || new Error('Session refresh failed'));
      }

      const session = await this.processSession(data.session, data.user);
      this.telemetry.track(AuthEvent.TOKEN_REFRESH_SUCCESS);
      
      return session;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Auth-State abrufen
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: this.currentUser !== null,
      user: this.currentUser,
      loading: this.loading,
      error: this.error
    };
  }

  /**
   * Session-Verarbeitung nach erfolgreicher Authentifizierung
   */
  private async processSession(session: any, user: any): Promise<Session> {
    const mappedUser = this.mapSupabaseUser(user);
    this.currentUser = mappedUser;

    // Token speichern
    const expiresAt = Date.now() + (session.expires_in * 1000);
    await this.tokenStore.setTokens(
      session.access_token,
      session.refresh_token,
      expiresAt
    );

    // Auto-Refresh starten
    this.startAutoRefresh();

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt,
      user: mappedUser
    };
  }

  /**
   * Auto-Refresh-Timer initialisieren
   */
  private initializeAutoRefresh(): void {
    // Prüfe beim Start ob bereits Token vorhanden
    this.checkExistingSession();
  }

  /**
   * Prüfe existierende Session beim App-Start
   */
  private async checkExistingSession(): Promise<void> {
    try {
      const hasRefreshToken = await this.tokenStore.hasRefreshToken();
      if (hasRefreshToken && this.tokenStore.shouldRefreshToken()) {
        await this.refreshSession();
      } else if (hasRefreshToken) {
        this.startAutoRefresh();
      }
    } catch {
      // Ignore errors beim initialen Check
    }
  }

  /**
   * Auto-Refresh starten (ab T-5min gemäß AUTH.BRIEF)
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();

    const timeToRefresh = this.tokenStore.getTimeToRefresh();
    if (timeToRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshSession();
        } catch {
          // Auto-Logout bei Refresh-Fehler
          await this.signOut();
          this.telemetry.track(AuthEvent.AUTO_LOGOUT);
        }
      }, timeToRefresh);
    }
  }

  /**
   * Auto-Refresh stoppen
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Supabase-User zu Domain-User mappen
   */
  private mapSupabaseUser(user: any): User {
    return {
      id: user.id,
      email: user.email || '',
      emailVerified: user.email_confirmed_at !== null,
      provider: user.app_metadata?.provider === 'apple' ? 'apple' : 'email',
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at
    };
  }

  /**
   * Supabase-Fehler zu Domain-Fehler mappen (ohne PII)
   */
  private mapSupabaseError(error: any): AuthError {
    const message = error?.message || 'Unbekannter Fehler';
    
    // Mapping basierend auf Supabase-Fehlercodes
    if (message.includes('Invalid login credentials')) {
      return this.createError(AuthErrorCode.INVALID_CREDENTIALS, 'Ungültige Anmeldedaten');
    }
    
    if (message.includes('Email not confirmed')) {
      return this.createError(AuthErrorCode.EMAIL_NOT_VERIFIED, 'E-Mail nicht bestätigt');
    }
    
    if (message.includes('User already registered')) {
      return this.createError(AuthErrorCode.USER_ALREADY_EXISTS, 'Benutzer bereits registriert');
    }
    
    if (message.includes('refresh_token_not_found')) {
      return this.createError(AuthErrorCode.REFRESH_FAILED, 'Session abgelaufen');
    }
    
    if (message.includes('Invalid refresh token')) {
      return this.createError(AuthErrorCode.TOKEN_INVALID, 'Ungültiger Token');
    }

    // Network/Timeout Fehler
    if (error?.name === 'AbortError' || message.includes('timeout')) {
      return this.createError(AuthErrorCode.API_TIMEOUT, 'Zeitüberschreitung');
    }

    if (error?.name === 'NetworkError' || message.includes('network')) {
      return this.createError(AuthErrorCode.NETWORK_ERROR, 'Netzwerkfehler');
    }

    return this.createError(AuthErrorCode.UNKNOWN_ERROR, 'Ein Fehler ist aufgetreten');
  }

  /**
   * Auth-Fehler erstellen
   */
  private createError(code: AuthErrorCode, message: string, retryable = true): AuthError {
    return {
      code,
      message,
      timestamp: Date.now(),
      retryable
    };
  }

  /**
   * Loading-State setzen
   */
  private setLoading(loading: boolean): void {
    this.loading = loading;
  }

  /**
   * Fehler zurücksetzen
   */
  private clearError(): void {
    this.error = null;
  }
}

/**
 * Singleton-Instance für App-weite Nutzung
 */
let authServiceInstance: AuthService | null = null;

export function getAuthService(tokenStore?: ITokenStore, telemetry?: ITelemetry): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(tokenStore, telemetry);
  }
  return authServiceInstance;
}

/**
 * Für Tests: Reset der Singleton-Instance
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}

export { MockTelemetry };
