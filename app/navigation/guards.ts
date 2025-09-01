/**
 * Navigation Guards & Redirects
 * Auth-basierte Navigation mit Guards für geschützte Routen
 */

import { getAuthService } from '../../services/auth';
import { getAuthBridge } from '../../services/auth/auth.bridge';
import { User, AuthState } from '../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

export interface RouteConfig {
  readonly name: string;
  readonly path: string;
  readonly requiresAuth: boolean;
  readonly guestOnly?: boolean; // Nur für nicht-authentifizierte User
  readonly component: string;
  readonly fallback?: string; // Fallback-Route bei Auth-Fehler
}

export interface NavigationContext {
  readonly currentRoute: string;
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
}

export interface GuardResult {
  readonly allowed: boolean;
  readonly redirectTo?: string;
  readonly reason?: string;
}

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * App-Route-Konfiguration gemäß PRD.brief
 * Tabs: Breath, Journal, Gratitude, Settings
 */
export const ROUTES: Record<string, RouteConfig> = {
  // Auth Routes (Guest Only)
  AUTH_WELCOME: {
    name: 'AuthWelcome',
    path: '/auth/welcome',
    requiresAuth: false,
    guestOnly: true,
    component: 'AuthWelcomeScreen'
  },
  AUTH_LOGIN: {
    name: 'AuthLogin',
    path: '/auth/login',
    requiresAuth: false,
    guestOnly: true,
    component: 'AuthLoginScreen'
  },
  AUTH_SIGNUP: {
    name: 'AuthSignup',
    path: '/auth/signup',
    requiresAuth: false,
    guestOnly: true,
    component: 'AuthSignupScreen'
  },
  AUTH_RESET: {
    name: 'AuthReset',
    path: '/auth/reset',
    requiresAuth: false,
    guestOnly: true,
    component: 'AuthResetScreen'
  },

  // App Routes (Auth Required)
  APP_BREATH: {
    name: 'AppBreath',
    path: '/app/breath',
    requiresAuth: true,
    component: 'BreathScreen',
    fallback: '/auth/welcome'
  },
  APP_JOURNAL: {
    name: 'AppJournal',
    path: '/app/journal',
    requiresAuth: true,
    component: 'JournalScreen',
    fallback: '/auth/welcome'
  },
  APP_GRATITUDE: {
    name: 'AppGratitude',
    path: '/app/gratitude',
    requiresAuth: true,
    component: 'GratitudeScreen',
    fallback: '/auth/welcome'
  },
  APP_SETTINGS: {
    name: 'AppSettings',
    path: '/app/settings',
    requiresAuth: true,
    component: 'SettingsScreen',
    fallback: '/auth/welcome'
  },

  // Onboarding (Auth Required aber flexibel)
  ONBOARDING: {
    name: 'Onboarding',
    path: '/onboarding',
    requiresAuth: true,
    component: 'OnboardingScreen',
    fallback: '/auth/welcome'
  },

  // Root/Default
  ROOT: {
    name: 'Root',
    path: '/',
    requiresAuth: false,
    component: 'RootScreen'
  }
};

// Default Routes
export const DEFAULT_AUTH_ROUTE = ROUTES.AUTH_WELCOME.path;
export const DEFAULT_APP_ROUTE = ROUTES.APP_BREATH.path;

// ============================================================================
// NAVIGATION GUARDS
// ============================================================================

/**
 * Auth Guard - Prüft ob Route für aktuellen Auth-Status erlaubt ist
 */
export class AuthGuard {
  constructor(
    private authService = getAuthService(),
    private authBridge = getAuthBridge()
  ) {}

  /**
   * Prüft ob Navigation zu Route erlaubt ist
   */
  async canNavigate(targetRoute: string, context?: Partial<NavigationContext>): Promise<GuardResult> {
    const routeConfig = this.findRouteConfig(targetRoute);
    if (!routeConfig) {
      return {
        allowed: false,
        redirectTo: DEFAULT_AUTH_ROUTE,
        reason: 'Route not found'
      };
    }

    const navigationContext = await this.getNavigationContext(context);

    // Loading-State: Erlaubt aber verzögern
    if (navigationContext.isLoading) {
      return {
        allowed: true,
        reason: 'Loading auth state'
      };
    }

    // Guest-Only Routes (Login-Screens)
    if (routeConfig.guestOnly && navigationContext.isAuthenticated) {
      return {
        allowed: false,
        redirectTo: DEFAULT_APP_ROUTE,
        reason: 'Already authenticated'
      };
    }

    // Auth-Required Routes
    if (routeConfig.requiresAuth && !navigationContext.isAuthenticated) {
      return {
        allowed: false,
        redirectTo: routeConfig.fallback || DEFAULT_AUTH_ROUTE,
        reason: 'Authentication required'
      };
    }

    // E-Mail-Verifikation prüfen (wenn aktiviert)
    if (routeConfig.requiresAuth && navigationContext.user && !navigationContext.user.emailVerified) {
      // In MVP: Email-Verifikation nicht blockierend, nur Info
      // Könnte später als Warnung angezeigt werden
    }

    return {
      allowed: true,
      reason: 'Navigation allowed'
    };
  }

  /**
   * Findet Route-Config basierend auf Pfad oder Name
   */
  private findRouteConfig(routeIdentifier: string): RouteConfig | null {
    // Erst nach Pfad suchen
    const byPath = Object.values(ROUTES).find(route => route.path === routeIdentifier);
    if (byPath) return byPath;

    // Dann nach Name suchen
    const byName = Object.values(ROUTES).find(route => route.name === routeIdentifier);
    if (byName) return byName;

    return null;
  }

