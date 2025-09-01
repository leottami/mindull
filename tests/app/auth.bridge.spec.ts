/**
 * Auth Bridge Tests
 * Testet Auth-State-Änderungen und Integration mit Navigation/React Query
 */

import { AuthBridge, resetAuthBridge, AuthStateChangeEvent } from '../../services/auth/auth.bridge';
import { AuthGuard, AuthRedirector, ROUTES } from '../../app/navigation/guards';
import { QueryClientBridge, resetQueryClientBridge } from '../../data/queryClient.bridge';
import { QueryClient } from '@tanstack/react-query';
import { AuthErrorCode, User } from '../../services/auth/types';

// ============================================================================
// MOCKS
// ============================================================================

// Mock Navigation Service
class MockNavigationService {
  public currentRoute = '/';
  public navigationHistory: string[] = [];

  navigate(route: string): void {
    this.currentRoute = route;
    this.navigationHistory.push(route);
  }

  getCurrentRoute(): string {
    return this.currentRoute;
  }

  goBack(): void {
    this.navigationHistory.pop();
    this.currentRoute = this.navigationHistory[this.navigationHistory.length - 1] || '/';
  }

  reset(): void {
    this.currentRoute = '/';
    this.navigationHistory = [];
  }
}

// Mock QueryClient Service
class MockQueryClientService {
  public clearedSensitiveCaches = 0;
  public invalidatedUserScopes: string[] = [];
  public resetCount = 0;

  async clearSensitiveCaches(): Promise<void> {
    this.clearedSensitiveCaches++;
  }

  async invalidateUserScopedQueries(userId: string): Promise<void> {
    this.invalidatedUserScopes.push(userId);
  }

  async resetQueryClient(): Promise<void> {
    this.resetCount++;
  }

  reset(): void {
    this.clearedSensitiveCaches = 0;
    this.invalidatedUserScopes = [];
    this.resetCount = 0;
  }
}

// Mock Outbox Service
class MockOutboxService {
  public isPaused = false;
  public clearedUserData: string[] = [];

  async pause(): Promise<void> {
    this.isPaused = true;
  }

  async resume(): Promise<void> {
    this.isPaused = false;
  }

  async clearUserData(userId: string): Promise<void> {
    this.clearedUserData.push(userId);
  }

  reset(): void {
    this.isPaused = false;
    this.clearedUserData = [];
  }
}

// Mock Timer Service
class MockTimerService {
  public stoppedTimers = 0;
  public startedTimers: string[] = [];

  stopAllTimers(): void {
    this.stoppedTimers++;
  }

  startUserScopedTimers(userId: string): void {
    this.startedTimers.push(userId);
  }

  reset(): void {
    this.stoppedTimers = 0;
    this.startedTimers = [];
  }
}

// Mock User
const createMockUser = (id: string = 'user-123', email: string = 'test@example.com'): User => ({
  id,
  email,
  emailVerified: true,
  provider: 'email',
  createdAt: '2023-01-01T00:00:00Z',
  lastSignInAt: '2023-01-01T00:00:00Z'
});

// ============================================================================
// AUTH BRIDGE TESTS
// ============================================================================

