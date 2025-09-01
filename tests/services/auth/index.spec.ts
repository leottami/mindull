/**
 * Auth Services - Gebündelte Test-Suite
 * Testet alle Auth-Komponenten: Service, Bridge, Apple Flow, Error Mapping
 */

import { AuthService } from '../../../services/auth/auth.service';
import { AuthBridge } from '../../../services/auth/auth.bridge';
import { TokenStore } from '../../../services/auth/token.store';
import { AppleSSOFlow } from '../../../services/auth/apple.flow';
import { AuthErrorMapper } from '../../../lib/errors/auth.map';
import { AuthErrorCode, AuthError } from '../../../services/auth/types';

// ============================================================================
// MOCKS
// ============================================================================

const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn()
  }
};

const mockKeychain = {
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn()
};

const mockQueryClient = {
  clear: jest.fn(),
  invalidateQueries: jest.fn(),
  removeQueries: jest.fn()
};

const mockOutboxService = {
  pause: jest.fn(),
  resume: jest.fn()
};

jest.mock('../../../services/db/supabase.client', () => ({
  supabase: mockSupabase
}));

jest.mock('react-native-keychain', () => mockKeychain);

jest.mock('../../../data/queryClient', () => ({
  queryClient: mockQueryClient
}));

jest.mock('../../../services/offline/outbox.service', () => ({
  getOutboxService: () => mockOutboxService
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

const createMockUser = (overrides: any = {}) => ({
  id: 'test_user_123',
  email: 'test@example.com',
  emailVerified: true,
  createdAt: new Date().toISOString(),
  ...overrides
});

const createMockSession = (overrides: any = {}) => ({
  accessToken: 'mock_access_token',
  refreshToken: 'mock_refresh_token',
  expiresAt: Date.now() + 3600000,
  user: createMockUser(),
  ...overrides
});

const createMockAuthError = (code: AuthErrorCode, message?: string): AuthError => ({
  code,
  message: message || 'Test error',
  timestamp: Date.now()
});

// ============================================================================
// AUTH SERVICE TESTS
// ============================================================================

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('Email/Password Authentication', () => {
    it('sollte erfolgreichen Sign-Up durchführen', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'securePassword123'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('sollte erfolgreichen Sign-In durchführen', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'securePassword123'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('sollte Sign-In-Fehler behandeln', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe('Apple SSO', () => {
    it('sollte Apple Sign-In durchführen', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await authService.signInWithApple({
        identityToken: 'mock_identity_token',
        authorizationCode: 'mock_auth_code',
        nonce: 'mock_nonce',
        email: 'test@privaterelay.appleid.com'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('sollte Apple Sign-In-Fehler behandeln', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Apple Sign In failed' }
      });

      const result = await authService.signInWithApple({
        identityToken: 'invalid_token',
        authorizationCode: 'invalid_code',
        nonce: 'invalid_nonce'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('sollte Session erfolgreich erneuern', async () => {
      const mockSession = createMockSession();
      
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('sollte Session-Erneuerung-Fehler behandeln', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' }
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AuthErrorCode.REFRESH_FAILED);
    });

    it('sollte erfolgreichen Logout durchführen', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      const result = await authService.signOut();

      expect(result.success).toBe(true);
    });
  });

  describe('Auth State Management', () => {
    it('sollte Auth-State-Änderungen registrieren', () => {
      const mockCallback = jest.fn();
      
      authService.onAuthStateChange(mockCallback);
      
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('sollte aktuellen Auth-State abrufen', async () => {
      const mockSession = createMockSession();
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const session = await authService.getCurrentSession();

      expect(session).toEqual(mockSession);
    });
  });
});

// ============================================================================
// TOKEN STORE TESTS
// ============================================================================

describe('TokenStore', () => {
  let tokenStore: TokenStore;

  beforeEach(() => {
    tokenStore = TokenStore.getInstance();
    tokenStore.reset();
    jest.clearAllMocks();
  });

  describe('Token Storage', () => {
    it('sollte Access Token im Memory speichern', async () => {
      const accessToken = 'test_access_token';
      
      await tokenStore.setAccessToken(accessToken);
      const storedToken = await tokenStore.getAccessToken();

      expect(storedToken).toBe(accessToken);
    });

    it('sollte Refresh Token im Keychain speichern', async () => {
      const refreshToken = 'test_refresh_token';
      
      mockKeychain.setInternetCredentials.mockResolvedValue(true);
      mockKeychain.getInternetCredentials.mockResolvedValue({
        username: 'refresh_token',
        password: refreshToken
      });

      await tokenStore.setRefreshToken(refreshToken);
      const storedToken = await tokenStore.getRefreshToken();

      expect(storedToken).toBe(refreshToken);
      expect(mockKeychain.setInternetCredentials).toHaveBeenCalledWith(
        'mindull_refresh_token',
        'refresh_token',
        refreshToken
      );
    });

    it('sollte alle Tokens löschen', async () => {
      await tokenStore.setAccessToken('test_access');
      await tokenStore.setRefreshToken('test_refresh');
      
      mockKeychain.resetInternetCredentials.mockResolvedValue(true);
      
      await tokenStore.clear();

      const accessToken = await tokenStore.getAccessToken();
      const refreshToken = await tokenStore.getRefreshToken();

      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();
      expect(mockKeychain.resetInternetCredentials).toHaveBeenCalledWith(
        'mindull_refresh_token'
      );
    });
  });

  describe('Token Validation', () => {
    it('sollte gültige Tokens erkennen', async () => {
      const validToken = 'valid_token';
      await tokenStore.setAccessToken(validToken);

      const isValid = await tokenStore.hasValidAccessToken();

      expect(isValid).toBe(true);
    });

    it('sollte ungültige Tokens erkennen', async () => {
      const isValid = await tokenStore.hasValidAccessToken();

      expect(isValid).toBe(false);
    });
  });
});

// ============================================================================
// AUTH BRIDGE TESTS
// ============================================================================

describe('AuthBridge', () => {
  let authBridge: AuthBridge;

  beforeEach(() => {
    authBridge = AuthBridge.getInstance();
    authBridge.reset();
    jest.clearAllMocks();
  });

  describe('Event Handling', () => {
    it('sollte Auth-Events an Listener weiterleiten', () => {
      const mockListener = jest.fn();
      
      authBridge.subscribe(mockListener);
      
      // Simuliere Auth-Event
      authBridge['emit']('SIGNED_IN', { user: createMockUser() });

      expect(mockListener).toHaveBeenCalledWith('SIGNED_IN', { user: createMockUser() });
    });

    it('sollte Listener korrekt entfernen', () => {
      const mockListener = jest.fn();
      
      const unsubscribe = authBridge.subscribe(mockListener);
      unsubscribe();
      
      authBridge['emit']('SIGNED_OUT', {});
      
      expect(mockListener).not.toHaveBeenCalled();
    });

    it('sollte mehrere Listener unterstützen', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      authBridge.subscribe(listener1);
      authBridge.subscribe(listener2);
      
      authBridge['emit']('SIGNED_IN', { user: createMockUser() });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Integration mit AuthService', () => {
    it('sollte AuthService-Events abonnieren', () => {
      const mockAuthService = {
        onAuthStateChange: jest.fn()
      };

      authBridge['subscribeToAuthService'](mockAuthService as any);

      expect(mockAuthService.onAuthStateChange).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// APPLE SSO FLOW TESTS
// ============================================================================

describe('AppleSSOFlow', () => {
  let appleFlow: AppleSSOFlow;

  beforeEach(() => {
    appleFlow = new AppleSSOFlow();
    jest.clearAllMocks();
  });

  describe('Sign-In Flow', () => {
    it('sollte Apple Sign-In starten', async () => {
      const { nonce, config } = await appleFlow.startSignIn('signin');

      expect(nonce).toBeDefined();
      expect(config.clientId).toBe('com.mindull.app');
      expect(config.scope).toContain('name');
      expect(config.scope).toContain('email');
    });

    it('sollte Apple Response verarbeiten', async () => {
      const mockResponse = {
        identityToken: 'mock_identity_token',
        authorizationCode: 'mock_auth_code',
        nonce: 'mock_nonce',
        email: 'test@privaterelay.appleid.com'
      };

      const mockUser = createMockUser();
      const mockAuthService = {
        signInWithApple: jest.fn().mockResolvedValue({
          user: mockUser,
          isNewUser: true
        })
      };

      appleFlow['authService'] = mockAuthService as any;

      const result = await appleFlow.handleSignInResponse(mockResponse, 'signin');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });
  });

  describe('Private Relay Handling', () => {
    it('sollte Private Relay E-Mails erkennen', () => {
      const privateRelayEmail = 'user@privaterelay.appleid.com';
      const normalEmail = 'user@gmail.com';

      expect(appleFlow['isPrivateRelay'](privateRelayEmail)).toBe(true);
      expect(appleFlow['isPrivateRelay'](normalEmail)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('sollte Apple Abbruch behandeln', () => {
      const error = appleFlow.handleCancellation();

      expect(error.code).toBe(AuthErrorCode.APPLE_CANCELLED);
      expect(error.message).toContain('cancelled');
    });

    it('sollte allgemeine Apple-Fehler behandeln', () => {
      const mockError = new Error('Apple API error');
      const error = appleFlow.handleError(mockError);

      expect(error).toBeDefined();
      expect(error.code).toBe(AuthErrorCode.APPLE_FAILED);
    });
  });
});

// ============================================================================
// ERROR MAPPING TESTS
// ============================================================================

describe('AuthErrorMapper', () => {
  let errorMapper: AuthErrorMapper;

  beforeEach(() => {
    errorMapper = new AuthErrorMapper();
    jest.clearAllMocks();
  });

  describe('Supabase Error Mapping', () => {
    it('sollte Supabase-Fehler korrekt mappen', () => {
      const supabaseError = {
        message: 'Invalid login credentials',
        code: 'invalid_credentials'
      };

      const result = errorMapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
    });

    it('sollte Network-Fehler mappen', () => {
      const networkError = {
        message: 'Network request failed',
        code: 'network_error'
      };

      const result = errorMapper.mapNetworkError(networkError);

      expect(result.code).toBe(AuthErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.');
    });
  });

  describe('Retry Logic', () => {
    it('sollte Retry-Counter verwalten', () => {
      const context = 'login_attempt';
      
      expect(errorMapper.canRetry(context)).toBe(true);
      
      errorMapper.recordRetry(context);
      expect(errorMapper.canRetry(context)).toBe(true);
      
      errorMapper.recordRetry(context);
      errorMapper.recordRetry(context);
      expect(errorMapper.canRetry(context)).toBe(false);
    });

    it('sollte Retry-Counter zurücksetzen', () => {
      const context = 'login_attempt';
      
      errorMapper.recordRetry(context);
      errorMapper.recordRetry(context);
      
      errorMapper.resetRetryCount(context);
      expect(errorMapper.canRetry(context)).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Auth Integration', () => {
  let authService: AuthService;
  let authBridge: AuthBridge;
  let tokenStore: TokenStore;

  beforeEach(() => {
    authService = new AuthService();
    authBridge = AuthBridge.getInstance();
    tokenStore = TokenStore.getInstance();
    
    authBridge.reset();
    tokenStore.reset();
    jest.clearAllMocks();
  });

  it('sollte vollständigen Auth-Flow simulieren', async () => {
    // 1. Sign-Up
    const mockUser = createMockUser();
    const mockSession = createMockSession({ user: mockUser });
    
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    });

    const signUpResult = await authService.signUp({
      email: 'test@example.com',
      password: 'securePassword123'
    });

    expect(signUpResult.success).toBe(true);

    // 2. Tokens speichern
    await tokenStore.setAccessToken(mockSession.accessToken);
    await tokenStore.setRefreshToken(mockSession.refreshToken);

    const storedAccessToken = await tokenStore.getAccessToken();
    expect(storedAccessToken).toBe(mockSession.accessToken);

    // 3. Auth-Bridge Event
    const mockListener = jest.fn();
    authBridge.subscribe(mockListener);

    authBridge['emit']('SIGNED_IN', { user: mockUser });

    expect(mockListener).toHaveBeenCalledWith('SIGNED_IN', { user: mockUser });

    // 4. Logout
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const logoutResult = await authService.signOut();

    expect(logoutResult.success).toBe(true);

    // 5. Tokens löschen
    await tokenStore.clear();

    const clearedAccessToken = await tokenStore.getAccessToken();
    expect(clearedAccessToken).toBeNull();
  });

  it('sollte Apple SSO Integration testen', async () => {
    const appleFlow = new AppleSSOFlow();
    
    // 1. Apple Sign-In starten
    const { nonce, config } = await appleFlow.startSignIn('signin');
    expect(nonce).toBeDefined();

    // 2. Mock Apple Response
    const mockResponse = {
      identityToken: 'mock_identity_token',
      authorizationCode: 'mock_auth_code',
      nonce,
      email: 'test@privaterelay.appleid.com'
    };

    // 3. Supabase Apple Sign-In
    const mockUser = createMockUser();
    const mockSession = createMockSession({ user: mockUser });
    
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    });

    const result = await authService.signInWithApple({
      identityToken: mockResponse.identityToken,
      authorizationCode: mockResponse.authorizationCode,
      nonce: mockResponse.nonce,
      email: mockResponse.email
    });

    expect(result.success).toBe(true);
    expect(result.user).toEqual(mockUser);
  });

  it('sollte Error-Handling Integration testen', async () => {
    const errorMapper = new AuthErrorMapper();
    
    // 1. Supabase Error
    const supabaseError = {
      message: 'Invalid login credentials',
      code: 'invalid_credentials'
    };

    const mappedError = errorMapper.mapSupabaseError(supabaseError);
    expect(mappedError.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);

    // 2. Retry Logic
    const context = 'login_attempt';
    errorMapper.recordRetry(context);
    
    const retryStats = errorMapper.getRetryStats();
    expect(retryStats[context]).toBe(1);

    // 3. Error in Auth Service
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' }
    });

    const result = await authService.signIn({
      email: 'test@example.com',
      password: 'wrongpassword'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Auth Performance', () => {
  it('sollte schnelle Token-Operationen durchführen', async () => {
    const tokenStore = TokenStore.getInstance();
    const startTime = Date.now();

    await tokenStore.setAccessToken('test_token');
    const token = await tokenStore.getAccessToken();
    await tokenStore.clear();

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(token).toBe('test_token');
    expect(duration).toBeLessThan(100); // Sollte unter 100ms sein
  });

  it('sollte schnelle Error-Mapping durchführen', () => {
    const errorMapper = new AuthErrorMapper();
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      const error = {
        message: 'Invalid login credentials',
        code: 'invalid_credentials'
      };
      errorMapper.mapSupabaseError(error);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(50); // Sollte unter 50ms für 100 Mappings sein
  });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('Auth Security', () => {
  it('sollte keine PII in Error-Messages enthalten', () => {
    const errorMapper = new AuthErrorMapper();
    
    const errorWithEmail = {
      message: 'Login failed for user@example.com',
      code: 'login_failed'
    };

    const mappedError = errorMapper.mapSupabaseError(errorWithEmail);
    
    expect(mappedError.message).not.toContain('user@example.com');
    expect(mappedError.message).not.toContain('@');
  });

  it('sollte Tokens sicher speichern', async () => {
    const tokenStore = TokenStore.getInstance();
    const sensitiveToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

    await tokenStore.setAccessToken(sensitiveToken);
    
    // Access Token sollte nur im Memory sein
    const storedToken = await tokenStore.getAccessToken();
    expect(storedToken).toBe(sensitiveToken);

    // Refresh Token sollte im Keychain sein
    await tokenStore.setRefreshToken(sensitiveToken);
    expect(mockKeychain.setInternetCredentials).toHaveBeenCalledWith(
      'mindull_refresh_token',
      'refresh_token',
      sensitiveToken
    );
  });
});