  /**
   * Navigation-Context erstellen
   */
  private async getNavigationContext(context?: Partial<NavigationContext>): Promise<NavigationContext> {
    const authState = this.authBridge.getCurrentAuthState() || this.authService.getAuthState();
    
    return {
      currentRoute: context?.currentRoute || '/',
      user: context?.user !== undefined ? context.user : authState.user,
      isAuthenticated: context?.isAuthenticated !== undefined ? context.isAuthenticated : authState.isAuthenticated,
      isLoading: context?.isLoading !== undefined ? context.isLoading : authState.loading
    };
  }
}

// ============================================================================
// NAVIGATION REDIRECTOR
// ============================================================================

/**
 * Automatische Navigation basierend auf Auth-State
 */
export class AuthRedirector {
  private guard: AuthGuard;

  constructor(
    private navigationService: { navigate: (route: string) => void; getCurrentRoute: () => string },
    authService = getAuthService(),
    authBridge = getAuthBridge()
  ) {
    this.guard = new AuthGuard(authService, authBridge);
  }

  /**
   * Automatische Weiterleitung basierend auf Auth-State
   */
  async handleAuthRedirect(): Promise<string> {
    const currentRoute = this.navigationService.getCurrentRoute();
    const guardResult = await this.guard.canNavigate(currentRoute);

    if (!guardResult.allowed && guardResult.redirectTo) {
      this.navigationService.navigate(guardResult.redirectTo);
      return guardResult.redirectTo;
    }

    return currentRoute;
  }

  /**
   * Weiterleitung nach Login
   */
  async handleLoginSuccess(intendedRoute?: string): Promise<string> {
    let targetRoute = intendedRoute || DEFAULT_APP_ROUTE;
    
    // Prüfen ob intended Route erlaubt ist
    if (intendedRoute) {
      const guardResult = await this.guard.canNavigate(intendedRoute);
      if (!guardResult.allowed) {
        targetRoute = DEFAULT_APP_ROUTE;
      }
    }

    this.navigationService.navigate(targetRoute);
    return targetRoute;
  }

  /**
   * Weiterleitung nach Logout
   */
  async handleLogoutSuccess(): Promise<string> {
    const targetRoute = DEFAULT_AUTH_ROUTE;
    this.navigationService.navigate(targetRoute);
    return targetRoute;
  }

  /**
   * Deep-Link-Handling mit Auth-Prüfung
   */
  async handleDeepLink(deepLinkRoute: string): Promise<string> {
    const guardResult = await this.guard.canNavigate(deepLinkRoute);
    
    if (guardResult.allowed) {
      this.navigationService.navigate(deepLinkRoute);
      return deepLinkRoute;
    } else if (guardResult.redirectTo) {
      this.navigationService.navigate(guardResult.redirectTo);
      return guardResult.redirectTo;
    }

    // Fallback
    const fallbackRoute = DEFAULT_AUTH_ROUTE;
    this.navigationService.navigate(fallbackRoute);
    return fallbackRoute;
  }
}

// ============================================================================
// NAVIGATION STATE MANAGER
// ============================================================================

/**
 * Verwaltet Navigation-State und Integration mit Auth-Bridge
 */
export class NavigationStateManager {
  private redirector: AuthRedirector;
  private unsubscribeAuthBridge?: () => void;

  constructor(
    private navigationService: { 
      navigate: (route: string) => void; 
      getCurrentRoute: () => string;
      goBack: () => void;
    }
  ) {
    this.redirector = new AuthRedirector(navigationService);
  }

  /**
   * Navigation-State-Manager initialisieren
   */
  initialize(): void {
    const authBridge = getAuthBridge();

    // Auth-State-Änderungen überwachen
    this.unsubscribeAuthBridge = authBridge.onAuthStateChange(async (event) => {
      await this.handleAuthStateChange(event);
    });

    // Initial Redirect prüfen
    this.redirector.handleAuthRedirect();
  }

  /**
   * Auth-State-Änderungen behandeln
   */
  private async handleAuthStateChange(event: any): Promise<void> {
    switch (event.type) {
      case 'LOGIN':
        await this.redirector.handleLoginSuccess();
        break;
        
      case 'LOGOUT':
        await this.redirector.handleLogoutSuccess();
        break;
        
      case 'TOKEN_REFRESH':
        // Bei Token-Refresh normalerweise keine Navigation nötig
        // Außer bei Identity-Wechsel
        if (event.previousUser && event.user && event.previousUser.id !== event.user.id) {
          await this.redirector.handleAuthRedirect();
        }
        break;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.unsubscribeAuthBridge) {
      this.unsubscribeAuthBridge();
    }
  }

  /**
   * Geschützte Navigation mit Auth-Prüfung
   */
  async navigateWithGuard(route: string): Promise<boolean> {
    const guard = new AuthGuard();
    const guardResult = await guard.canNavigate(route);

    if (guardResult.allowed) {
      this.navigationService.navigate(route);
      return true;
    } else if (guardResult.redirectTo) {
      this.navigationService.navigate(guardResult.redirectTo);
      return false;
    }

    return false;
  }

  /**
   * Deep-Link mit Auth-Prüfung
   */
  async handleDeepLink(url: string): Promise<void> {
    await this.redirector.handleDeepLink(url);
  }
}

// ============================================================================
// EXPORTS & FACTORY
// ============================================================================

export function createNavigationStateManager(navigationService: {
  navigate: (route: string) => void;
  getCurrentRoute: () => string;
  goBack: () => void;
}): NavigationStateManager {
  return new NavigationStateManager(navigationService);
}

export function createAuthGuard(): AuthGuard {
  return new AuthGuard();
}

export function createAuthRedirector(navigationService: {
  navigate: (route: string) => void;
  getCurrentRoute: () => string;
}): AuthRedirector {
  return new AuthRedirector(navigationService);
}
