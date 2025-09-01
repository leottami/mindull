/**
 * Auth Navigation Stack - Registrierung & Übergänge
 * Konfiguration für Auth-Screen Navigation ohne UI-Komponenten
 */

import { NavigationContainer, NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNavigationStateManager } from './guards';

// ============================================================================
// TYPES
// ============================================================================

export type AuthStackParamList = {
  LoginScreen: {
    email?: string;
    returnTo?: string;
  };
  SignupScreen: {
    email?: string;
  };
  VerifyEmailScreen: {
    email: string;
    fromSignup?: boolean;
  };
  ResetPasswordScreen: {
    email?: string;
  };
  AccountLinkingScreen?: {
    existingProvider: 'email' | 'apple';
    newProvider: 'email' | 'apple';
    existingEmail?: string;
  };
};

export type AuthNavigationProp<T extends keyof AuthStackParamList> = NativeStackNavigationProp<AuthStackParamList, T>;

// ============================================================================
// NAVIGATION STATE
// ============================================================================

interface AuthNavigationState {
  currentScreen: keyof AuthStackParamList;
  isTransitioning: boolean;
  canGoBack: boolean;
  previousScreen?: keyof AuthStackParamList;
}

interface AuthFlowConfig {
  initialScreen: keyof AuthStackParamList;
  headerShown: boolean;
  gestureEnabled: boolean;
  animationEnabled: boolean;
}

// ============================================================================
// AUTH FLOW MANAGER
// ============================================================================

/**
 * Auth Flow Manager - Verwaltet Navigation zwischen Auth-Screens
 */
export class AuthFlowManager {
  private state: AuthNavigationState = {
    currentScreen: 'LoginScreen',
    isTransitioning: false,
    canGoBack: false
  };

  private listeners: ((state: AuthNavigationState) => void)[] = [];

  constructor(
    private navigationRef: React.RefObject<NavigationContainer<any>>
  ) {}

  /**
   * Screen-Wechsel verfolgen
   */
  onScreenChange(screen: keyof AuthStackParamList, canGoBack: boolean = true): void {
    const previousScreen = this.state.currentScreen;
    
    this.state = {
      currentScreen: screen,
      isTransitioning: false,
      canGoBack,
      previousScreen
    };

    this.notifyListeners();
  }

  /**
   * Transition-State setzen
   */
  setTransitioning(transitioning: boolean): void {
    this.state = {
      ...this.state,
      isTransitioning: transitioning
    };

    this.notifyListeners();
  }

  /**
   * Navigation-Flows für verschiedene Szenarien
   */
  
  // Standard Login-Flow
  navigateToLogin(email?: string, returnTo?: string): void {
    this.navigate('LoginScreen', { email, returnTo });
  }

  // Standard Signup-Flow
  navigateToSignup(email?: string): void {
    this.navigate('SignupScreen', { email });
  }

  // Nach erfolgreicher Registrierung zu E-Mail-Verifikation
  navigateToEmailVerification(email: string, fromSignup: boolean = true): void {
    this.navigate('VerifyEmailScreen', { email, fromSignup });
  }

  // Passwort-Reset Flow
  navigateToPasswordReset(email?: string): void {
    this.navigate('ResetPasswordScreen', { email });
  }

  // Account Linking (optional für Apple ⇄ E-Mail)
  navigateToAccountLinking(
    existingProvider: 'email' | 'apple',
    newProvider: 'email' | 'apple',
    existingEmail?: string
  ): void {
    if (this.isAccountLinkingEnabled()) {
      this.navigate('AccountLinkingScreen', {
        existingProvider,
        newProvider,
        existingEmail
      });
    }
  }

  // Zurück zur vorherigen Screen
  goBack(): boolean {
    if (!this.state.canGoBack) {
      return false;
    }

    const navigation = this.navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
      return true;
    }

