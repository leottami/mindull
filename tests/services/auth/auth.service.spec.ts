/**
 * Auth Service Unit Tests
 * Testet Happy Paths (Email/Apple), Timeout/Offline, 401-Refresh, 
 * Secure-Storage-Fehler, Abbruch Apple gemäß AUTH.BRIEF
 */

import { AuthService, MockTelemetry, resetAuthService } from '../../../services/auth/auth.service';
import { TokenStore, MockSecureStorage, resetTokenStore } from '../../../services/auth/token.store';
import { AuthRateLimiter } from '../../../services/auth/policies';
import { 
  AuthErrorCode, 
  AuthEvent, 
  SignUpRequest, 
  LoginRequest, 
  AppleSignInRequest,
  PasswordResetRequest 
} from '../../../services/auth/types';

// Mock Supabase Client
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithIdToken: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    getUser: jest.fn(),
    refreshSession: jest.fn()
  }
};

jest.mock('../../../services/db/supabase.client', () => ({
  supabase: mockSupabase
}));

describe('AuthService', () => {
  let authService: AuthService;
  let tokenStore: TokenStore;
  let secureStorage: MockSecureStorage;
  let telemetry: MockTelemetry;
  let rateLimiter: AuthRateLimiter;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    email_confirmed_at: '2023-01-01T00:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
    last_sign_in_at: '2023-01-01T00:00:00Z',
    app_metadata: { provider: 'email' }
  };

  const mockSession = {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-123',
    expires_in: 3600,
    user: mockUser
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthService();
    resetTokenStore();
    
    secureStorage = new MockSecureStorage();
    tokenStore = new TokenStore(secureStorage);
    telemetry = new MockTelemetry();
    rateLimiter = new AuthRateLimiter();
    
    authService = new AuthService(tokenStore, telemetry);
  });

  afterEach(() => {
    secureStorage.clear();
    telemetry.reset();
    rateLimiter.reset();
  });

  describe('signUp', () => {
    it('sollte erfolgreich einen Benutzer registrieren', async () => {
      // Arrange
      const request: SignUpRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Act
      const result = await authService.signUp(request);

      // Assert
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        provider: 'email',
        createdAt: '2023-01-01T00:00:00Z',
        lastSignInAt: '2023-01-01T00:00:00Z'
      });

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123',
        options: { emailRedirectTo: undefined }
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.SIGNUP_SUCCESS })
      );
    });

    it('sollte bei ungültiger E-Mail einen Fehler werfen', async () => {
      // Arrange
      const request: SignUpRequest = {
        email: 'invalid-email',
        password: 'SecurePass123'
      };

      // Act & Assert
      await expect(authService.signUp(request)).rejects.toMatchObject({
        code: AuthErrorCode.INVALID_EMAIL,
        message: 'Ungültige E-Mail-Adresse'
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ 
          event: AuthEvent.SIGNUP_FAIL,
          properties: { error: AuthErrorCode.INVALID_EMAIL }
        })
      );
    });

    it('sollte bei schwachem Passwort einen Fehler werfen', async () => {
      // Arrange
      const request: SignUpRequest = {
        email: 'test@example.com',
        password: '123'
      };

      // Act & Assert
      await expect(authService.signUp(request)).rejects.toMatchObject({
        code: AuthErrorCode.WEAK_PASSWORD
      });

      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('sollte bei Supabase-Fehler einen gemappten Fehler werfen', async () => {
      // Arrange
      const request: SignUpRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' }
      });

      // Act & Assert
      await expect(authService.signUp(request)).rejects.toMatchObject({
        code: AuthErrorCode.USER_ALREADY_EXISTS,
        message: 'Benutzer bereits registriert'
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ 
          event: AuthEvent.SIGNUP_FAIL,
          properties: { error: AuthErrorCode.USER_ALREADY_EXISTS }
        })
      );
    });
  });

  describe('signIn', () => {
    it('sollte erfolgreich einen Benutzer anmelden', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null
      });

      // Act
      const result = await authService.signIn(request);

      // Assert
      expect(result).toMatchObject({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        user: expect.objectContaining({
          email: 'test@example.com'
        })
      });

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123'
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.LOGIN_SUCCESS })
      );

      // Token sollten gespeichert werden
      expect(tokenStore.getAccessToken()).toBe('access-token-123');
      const refreshToken = await tokenStore.getRefreshToken();
      expect(refreshToken).toBe('refresh-token-123');
    });

    it('sollte bei ungültigen Anmeldedaten einen Fehler werfen', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' }
      });

      // Act & Assert
      await expect(authService.signIn(request)).rejects.toMatchObject({
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Ungültige Anmeldedaten'
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ 
          event: AuthEvent.LOGIN_FAIL,
          properties: { error: AuthErrorCode.INVALID_CREDENTIALS }
        })
      );
    });

    it('sollte Rate-Limiting respektieren', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      // Simuliere 5 fehlgeschlagene Versuche
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailedAttempt(request.email);
      }

      // Act & Assert
      await expect(authService.signIn(request)).rejects.toMatchObject({
        code: AuthErrorCode.TOO_MANY_REQUESTS,
        message: 'Zu viele Versuche'
      });

      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('signInWithApple', () => {
    it('sollte erfolgreich mit Apple SSO anmelden', async () => {
      // Arrange
      const request: AppleSignInRequest = {
        identityToken: 'apple-id-token',
        authorizationCode: 'apple-auth-code',
        nonce: 'apple-nonce',
        email: 'test@privaterelay.appleid.com'
      };

      const appleUser = {
        ...mockUser,
        app_metadata: { provider: 'apple' }
      };

      mockSupabase.auth.signInWithIdToken.mockResolvedValue({
        data: { session: { ...mockSession, user: appleUser }, user: appleUser },
        error: null
      });

      // Act
      const result = await authService.signInWithApple(request);

      // Assert
      expect(result).toMatchObject({
        accessToken: 'access-token-123',
        user: expect.objectContaining({
          provider: 'apple'
        })
      });

      expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'apple',
        token: 'apple-id-token',
        nonce: 'apple-nonce'
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.APPLE_SUCCESS })
      );
    });

    it('sollte bei ungültigem Apple Token einen Fehler werfen', async () => {
      // Arrange
      const request: AppleSignInRequest = {
        identityToken: '',
        authorizationCode: 'apple-auth-code',
        nonce: 'apple-nonce'
      };

      // Act & Assert
      await expect(authService.signInWithApple(request)).rejects.toMatchObject({
        code: AuthErrorCode.APPLE_INVALID_TOKEN,
        message: 'Ungültiges Apple Token'
      });

      expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ 
          event: AuthEvent.APPLE_FAIL,
          properties: { error: AuthErrorCode.APPLE_INVALID_TOKEN }
        })
      );
    });

    it('sollte Apple-Abbruch behandeln', async () => {
      // Arrange
      const request: AppleSignInRequest = {
        identityToken: 'apple-id-token',
        authorizationCode: 'apple-auth-code',
        nonce: 'apple-nonce'
      };

      mockSupabase.auth.signInWithIdToken.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'User cancelled Apple Sign In' }
      });

      // Act & Assert
      await expect(authService.signInWithApple(request)).rejects.toMatchObject({
        code: AuthErrorCode.APPLE_FAILED
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.APPLE_FAIL })
      );
    });
  });

  describe('signOut', () => {
    it('sollte erfolgreich abmelden und Token löschen', async () => {
      // Arrange
      await tokenStore.setTokens('access-token', 'refresh-token', Date.now() + 3600000);
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      // Act
      await authService.signOut();

      // Assert
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(tokenStore.getAccessToken()).toBeNull();
      
      const refreshToken = await tokenStore.getRefreshToken();
      expect(refreshToken).toBeNull();

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.LOGOUT })
      );

      const authState = authService.getAuthState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
    });
  });

  describe('refreshSession', () => {
    it('sollte Session erfolgreich erneuern', async () => {
      // Arrange
      await tokenStore.setTokens('old-access-token', 'refresh-token-123', Date.now() + 3600000);

      const newSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        user: mockUser
      };

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: newSession, user: mockUser },
        error: null
      });

      // Act
      const result = await authService.refreshSession();

      // Assert
      expect(result).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token-123'
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.TOKEN_REFRESH_SUCCESS })
      );

      expect(tokenStore.getAccessToken()).toBe('new-access-token');
    });

    it('sollte bei fehlendem Refresh Token einen Fehler werfen', async () => {
      // Arrange - Kein Refresh Token gesetzt

      // Act & Assert
      await expect(authService.refreshSession()).rejects.toMatchObject({
        code: AuthErrorCode.REFRESH_FAILED,
        message: 'Kein Refresh Token verfügbar'
      });

      expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled();
    });

    it('sollte bei Refresh-Fehler automatisch abmelden', async () => {
      // Arrange
      await tokenStore.setTokens('access-token', 'invalid-refresh-token', Date.now() + 3600000);

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' }
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      // Act & Assert
      await expect(authService.refreshSession()).rejects.toMatchObject({
        code: AuthErrorCode.TOKEN_INVALID
      });

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.TOKEN_REFRESH_FAIL })
      );

      expect(telemetry.events).toContainEqual(
        expect.objectContaining({ event: AuthEvent.AUTO_LOGOUT })
      );

      // Token sollten gelöscht sein
      expect(tokenStore.getAccessToken()).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('sollte Passwort-Reset erfolgreich anfordern', async () => {
      // Arrange
      const request: PasswordResetRequest = {
        email: 'test@example.com'
      };

      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      // Act
      await authService.resetPassword(request);

      // Assert
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('sollte bei ungültiger E-Mail einen Fehler werfen', async () => {
      // Arrange
      const request: PasswordResetRequest = {
        email: 'invalid-email'
      };

      // Act & Assert
      await expect(authService.resetPassword(request)).rejects.toMatchObject({
        code: AuthErrorCode.INVALID_EMAIL
      });

      expect(mockSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('sollte aktuellen Benutzer aus Cache zurückgeben', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null
      });

      await authService.signIn(request);

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toMatchObject({
        email: 'test@example.com',
        provider: 'email'
      });
    });

    it('sollte null zurückgeben wenn nicht angemeldet', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Netzwerk- und Timeout-Fehler', () => {
    it('sollte Netzwerkfehler korrekt behandeln', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      mockSupabase.auth.signInWithPassword.mockRejectedValue(networkError);

      // Act & Assert
      await expect(authService.signIn(request)).rejects.toMatchObject({
        code: AuthErrorCode.NETWORK_ERROR,
        message: 'Netzwerkfehler'
      });
    });

    it('sollte Timeout-Fehler korrekt behandeln', async () => {
      // Arrange
      const request: SignUpRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      
      mockSupabase.auth.signUp.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(authService.signUp(request)).rejects.toMatchObject({
        code: AuthErrorCode.API_TIMEOUT,
        message: 'Zeitüberschreitung'
      });
    });
  });

  describe('Secure Storage Fehler', () => {
    it('sollte Keychain-Fehler beim Token-Speichern behandeln', async () => {
      // Arrange
      const failingStorage = {
        setItem: jest.fn().mockRejectedValue(new Error('Keychain access denied')),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };

      const failingTokenStore = new TokenStore(failingStorage);
      const failingAuthService = new AuthService(failingTokenStore, telemetry);

      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'SecurePass123'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null
      });

      // Act & Assert
      await expect(failingAuthService.signIn(request)).rejects.toMatchObject({
        code: AuthErrorCode.KEYCHAIN_ERROR,
        retryable: true
      });
    });
  });

  describe('getAuthState', () => {
    it('sollte korrekten Auth-State zurückgeben', () => {
      // Act
      const authState = authService.getAuthState();

      // Assert
      expect(authState).toMatchObject({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });
    });
  });
});