describe('AuthBridge', () => {
  let authBridge: AuthBridge;
  let mockNavigation: MockNavigationService;
  let mockQueryClient: MockQueryClientService;
  let mockOutbox: MockOutboxService;
  let mockTimers: MockTimerService;

  beforeEach(() => {
    resetAuthBridge();
    
    mockNavigation = new MockNavigationService();
    mockQueryClient = new MockQueryClientService();
    mockOutbox = new MockOutboxService();
    mockTimers = new MockTimerService();

    authBridge = new AuthBridge(
      mockNavigation,
      mockQueryClient,
      mockOutbox,
      mockTimers
    );
  });

  afterEach(() => {
    mockNavigation.reset();
    mockQueryClient.reset();
    mockOutbox.reset();
    mockTimers.reset();
  });

  describe('initialization', () => {
    it('sollte Bridge korrekt initialisieren', async () => {
      expect(authBridge.isReady()).toBe(false);
      
      await authBridge.initialize();
      
      expect(authBridge.isReady()).toBe(true);
    });

    it('sollte mehrfache Initialisierung vermeiden', async () => {
      await authBridge.initialize();
      await authBridge.initialize();
      
      expect(authBridge.isReady()).toBe(true);
    });
  });

  describe('auth state change callbacks', () => {
    it('sollte Callbacks registrieren und aufrufen', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = authBridge.onAuthStateChange(callback1);
      const unsubscribe2 = authBridge.onAuthStateChange(callback2);

      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);

      expect(callback1).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN',
          user,
          isAuthenticated: true
        })
      );
      expect(callback2).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN',
          user,
          isAuthenticated: true
        })
      );

      // Cleanup testen
      unsubscribe1();
      await authBridge.notifyAuthStateChange('LOGOUT', null);

      expect(callback1).toHaveBeenCalledTimes(1); // Nicht nochmal aufgerufen
      expect(callback2).toHaveBeenCalledTimes(2); // Zweimal aufgerufen
    });

    it('sollte Fehler in Callbacks abfangen', async () => {
      const errorCallback = jest.fn().mockRejectedValue(new Error('Callback error'));
      const workingCallback = jest.fn();

      authBridge.onAuthStateChange(errorCallback);
      authBridge.onAuthStateChange(workingCallback);

      const user = createMockUser();
      
      // Sollte nicht werfen trotz Fehler im ersten Callback
      await expect(authBridge.notifyAuthStateChange('LOGIN', user)).resolves.toBeUndefined();

      expect(errorCallback).toHaveBeenCalled();
      expect(workingCallback).toHaveBeenCalled();
    });
  });

  describe('login handling', () => {
    it('sollte Login korrekt verarbeiten', async () => {
      await authBridge.initialize();
      
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);

      // User-Scoped Queries sollten invalidiert werden
      expect(mockQueryClient.invalidatedUserScopes).toContain('user-123');
      
      // Outbox sollte fortgesetzt werden
      expect(mockOutbox.isPaused).toBe(false);
      
      // Timer sollten gestartet werden
      expect(mockTimers.startedTimers).toContain('user-123');
      
      // Navigation zur App
      expect(mockNavigation.currentRoute).toBe('/app/breath');
    });

    it('sollte Identity-Wechsel beim Login erkennen', async () => {
      await authBridge.initialize();
      
      // Erst User A anmelden
      const userA = createMockUser('user-a', 'a@example.com');
      await authBridge.notifyAuthStateChange('LOGIN', userA);
      
      // Dann User B anmelden (Identity-Wechsel)
      const userB = createMockUser('user-b', 'b@example.com');
      await authBridge.notifyAuthStateChange('LOGIN', userB);

      // Alte User-Daten sollten gelöscht werden
      expect(mockOutbox.clearedUserData).toContain('user-a');
      
      // Neue User-Queries sollten invalidiert werden
      expect(mockQueryClient.invalidatedUserScopes).toContain('user-b');
    });

    it('sollte Navigation nicht überschreiben wenn bereits in App', async () => {
      mockNavigation.currentRoute = '/app/journal';
      await authBridge.initialize();
      
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);

      // Route sollte gleich bleiben
      expect(mockNavigation.currentRoute).toBe('/app/journal');
    });
  });

  describe('logout handling', () => {
    it('sollte Logout korrekt verarbeiten', async () => {
      await authBridge.initialize();
      
      // Erst anmelden
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);
      
      // Dann abmelden
      await authBridge.notifyAuthStateChange('LOGOUT', null);

      // Timer sollten gestoppt werden
      expect(mockTimers.stoppedTimers).toBe(1);
      
      // Outbox sollte pausiert werden
      expect(mockOutbox.isPaused).toBe(true);
      
      // Sensitive Caches sollten gelöscht werden
      expect(mockQueryClient.clearedSensitiveCaches).toBe(1);
      
      // Navigation zur Auth
      expect(mockNavigation.currentRoute).toBe('/auth/welcome');
    });

    it('sollte User-Daten beim Logout optional löschen', async () => {
      await authBridge.initialize();
      
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);
      await authBridge.notifyAuthStateChange('LOGOUT', null);

      // User-Daten sollten aus Outbox gelöscht werden
      expect(mockOutbox.clearedUserData).toContain('user-123');
    });
  });

  describe('token refresh handling', () => {
    it('sollte Token-Refresh ohne Identity-Wechsel minimal verarbeiten', async () => {
      await authBridge.initialize();
      
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);
      
      // Reset Mocks
      mockQueryClient.reset();
      mockOutbox.reset();
      
      // Token Refresh für gleichen User
      await authBridge.notifyAuthStateChange('TOKEN_REFRESH', user);

      // Keine großen Cache-Operationen bei gleichem User
      expect(mockQueryClient.clearedSensitiveCaches).toBe(0);
      expect(mockQueryClient.invalidatedUserScopes).toHaveLength(0);
      expect(mockOutbox.clearedUserData).toHaveLength(0);
    });

    it('sollte Identity-Wechsel bei Token-Refresh erkennen', async () => {
      await authBridge.initialize();
      
      const userA = createMockUser('user-a');
      await authBridge.notifyAuthStateChange('LOGIN', userA);
      
      // Reset Mocks
      mockQueryClient.reset();
      mockOutbox.reset();
      
      // Token Refresh für anderen User (Identity-Wechsel)
      const userB = createMockUser('user-b');
      await authBridge.notifyAuthStateChange('TOKEN_REFRESH', userB);

      // Alte User-Daten löschen, neue invalidieren
      expect(mockOutbox.clearedUserData).toContain('user-a');
      expect(mockQueryClient.invalidatedUserScopes).toContain('user-b');
    });
  });

  describe('state management', () => {
    it('sollte Auth-State korrekt verwalten', async () => {
      await authBridge.initialize();
      
      // Initial State
      let state = authBridge.getCurrentAuthState();
      expect(state?.isAuthenticated).toBe(false);
      expect(state?.user).toBeNull();
      
      // Nach Login
      const user = createMockUser();
      await authBridge.notifyAuthStateChange('LOGIN', user);
      
      state = authBridge.getCurrentAuthState();
      expect(state?.isAuthenticated).toBe(true);
      expect(state?.user).toEqual(user);
      
      // Nach Logout
      await authBridge.notifyAuthStateChange('LOGOUT', null);
      
      state = authBridge.getCurrentAuthState();
      expect(state?.isAuthenticated).toBe(false);
      expect(state?.user).toBeNull();
    });

    it('sollte Bridge reset korrekt verarbeiten', () => {
      const callback = jest.fn();
      authBridge.onAuthStateChange(callback);
      
      authBridge.reset();
      
      expect(authBridge.isReady()).toBe(false);
      expect(authBridge.getCurrentAuthState()).toBeNull();
    });
  });
});