    return false;
  }

  // Zurück zum Login (Reset Flow)
  resetToLogin(email?: string): void {
    this.reset('LoginScreen', { email });
  }

  /**
   * Flow-spezifische Validierungen
   */
  
  // Prüft ob E-Mail-Verifikation erforderlich ist
  requiresEmailVerification(provider: 'email' | 'apple'): boolean {
    // Apple SSO erfordert normalerweise keine separate E-Mail-Verifikation
    return provider === 'email';
  }

  // Prüft ob Account Linking verfügbar ist
  isAccountLinkingEnabled(): boolean {
    // Account Linking ist optional gemäß Requirements
    return true; // Kann über Feature-Flag gesteuert werden
  }

  // Prüft ob Screen im aktuellen Flow erlaubt ist
  canNavigateToScreen(
    targetScreen: keyof AuthStackParamList,
    currentScreen: keyof AuthStackParamList = this.state.currentScreen
  ): boolean {
    const allowedTransitions: Record<keyof AuthStackParamList, (keyof AuthStackParamList)[]> = {
      LoginScreen: ['SignupScreen', 'ResetPasswordScreen', 'VerifyEmailScreen'],
      SignupScreen: ['LoginScreen', 'VerifyEmailScreen', 'AccountLinkingScreen'],
      VerifyEmailScreen: ['LoginScreen', 'SignupScreen'],
      ResetPasswordScreen: ['LoginScreen', 'SignupScreen'],
      AccountLinkingScreen: ['LoginScreen', 'SignupScreen']
    };

    return allowedTransitions[currentScreen]?.includes(targetScreen) ?? false;
  }

  /**
   * Error-Recovery Flows
   */
  
  // Bei Netzwerkfehlern: Retry auf aktueller Screen
  handleNetworkError(): void {
    // Bleibt auf aktueller Screen, zeigt Retry-Option
  }

  // Bei Auth-Fehlern: Zurück zu Login
  handleAuthError(): void {
    this.resetToLogin();
  }

  // Bei Apple-Abbruch: Zurück zu Login
  handleAppleCancellation(): void {
    this.resetToLogin();
  }

  // Bei Rate-Limiting: Disable Navigation temporär
  handleRateLimit(retryAfter: number): void {
    // Navigation temporär deaktivieren
    setTimeout(() => {
      // Re-enable nach Timeout
    }, retryAfter * 1000);
  }

  /**
   * Deep-Link Handling
   */
  
  // Verarbeitet Deep-Links für Auth-Flows
  handleDeepLink(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const params = Object.fromEntries(parsedUrl.searchParams.entries());

      switch (path) {
        case '/auth/login':
          this.navigateToLogin(params.email, params.returnTo);
          return true;
          
        case '/auth/signup':
          this.navigateToSignup(params.email);
          return true;
          
        case '/auth/verify':
          if (params.email) {
            this.navigateToEmailVerification(params.email, false);
            return true;
          }
          break;
          
        case '/auth/reset':
          this.navigateToPasswordReset(params.email);
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('AuthFlowManager: Invalid deep-link URL:', url);
      return false;
    }

    return false;
  }

  /**
   * State Management
   */
  
  getCurrentState(): AuthNavigationState {
    return { ...this.state };
  }

  onStateChange(listener: (state: AuthNavigationState) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Private Helper Methods
   */
  
  private navigate(screen: keyof AuthStackParamList, params?: any): void {
    if (!this.canNavigateToScreen(screen)) {
      console.warn(`AuthFlowManager: Navigation to ${screen} not allowed from ${this.state.currentScreen}`);
      return;
    }

    this.setTransitioning(true);
    
    const navigation = this.navigationRef.current;
    if (navigation) {
      navigation.navigate(screen as never, params as never);
    }
  }

  private reset(screen: keyof AuthStackParamList, params?: any): void {
    this.setTransitioning(true);
    
    const navigation = this.navigationRef.current;
    if (navigation) {
      navigation.reset({
        index: 0,
        routes: [{ name: screen as never, params: params as never }]
      });
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('AuthFlowManager: Error in state listener:', error);
      }
    });
  }
}

// ============================================================================
// SCREEN CONFIGURATIONS
// ============================================================================

/**
 * Screen-Konfigurationen für Auth Stack
 */
export const AUTH_SCREEN_OPTIONS: Record<keyof AuthStackParamList, any> = {
  LoginScreen: {
    title: 'Anmelden',
    headerShown: false,
    gestureEnabled: true,
    animationTypeForReplace: 'push',
    animation: 'slide_from_right'
  },
  
  SignupScreen: {
    title: 'Registrieren',
    headerShown: false,
    gestureEnabled: true,
    animationTypeForReplace: 'push',
    animation: 'slide_from_right'
  },
  
  VerifyEmailScreen: {
    title: 'E-Mail bestätigen',
    headerShown: false,
    gestureEnabled: false, // Verhindert versehentliches Zurückwischen
    animationTypeForReplace: 'push',
    animation: 'slide_from_bottom'
  },
  
  ResetPasswordScreen: {
    title: 'Passwort zurücksetzen',
    headerShown: false,
    gestureEnabled: true,
    animationTypeForReplace: 'push',
    animation: 'slide_from_bottom'
  },
  
  AccountLinkingScreen: {
    title: 'Konten verknüpfen',
    headerShown: false,
    gestureEnabled: true,
    animationTypeForReplace: 'push',
    animation: 'slide_from_bottom'
  }
};