describe('AuthService Auto-Refresh', () => {
  let authService: AuthService;
  let tokenStore: TokenStore;
  let secureStorage: MockSecureStorage;
  let telemetry: MockTelemetry;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    resetAuthService();
    resetTokenStore();
    
    secureStorage = new MockSecureStorage();
    tokenStore = new TokenStore(secureStorage);
    telemetry = new MockTelemetry();
    
    authService = new AuthService(tokenStore, telemetry);
  });

  afterEach(() => {
    jest.useRealTimers();
    secureStorage.clear();
    telemetry.reset();
  });

  it('sollte Auto-Refresh bei T-5min auslösen', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      email_confirmed_at: '2023-01-01T00:00:00Z',
      created_at: '2023-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }
    };

    const mockSession = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      expires_in: 600, // 10 Minuten
      user: mockUser
    };

    const newSession = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      user: mockUser
    };

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: mockSession, user: mockUser },
      error: null
    });

    mockSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: newSession, user: mockUser },
      error: null
    });

    // Login und Token setzen
    await authService.signIn({
      email: 'test@example.com',
      password: 'SecurePass123'
    });

    // Act - Vorspulen zu T-5min (5 Minuten vor Ablauf)
    jest.advanceTimersByTime(5 * 60 * 1000);

    // Assert
    await Promise.resolve(); // Wait for async operations
    
    expect(mockSupabase.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-token-123'
    });

    expect(telemetry.events).toContainEqual(
      expect.objectContaining({ event: AuthEvent.TOKEN_REFRESH_SUCCESS })
    );
  });
});
