/**
 * Auth-State Bridge - Navigation + React Query Integration
 * Koordiniert Auth-State-Änderungen mit allen abhängigen Systemen
 */

import { getAuthService } from './auth.service';
import { User, AuthState, AuthEvent } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthStateChangeEvent {
  readonly type: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESH' | 'USER_UPDATE';
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  readonly timestamp: number;
  readonly previousUser?: User | null;
}

export type AuthStateChangeCallback = (event: AuthStateChangeEvent) => void | Promise<void>;

export interface INavigationService {
  navigateToAuth(): void;
  navigateToApp(): void;
  getCurrentRoute(): string;
}

export interface IQueryClientService {
  clearSensitiveCaches(): Promise<void>;
  invalidateUserScopedQueries(userId: string): Promise<void>;
  resetQueryClient(): Promise<void>;
}

export interface IOutboxService {
  pause(): Promise<void>;
  resume(): Promise<void>;
  clearUserData(userId: string): Promise<void>;
}

export interface ITimerService {
  stopAllTimers(): void;
  startUserScopedTimers(userId: string): void;
}

// ============================================================================
// AUTH BRIDGE IMPLEMENTATION
// ============================================================================

/**
 * Auth-State Bridge
 * Zentrale Koordination aller Auth-State-Abhängigen Services
 */
export class AuthBridge {
  private callbacks: Set<AuthStateChangeCallback> = new Set();
  private currentState: AuthState | null = null;
  private isInitialized = false;

  constructor(
    private navigationService?: INavigationService,
    private queryClientService?: IQueryClientService,
    private outboxService?: IOutboxService,
    private timerService?: ITimerService
  ) {}

  /**
   * Bridge initialisieren und Auth-State-Änderungen überwachen
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const authService = getAuthService();
    
    // Initial State laden
    this.currentState = authService.getAuthState();
    
    // Beim App-Start: Prüfe ob bereits authentifiziert
    const currentUser = await authService.getCurrentUser();
    if (currentUser) {
      await this.handleLogin(currentUser, this.currentState?.user);
    }

    this.isInitialized = true;
  }

  /**
   * Callback für Auth-State-Änderungen registrieren
   */
  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    this.callbacks.add(callback);
    
    // Cleanup-Funktion zurückgeben
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Auth-State-Änderung von außen triggern
   * Wird vom AuthService bei Login/Logout/Refresh aufgerufen
   */
  async notifyAuthStateChange(
    type: AuthStateChangeEvent['type'],
    user: User | null
  ): Promise<void> {
    const previousUser = this.currentState?.user || null;
    const isAuthenticated = user !== null;

    const event: AuthStateChangeEvent = {
      type,
      user,
      isAuthenticated,
      timestamp: Date.now(),
      previousUser
    };

    // State aktualisieren
    this.currentState = {
      isAuthenticated,
      user,
      loading: false,
      error: null
    };

    // Basierend auf Event-Type entsprechende Aktionen ausführen
    switch (type) {
      case 'LOGIN':
        await this.handleLogin(user, previousUser);
        break;
        
      case 'LOGOUT':
        await this.handleLogout(previousUser);
        break;
        
      case 'TOKEN_REFRESH':
        await this.handleTokenRefresh(user, previousUser);
        break;
        
      case 'USER_UPDATE':
        await this.handleUserUpdate(user, previousUser);
        break;
    }

    // Alle registrierten Callbacks benachrichtigen
    await this.notifyCallbacks(event);
  }

  /**
   * Login-Handling: User-Scope-Keys neu laden, Navigation zu App
   */
  private async handleLogin(user: User | null, previousUser: User | null): Promise<void> {
    if (!user) return;

    try {
      // Identity-Wechsel erkennen
      const isIdentityChange = previousUser && previousUser.id !== user.id;
      
      if (isIdentityChange && previousUser) {
        // Bei Identity-Wechsel: Alte User-Daten löschen
        await this.clearUserScopedData(previousUser.id);
      }

      // User-Scope-Keys neu laden
      if (this.queryClientService) {
        await this.queryClientService.invalidateUserScopedQueries(user.id);
      }

      // Outbox für neuen User fortsetzen
      if (this.outboxService) {
        await this.outboxService.resume();
      }

      // User-spezifische Timer starten
      if (this.timerService) {
        this.timerService.startUserScopedTimers(user.id);
      }

      // Navigation zur App
      if (this.navigationService) {
        const currentRoute = this.navigationService.getCurrentRoute();
        if (currentRoute.includes('auth') || currentRoute === '/') {
          this.navigationService.navigateToApp();
        }
      }

    } catch (error) {
      console.error('AuthBridge: Fehler beim Login-Handling:', error);
    }
  }