// ============================================================================
// FLOW CONFIGURATIONS
// ============================================================================

/**
 * Vordefinierte Flow-Konfigurationen
 */
export const AUTH_FLOW_CONFIGS = {
  // Standard Flow: Login → App oder Signup → Verify → App
  STANDARD: {
    initialScreen: 'LoginScreen' as keyof AuthStackParamList,
    headerShown: false,
    gestureEnabled: true,
    animationEnabled: true
  },
  
  // Signup-First Flow: Signup → Verify → App
  SIGNUP_FIRST: {
    initialScreen: 'SignupScreen' as keyof AuthStackParamList,
    headerShown: false,
    gestureEnabled: true,
    animationEnabled: true
  },
  
  // Recovery Flow: Reset → Login → App
  RECOVERY: {
    initialScreen: 'ResetPasswordScreen' as keyof AuthStackParamList,
    headerShown: false,
    gestureEnabled: true,
    animationEnabled: true
  }
} as const;

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigation Helper für Auth Screens
 */
export class AuthNavigationHelper {
  /**
   * Erstellt Navigation Props für Screen
   */
  static createScreenProps<T extends keyof AuthStackParamList>(
    navigation: AuthNavigationProp<T>,
    route: { params?: AuthStackParamList[T] }
  ) {
    return {
      navigation,
      route
    };
  }

  /**
   * Typsichere Navigation zwischen Auth Screens
   */
  static navigateToScreen<T extends keyof AuthStackParamList>(
    navigation: NavigationProp<AuthStackParamList>,
    screen: T,
    params?: AuthStackParamList[T]
  ): void {
    navigation.navigate(screen, params as never);
  }

  /**
   * Erstellt Flow Manager für Navigation Container
   */
  static createFlowManager(
    navigationRef: React.RefObject<NavigationContainer<any>>
  ): AuthFlowManager {
    return new AuthFlowManager(navigationRef);
  }

  /**
   * Standard Navigation Service Integration
   */
  static createNavigationService(
    flowManager: AuthFlowManager
  ): {
    navigate: (route: string) => void;
    getCurrentRoute: () => string;
    goBack: () => void;
  } {
    return {
      navigate: (route: string) => {
        // Map route strings zu Auth Stack Screens
        const screenMap: Record<string, keyof AuthStackParamList> = {
          '/auth/login': 'LoginScreen',
          '/auth/signup': 'SignupScreen',
          '/auth/verify': 'VerifyEmailScreen',
          '/auth/reset': 'ResetPasswordScreen',
          '/auth/link': 'AccountLinkingScreen'
        };

        const screen = screenMap[route];
        if (screen) {
          flowManager.navigate(screen as never, {} as never);
        }
      },
      
      getCurrentRoute: () => {
        const state = flowManager.getCurrentState();
        return `/auth/${state.currentScreen.toLowerCase().replace('screen', '')}`;
      },
      
      goBack: () => {
        flowManager.goBack();
      }
    };
  }
}

// ============================================================================
// INTEGRATION WITH AUTH BRIDGE
// ============================================================================

/**
 * Integration mit Auth Bridge für automatische Navigation
 */
export function setupAuthStackIntegration(
  flowManager: AuthFlowManager,
  navigationStateManager: ReturnType<typeof createNavigationStateManager>
): void {
  // Auth Bridge Integration würde hier konfiguriert
  // Automatische Navigation basierend auf Auth Events
  
  // Beispiel:
  // authBridge.onAuthStateChange(async (event) => {
  //   switch (event.type) {
  //     case 'LOGIN':
  //       // Navigation zur App erfolgt über Navigation Guards
  //       break;
  //       
  //     case 'LOGOUT':
  //       flowManager.resetToLogin();
  //       break;
  //   }
  // });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AuthFlowManager,
  AuthNavigationHelper
};

export type {
  AuthStackParamList,
  AuthNavigationProp,
  AuthNavigationState,
  AuthFlowConfig
};