// ============================================================================
// NAVIGATION GUARDS TESTS
// ============================================================================

describe('AuthGuard', () => {
  let authGuard: AuthGuard;

  beforeEach(() => {
    // Mock AuthService und AuthBridge würden hier gesetzt
    authGuard = new AuthGuard();
  });

  describe('route protection', () => {
    it('sollte Auth-Required Routes für nicht-authentifizierte User blockieren', async () => {
      const result = await authGuard.canNavigate('/app/breath', {
        isAuthenticated: false,
        user: null
      });

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/auth/welcome');
      expect(result.reason).toBe('Authentication required');
    });

    it('sollte Guest-Only Routes für authentifizierte User blockieren', async () => {
      const user = createMockUser();
      const result = await authGuard.canNavigate('/auth/login', {
        isAuthenticated: true,
        user
      });

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/app/breath');
      expect(result.reason).toBe('Already authenticated');
    });

    it('sollte gültige Navigation erlauben', async () => {
      const user = createMockUser();
      const result = await authGuard.canNavigate('/app/breath', {
        isAuthenticated: true,
        user
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Navigation allowed');
    });

    it('sollte unbekannte Routen behandeln', async () => {
      const result = await authGuard.canNavigate('/unknown/route');

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/auth/welcome');
      expect(result.reason).toBe('Route not found');
    });

    it('sollte Loading-State erlauben', async () => {
      const result = await authGuard.canNavigate('/app/breath', {
        isLoading: true
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Loading auth state');
    });
  });
});

// ============================================================================
// NAVIGATION REDIRECTOR TESTS  
// ============================================================================

describe('AuthRedirector', () => {
  let authRedirector: AuthRedirector;
  let mockNavigation: MockNavigationService;

  beforeEach(() => {
    mockNavigation = new MockNavigationService();
    authRedirector = new AuthRedirector(mockNavigation);
  });

  afterEach(() => {
    mockNavigation.reset();
  });

  describe('login redirects', () => {
    it('sollte nach Login zur Default-App-Route weiterleiten', async () => {
      const result = await authRedirector.handleLoginSuccess();

      expect(result).toBe('/app/breath');
      expect(mockNavigation.currentRoute).toBe('/app/breath');
    });

    it('sollte zur intended Route weiterleiten wenn erlaubt', async () => {
      // Mock dass Route erlaubt ist
      jest.spyOn(AuthGuard.prototype, 'canNavigate').mockResolvedValue({
        allowed: true,
        reason: 'Navigation allowed'
      });

      const result = await authRedirector.handleLoginSuccess('/app/journal');

      expect(result).toBe('/app/journal');
      expect(mockNavigation.currentRoute).toBe('/app/journal');
    });

    it('sollte zur Default-Route weiterleiten wenn intended Route nicht erlaubt', async () => {
      // Mock dass Route nicht erlaubt ist
      jest.spyOn(AuthGuard.prototype, 'canNavigate').mockResolvedValue({
        allowed: false,
        redirectTo: '/auth/welcome'
      });

      const result = await authRedirector.handleLoginSuccess('/admin/panel');

      expect(result).toBe('/app/breath');
      expect(mockNavigation.currentRoute).toBe('/app/breath');
    });
  });

  describe('logout redirects', () => {
    it('sollte nach Logout zur Auth-Route weiterleiten', async () => {
      const result = await authRedirector.handleLogoutSuccess();

      expect(result).toBe('/auth/welcome');
      expect(mockNavigation.currentRoute).toBe('/auth/welcome');
    });
  });

  describe('deep link handling', () => {
    it('sollte erlaubte Deep-Links weiterleiten', async () => {
      jest.spyOn(AuthGuard.prototype, 'canNavigate').mockResolvedValue({
        allowed: true
      });

      const result = await authRedirector.handleDeepLink('/app/gratitude');

      expect(result).toBe('/app/gratitude');
      expect(mockNavigation.currentRoute).toBe('/app/gratitude');
    });

    it('sollte nicht-erlaubte Deep-Links umleiten', async () => {
      jest.spyOn(AuthGuard.prototype, 'canNavigate').mockResolvedValue({
        allowed: false,
        redirectTo: '/auth/welcome'
      });

      const result = await authRedirector.handleDeepLink('/app/settings');

      expect(result).toBe('/auth/welcome');
      expect(mockNavigation.currentRoute).toBe('/auth/welcome');
    });
  });
});

// ============================================================================
// QUERY CLIENT BRIDGE TESTS
// ============================================================================

describe('QueryClientBridge', () => {
  let queryClient: QueryClient;
  let queryClientBridge: QueryClientBridge;

  beforeEach(() => {
    resetQueryClientBridge();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    queryClientBridge = new QueryClientBridge(queryClient);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('cache clearing', () => {
    it('sollte sensitive Caches löschen', async () => {
      // Füge Test-Queries hinzu
      queryClient.setQueryData(['diary', 'user-123', 'list'], { items: [] });
      queryClient.setQueryData(['breathing-methods', 'all'], { methods: [] });
      queryClient.setQueryData(['gratitude', 'user-123', 'list'], { items: [] });

      await queryClientBridge.clearSensitiveCaches();

      // Sensitive Daten sollten weg sein
      expect(queryClient.getQueryData(['diary', 'user-123', 'list'])).toBeUndefined();
      expect(queryClient.getQueryData(['gratitude', 'user-123', 'list'])).toBeUndefined();
      
      // Statische Daten sollten bleiben
      expect(queryClient.getQueryData(['breathing-methods', 'all'])).toBeDefined();
    });

    it('sollte User-Scoped Queries invalidieren', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      
      await queryClientBridge.invalidateUserScopedQueries('user-123');

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          predicate: expect.any(Function)
        })
      );
    });

    it('sollte kompletten Reset durchführen', async () => {
      queryClient.setQueryData(['test'], { data: 'test' });
      
      await queryClientBridge.resetQueryClient();
      
      expect(queryClient.getQueryData(['test'])).toBeUndefined();
    });
  });

  describe('cache statistics', () => {
    it('sollte Cache-Statistiken korrekt berechnen', () => {
      // Test-Queries hinzufügen
      queryClient.setQueryData(['diary', 'user-123'], {});
      queryClient.setQueryData(['breathing-methods'], {});
      queryClient.setQueryData(['gratitude', 'user-456'], {});
      queryClient.setQueryData(['app-config'], {});

      const stats = queryClientBridge.getCacheStats();

      expect(stats.totalQueries).toBe(4);
      expect(stats.sensitiveQueries).toBeGreaterThan(0);
      expect(stats.staticQueries).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: Auth Bridge + Navigation + Query Client', () => {
  let authBridge: AuthBridge;
  let mockNavigation: MockNavigationService;
  let queryClient: QueryClient;
  let queryClientBridge: QueryClientBridge;

  beforeEach(() => {
    resetAuthBridge();
    resetQueryClientBridge();
    
    mockNavigation = new MockNavigationService();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    queryClientBridge = new QueryClientBridge(queryClient);

    authBridge = new AuthBridge(
      mockNavigation,
      queryClientBridge,
      new MockOutboxService(),
      new MockTimerService()
    );
  });

  it('sollte vollständigen Login-Flow korrekt verarbeiten', async () => {
    await authBridge.initialize();

    // Test-Daten setzen
    queryClient.setQueryData(['diary', 'old-user', 'list'], { items: ['old'] });
    queryClient.setQueryData(['breathing-methods'], { methods: ['method1'] });

    const user = createMockUser();
    await authBridge.notifyAuthStateChange('LOGIN', user);

    // Navigation sollte zur App erfolgen
    expect(mockNavigation.currentRoute).toBe('/app/breath');
    
    // Statische Daten sollten erhalten bleiben
    expect(queryClient.getQueryData(['breathing-methods'])).toBeDefined();
  });

  it('sollte vollständigen Logout-Flow korrekt verarbeiten', async () => {
    await authBridge.initialize();
    
    // Login erst
    const user = createMockUser();
    await authBridge.notifyAuthStateChange('LOGIN', user);
    
    // Test-Daten setzen
    queryClient.setQueryData(['diary', 'user-123', 'list'], { items: ['private'] });
    queryClient.setQueryData(['breathing-methods'], { methods: ['method1'] });
    
    // Logout
    await authBridge.notifyAuthStateChange('LOGOUT', null);

    // Navigation sollte zur Auth erfolgen
    expect(mockNavigation.currentRoute).toBe('/auth/welcome');
    
    // Sensitive Daten sollten weg sein
    expect(queryClient.getQueryData(['diary', 'user-123', 'list'])).toBeUndefined();
    
    // Statische Daten sollten bleiben
    expect(queryClient.getQueryData(['breathing-methods'])).toBeDefined();
  });
});