  /**
   * Logout-Handling: Alle sensiblen Caches leeren, Timer stoppen, Outbox pausieren
   */
  private async handleLogout(previousUser: User | null): Promise<void> {
    try {
      // Timer stoppen
      if (this.timerService) {
        this.timerService.stopAllTimers();
      }

      // Outbox pausieren
      if (this.outboxService) {
        await this.outboxService.pause();
      }

      // Sensitive Caches leeren
      if (this.queryClientService) {
        await this.queryClientService.clearSensitiveCaches();
      }

      // User-Daten aus Outbox löschen (optional)
      if (previousUser && this.outboxService) {
        await this.outboxService.clearUserData(previousUser.id);
      }

      // Navigation zur Auth
      if (this.navigationService) {
        this.navigationService.navigateToAuth();
      }

    } catch (error) {
      console.error('AuthBridge: Fehler beim Logout-Handling:', error);
    }
  }

  /**
   * Token-Refresh-Handling: Minimal-Impact, nur bei Identity-Wechsel eingreifen
   */
  private async handleTokenRefresh(user: User | null, previousUser: User | null): Promise<void> {
    if (!user) return;

    try {
      // Identity-Wechsel bei Refresh (sehr selten, aber möglich)
      const isIdentityChange = previousUser && previousUser.id !== user.id;
      
      if (isIdentityChange && previousUser) {
        await this.clearUserScopedData(previousUser.id);
        
        if (this.queryClientService) {
          await this.queryClientService.invalidateUserScopedQueries(user.id);
        }
      }

    } catch (error) {
      console.error('AuthBridge: Fehler beim Token-Refresh-Handling:', error);
    }
  }

  /**
   * User-Update-Handling: Minimale Invalidierung
   */
  private async handleUserUpdate(user: User | null, previousUser: User | null): Promise<void> {
    // Meist nur Profile-Updates, keine großen Cache-Invalidierungen nötig
    // Könnte in Zukunft für user-spezifische Cache-Updates verwendet werden
  }

  /**
   * User-spezifische Daten löschen
   */
  private async clearUserScopedData(userId: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.queryClientService) {
      promises.push(this.queryClientService.clearSensitiveCaches());
    }

    if (this.outboxService) {
      promises.push(this.outboxService.clearUserData(userId));
    }

    await Promise.all(promises);
  }

  /**
   * Alle Callbacks benachrichtigen
   */
  private async notifyCallbacks(event: AuthStateChangeEvent): Promise<void> {
    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await callback(event);
      } catch (error) {
        console.error('AuthBridge: Fehler in Callback:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Aktueller Auth-State
   */
  getCurrentAuthState(): AuthState | null {
    return this.currentState;
  }

  /**
   * Bridge zurücksetzen (für Tests)
   */
  reset(): void {
    this.callbacks.clear();
    this.currentState = null;
    this.isInitialized = false;
  }

  /**
   * Prüft ob Bridge initialisiert ist
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// ============================================================================
// SINGLETON & FACTORY
// ============================================================================

let authBridgeInstance: AuthBridge | null = null;

export function getAuthBridge(
  navigationService?: INavigationService,
  queryClientService?: IQueryClientService,
  outboxService?: IOutboxService,
  timerService?: ITimerService
): AuthBridge {
  if (!authBridgeInstance) {
    authBridgeInstance = new AuthBridge(
      navigationService,
      queryClientService,
      outboxService,
      timerService
    );
  }
  return authBridgeInstance;
}

/**
 * Für Tests: Reset der Singleton-Instance
 */
export function resetAuthBridge(): void {
  authBridgeInstance = null;
}

// ============================================================================
// INTEGRATION HELPER
// ============================================================================

/**
 * Auth-Bridge mit allen Services verknüpfen
 */
export async function initializeAuthBridge(
  navigationService: INavigationService,
  queryClientService: IQueryClientService,
  outboxService: IOutboxService,
  timerService: ITimerService
): Promise<AuthBridge> {
  const bridge = getAuthBridge(
    navigationService,
    queryClientService,
    outboxService,
    timerService
  );

  await bridge.initialize();
  return bridge;
}

/**
 * Auth-Service mit Bridge verknüpfen
 * Ruft notifyAuthStateChange bei Auth-Events auf
 */
export function connectAuthServiceToBridge(): void {
  const authService = getAuthService();
  const bridge = getAuthBridge();

  // Hook into AuthService Events
  // In einer vollständigen Implementierung würde AuthService Events emittieren
  // Hier simulieren wir das durch Überschreiben der relevanten Methoden
  
  const originalSignIn = authService.signIn.bind(authService);
  authService.signIn = async (request) => {
    const result = await originalSignIn(request);
    await bridge.notifyAuthStateChange('LOGIN', result.user);
    return result;
  };

  const originalSignInWithApple = authService.signInWithApple.bind(authService);
  authService.signInWithApple = async (request) => {
    const result = await originalSignInWithApple(request);
    await bridge.notifyAuthStateChange('LOGIN', result.user);
    return result;
  };

  const originalSignOut = authService.signOut.bind(authService);
  authService.signOut = async () => {
    const currentUser = await authService.getCurrentUser();
    await originalSignOut();
    await bridge.notifyAuthStateChange('LOGOUT', null);
  };

  const originalRefreshSession = authService.refreshSession.bind(authService);
  authService.refreshSession = async () => {
    const result = await originalRefreshSession();
    await bridge.notifyAuthStateChange('TOKEN_REFRESH', result.user);
    return result;
  };
}
