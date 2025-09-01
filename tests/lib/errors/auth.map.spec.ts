/**
 * Auth Error Mapping Tests
 * Testet Provider/Supabase → auth/* Fehler-Mappings
 */

import { 
  AuthErrorMapper, 
  resetAuthErrorMapper,
  mapAuthError,
  mapSupabaseAuthError,
  mapNetworkAuthError,
  ProviderError,
  MappedAuthError,
  ErrorMappingConfig
} from '../../../lib/errors/auth.map';
import { AuthErrorCode, AuthError } from '../../../services/auth/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

const createProviderError = (
  code: string,
  message: string,
  status?: number
): ProviderError => ({
  code,
  message,
  status,
  details: {}
});

const createSupabaseError = (
  message: string,
  code?: string,
  status?: number
): any => ({
  message,
  code: code || 'unknown',
  status,
  details: {}
});

// ============================================================================
// AUTH ERROR MAPPER TESTS
// ============================================================================

describe('AuthErrorMapper', () => {
  let mapper: AuthErrorMapper;

  beforeEach(() => {
    resetAuthErrorMapper();
    mapper = new AuthErrorMapper();
  });

  describe('Supabase Error Mapping', () => {
    it('sollte Invalid login credentials korrekt mappen', () => {
      const supabaseError = createSupabaseError('Invalid login credentials');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('sollte Email not confirmed korrekt mappen', () => {
      const supabaseError = createSupabaseError('Email not confirmed');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.EMAIL_NOT_VERIFIED);
      expect(result.message).toBe('E-Mail nicht bestätigt.');
      expect(result.retryable).toBe(false);
    });

    it('sollte User already registered korrekt mappen', () => {
      const supabaseError = createSupabaseError('User already registered');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.USER_ALREADY_EXISTS);
      expect(result.message).toBe('Benutzer bereits registriert.');
      expect(result.retryable).toBe(false);
    });

    it('sollte User not found korrekt mappen', () => {
      const supabaseError = createSupabaseError('User not found');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.USER_NOT_FOUND);
      expect(result.message).toBe('Benutzer nicht gefunden.');
      expect(result.retryable).toBe(false);
    });

    it('sollte Invalid refresh token korrekt mappen', () => {
      const supabaseError = createSupabaseError('Invalid refresh token');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.TOKEN_INVALID);
      expect(result.message).toBe('Session abgelaufen.');
      expect(result.retryable).toBe(false);
    });

    it('sollte refresh_token_not_found korrekt mappen', () => {
      const supabaseError = createSupabaseError('refresh_token_not_found');
      const result = mapper.mapSupabaseError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.REFRESH_FAILED);
      expect(result.message).toBe('Session abgelaufen.');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Apple SSO Error Mapping', () => {
    it('sollte Apple cancellation korrekt mappen', () => {
      const appleError = createSupabaseError('User cancelled Apple Sign In');
      const result = mapper.mapAppleError(appleError);

      expect(result.code).toBe(AuthErrorCode.APPLE_CANCELLED);
      expect(result.message).toBe('Apple-Anmeldung abgebrochen.');
      expect(result.retryable).toBe(true);
    });

    it('sollte Apple failure korrekt mappen', () => {
      const appleError = createSupabaseError('Apple Sign In failed');
      const result = mapper.mapAppleError(appleError);

      expect(result.code).toBe(AuthErrorCode.APPLE_FAILED);
      expect(result.message).toBe('Apple-Anmeldung fehlgeschlagen.');
      expect(result.retryable).toBe(true);
    });

    it('sollte Invalid Apple token korrekt mappen', () => {
      const appleError = createSupabaseError('Invalid Apple identity token');
      const result = mapper.mapAppleError(appleError);

      expect(result.code).toBe(AuthErrorCode.APPLE_INVALID_TOKEN);
      expect(result.message).toBe('Ungültiges Apple-Token.');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Network Error Mapping', () => {
    it('sollte Network request failed korrekt mappen', () => {
      const networkError = createSupabaseError('Network request failed');
      const result = mapper.mapNetworkError(networkError);

      expect(result.code).toBe(AuthErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(5000);
    });

    it('sollte Request timeout korrekt mappen', () => {
      const timeoutError = createSupabaseError('Request timeout');
      const result = mapper.mapNetworkError(timeoutError);

      expect(result.code).toBe(AuthErrorCode.API_TIMEOUT);
      expect(result.message).toBe('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(3000);
    });

    it('sollte AbortError korrekt mappen', () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      
      const result = mapper.mapNetworkError(abortError);

      expect(result.code).toBe(AuthErrorCode.API_TIMEOUT);
      expect(result.message).toBe('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
    });

    it('sollte NetworkError korrekt mappen', () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      const result = mapper.mapNetworkError(networkError);

      expect(result.code).toBe(AuthErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.');
    });
  });

  describe('Rate Limiting Error Mapping', () => {
    it('sollte Too many requests korrekt mappen', () => {
      const rateLimitError = createSupabaseError('Too many requests');
      const result = mapper.mapSupabaseError(rateLimitError);

      expect(result.code).toBe(AuthErrorCode.TOO_MANY_REQUESTS);
      expect(result.message).toBe('Zu viele Anfragen.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60000);
    });

    it('sollte Account locked korrekt mappen', () => {
      const lockError = createSupabaseError('Account locked');
      const result = mapper.mapSupabaseError(lockError);

      expect(result.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(result.message).toBe('Konto gesperrt.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(900000);
    });
  });

  describe('Validation Error Mapping', () => {
    it('sollte Invalid email korrekt mappen', () => {
      const validationError = createSupabaseError('Invalid email');
      const result = mapper.mapSupabaseError(validationError);

      expect(result.code).toBe(AuthErrorCode.INVALID_EMAIL);
      expect(result.message).toBe('Ungültige E-Mail-Adresse.');
      expect(result.retryable).toBe(false);
    });

    it('sollte Weak password korrekt mappen', () => {
      const passwordError = createSupabaseError('Weak password');
      const result = mapper.mapSupabaseError(passwordError);

      expect(result.code).toBe(AuthErrorCode.WEAK_PASSWORD);
      expect(result.message).toBe('Passwort ist zu schwach.');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Storage Error Mapping', () => {
    it('sollte Keychain access denied korrekt mappen', () => {
      const keychainError = createSupabaseError('Keychain access denied');
      const result = mapper.mapSupabaseError(keychainError);

      expect(result.code).toBe(AuthErrorCode.KEYCHAIN_ERROR);
      expect(result.message).toBe('Sicherer Speicher nicht verfügbar.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(2000);
    });

    it('sollte Secure storage error korrekt mappen', () => {
      const storageError = createSupabaseError('Secure storage error');
      const result = mapper.mapSupabaseError(storageError);

      expect(result.code).toBe(AuthErrorCode.SECURE_STORAGE_ERROR);
      expect(result.message).toBe('Sicherer Speicher nicht verfügbar.');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(2000);
    });
  });

  describe('HTTP Status Code Mapping', () => {
    it('sollte 400 Bad Request korrekt mappen', () => {
      const providerError = createProviderError('bad_request', 'Invalid request', 400);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.API_ERROR);
      expect(result.message).toBe('Ungültige Anfrage');
      expect(result.retryable).toBe(false);
    });

    it('sollte 401 Unauthorized korrekt mappen', () => {
      const providerError = createProviderError('unauthorized', 'Not authorized', 401);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.TOKEN_INVALID);
      expect(result.message).toBe('Nicht autorisiert');
      expect(result.retryable).toBe(false);
    });

    it('sollte 403 Forbidden korrekt mappen', () => {
      const providerError = createProviderError('forbidden', 'Access denied', 403);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(result.message).toBe('Zugriff verweigert');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(300000);
    });

    it('sollte 429 Too Many Requests korrekt mappen', () => {
      const providerError = createProviderError('rate_limited', 'Too many requests', 429);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.TOO_MANY_REQUESTS);
      expect(result.message).toBe('Zu viele Anfragen');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(60000);
    });

    it('sollte 500 Server Error korrekt mappen', () => {
      const providerError = createProviderError('server_error', 'Internal server error', 500);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.API_ERROR);
      expect(result.message).toBe('Server-Fehler');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(10000);
    });

    it('sollte 502 Bad Gateway korrekt mappen', () => {
      const providerError = createProviderError('bad_gateway', 'Bad gateway', 502);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.API_ERROR);
      expect(result.message).toBe('Server-Fehler');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(10000);
    });

    it('sollte 503 Service Unavailable korrekt mappen', () => {
      const providerError = createProviderError('service_unavailable', 'Service unavailable', 503);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.API_ERROR);
      expect(result.message).toBe('Server-Fehler');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(10000);
    });

    it('sollte 504 Gateway Timeout korrekt mappen', () => {
      const providerError = createProviderError('gateway_timeout', 'Gateway timeout', 504);
      const result = mapper.mapError(providerError);

      expect(result.code).toBe(AuthErrorCode.API_ERROR);
      expect(result.message).toBe('Server-Fehler');
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(10000);
    });
  });

  describe('Unknown Error Mapping', () => {
    it('sollte unbekannte Fehler zu UNKNOWN_ERROR mappen', () => {
      const unknownError = createProviderError('unknown', 'Some unknown error');
      const result = mapper.mapError(unknownError);

      expect(result.code).toBe(AuthErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('Ein Fehler ist aufgetreten');
      expect(result.retryable).toBe(true);
    });

    it('sollte Fehler ohne Message zu UNKNOWN_ERROR mappen', () => {
      const emptyError = createProviderError('', '');
      const result = mapper.mapError(emptyError);

      expect(result.code).toBe(AuthErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('Ein Fehler ist aufgetreten');
    });
  });

  describe('Retry Logic', () => {
    it('sollte Retry-Counter korrekt verwalten', () => {
      const context = 'login_attempt';
      
      expect(mapper.canRetry(context)).toBe(true);
      
      mapper.recordRetry(context);
      expect(mapper.canRetry(context)).toBe(true);
      
      mapper.recordRetry(context);
      expect(mapper.canRetry(context)).toBe(true);
      
      mapper.recordRetry(context);
      expect(mapper.canRetry(context)).toBe(false);
    });

    it('sollte Retry-Counter zurücksetzen können', () => {
      const context = 'login_attempt';
      
      mapper.recordRetry(context);
      mapper.recordRetry(context);
      
      expect(mapper.getRetryStats()[context]).toBe(2);
      
      mapper.resetRetryCount(context);
      expect(mapper.canRetry(context)).toBe(true);
      expect(mapper.getRetryStats()[context]).toBeUndefined();
    });

    it('sollte Retry-Information in Error-Message hinzufügen', () => {
      const supabaseError = createSupabaseError('Invalid login credentials');
      
      // Erster Versuch
      let result = mapper.mapSupabaseError(supabaseError, 'login');
      expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
      
      // Zweiter Versuch
      mapper.recordRetry('login');
      result = mapper.mapSupabaseError(supabaseError, 'login');
      expect(result.message).toBe('E-Mail oder Passwort sind falsch. (Versuch 2/3)');
      
      // Dritter Versuch
      mapper.recordRetry('login');
      result = mapper.mapSupabaseError(supabaseError, 'login');
      expect(result.message).toBe('E-Mail oder Passwort sind falsch. (Versuch 3/3)');
    });

    it('sollte Exponential Backoff berechnen', () => {
      const supabaseError = createSupabaseError('Network request failed');
      
      // Erster Versuch - sollte retryAfter verwenden
      let result = mapper.mapSupabaseError(supabaseError, 'network');
      expect(result.retryAfter).toBe(5000);
      
      // Zweiter Versuch - sollte Backoff verwenden
      mapper.recordRetry('network');
      result = mapper.mapSupabaseError(supabaseError, 'network');
      expect(result.retryAfter).toBe(1000); // baseRetryDelay
      
      // Dritter Versuch - sollte exponentiellen Backoff verwenden
      mapper.recordRetry('network');
      result = mapper.mapSupabaseError(supabaseError, 'network');
      expect(result.retryAfter).toBe(2000); // baseRetryDelay * backoffMultiplier
    });
  });

  describe('Configuration', () => {
    it('sollte Custom-Konfiguration verwenden', () => {
      const customConfig: Partial<ErrorMappingConfig> = {
        genericMessages: false,
        includeCodes: true,
        maxRetryAttempts: 5,
        backoffMultiplier: 3,
        baseRetryDelay: 2000
      };

      const customMapper = new AuthErrorMapper(customConfig);
      const supabaseError = createSupabaseError('Invalid login credentials');
      
      const result = customMapper.mapSupabaseError(supabaseError);
      
      expect(result.message).toBe('E-Mail oder Passwort sind falsch [AUTH_INVALID_CREDENTIALS]');
    });

    it('sollte Default-Konfiguration verwenden wenn keine Custom-Konfiguration', () => {
      const defaultMapper = new AuthErrorMapper();
      const supabaseError = createSupabaseError('Invalid login credentials');
      
      const result = defaultMapper.mapSupabaseError(supabaseError);
      
      expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
    });
  });

  describe('Retry Statistics', () => {
    it('sollte Retry-Statistiken korrekt zurückgeben', () => {
      mapper.recordRetry('login');
      mapper.recordRetry('login');
      mapper.recordRetry('network');
      
      const stats = mapper.getRetryStats();
      
      expect(stats.login).toBe(2);
      expect(stats.network).toBe(1);
      expect(stats.unknown).toBeUndefined();
    });

    it('sollte leere Statistiken zurückgeben wenn keine Retries', () => {
      const stats = mapper.getRetryStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  beforeEach(() => {
    resetAuthErrorMapper();
  });

  describe('mapAuthError', () => {
    it('sollte Provider-Fehler korrekt mappen', () => {
      const providerError = createProviderError('test', 'Invalid login credentials');
      const result = mapAuthError(providerError);

      expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
    });

    it('sollte Context unterstützen', () => {
      const providerError = createProviderError('test', 'Invalid login credentials');
      const result = mapAuthError(providerError, 'login_screen');

      expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe('mapSupabaseAuthError', () => {
    it('sollte Supabase-Fehler korrekt mappen', () => {
      const supabaseError = createSupabaseError('Email not confirmed');
      const result = mapSupabaseAuthError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.EMAIL_NOT_VERIFIED);
      expect(result.message).toBe('E-Mail nicht bestätigt.');
    });

    it('sollte Supabase-Fehler ohne Code behandeln', () => {
      const supabaseError = { message: 'Invalid login credentials' };
      const result = mapSupabaseAuthError(supabaseError);

      expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });

  describe('mapNetworkAuthError', () => {
    it('sollte Network-Fehler korrekt mappen', () => {
      const networkError = createSupabaseError('Network request failed');
      const result = mapNetworkAuthError(networkError);

      expect(result.code).toBe(AuthErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.');
    });

    it('sollte Timeout-Fehler korrekt mappen', () => {
      const timeoutError = createSupabaseError('Request timeout');
      const result = mapNetworkAuthError(timeoutError);

      expect(result.code).toBe(AuthErrorCode.API_TIMEOUT);
      expect(result.message).toBe('Zeitüberschreitung. Bitte versuchen Sie es erneut.');
    });
  });
});

// ============================================================================
// EDGE CASES & ERROR HANDLING
// ============================================================================

describe('Edge Cases & Error Handling', () => {
  let mapper: AuthErrorMapper;

  beforeEach(() => {
    resetAuthErrorMapper();
    mapper = new AuthErrorMapper();
  });

  it('sollte mit null/undefined Fehlern umgehen', () => {
    const result = mapper.mapSupabaseError(null as any);
    
    expect(result.code).toBe(AuthErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('Ein Fehler ist aufgetreten');
  });

  it('sollte mit leeren Fehler-Objekten umgehen', () => {
    const result = mapper.mapSupabaseError({});
    
    expect(result.code).toBe(AuthErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('Ein Fehler ist aufgetreten');
  });

  it('sollte mit sehr langen Fehlermeldungen umgehen', () => {
    const longMessage = 'A'.repeat(1000);
    const result = mapper.mapSupabaseError({ message: longMessage });
    
    expect(result.code).toBe(AuthErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('Ein Fehler ist aufgetreten');
  });

  it('sollte mit Sonderzeichen in Fehlermeldungen umgehen', () => {
    const specialMessage = 'Invalid login credentials with special chars: äöüß@#$%';
    const result = mapper.mapSupabaseError({ message: specialMessage });
    
    expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    expect(result.message).toBe('E-Mail oder Passwort sind falsch.');
  });

  it('sollte Retry-Counter bei sehr vielen Versuchen handhaben', () => {
    const context = 'stress_test';
    
    // 100 Retry-Versuche
    for (let i = 0; i < 100; i++) {
      mapper.recordRetry(context);
    }
    
    expect(mapper.getRetryStats()[context]).toBe(100);
    expect(mapper.canRetry(context)).toBe(false);
  });

  it('sollte mit verschiedenen Context-Typen umgehen', () => {
    const contexts = ['login', 'signup', 'reset', 'verify', 'apple', ''];
    
    contexts.forEach(context => {
      mapper.recordRetry(context);
      expect(mapper.getRetryStats()[context || 'default']).toBe(1);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  let mapper: AuthErrorMapper;

  beforeEach(() => {
    resetAuthErrorMapper();
    mapper = new AuthErrorMapper();
  });

  it('sollte vollständigen Error-Handling-Flow simulieren', () => {
    // 1. Erster Login-Versuch
    let supabaseError = createSupabaseError('Invalid login credentials');
    let result = mapper.mapSupabaseError(supabaseError, 'login');
    
    expect(result.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    expect(result.retryable).toBe(true);
    
    // 2. Retry registrieren
    mapper.recordRetry('login');
    
    // 3. Zweiter Versuch
    result = mapper.mapSupabaseError(supabaseError, 'login');
    expect(result.message).toContain('(Versuch 2/3)');
    
    // 4. Network-Fehler beim dritten Versuch
    mapper.recordRetry('login');
    const networkError = createSupabaseError('Network request failed');
    result = mapper.mapNetworkError(networkError, 'login');
    
    expect(result.code).toBe(AuthErrorCode.NETWORK_ERROR);
    expect(result.retryAfter).toBe(5000);
    
    // 5. Statistiken prüfen
    const stats = mapper.getRetryStats();
    expect(stats.login).toBe(3);
  });

  it('sollte verschiedene Error-Typen in einer Session handhaben', () => {
    const errors = [
      { type: 'supabase', error: createSupabaseError('Invalid login credentials') },
      { type: 'network', error: createSupabaseError('Network request failed') },
      { type: 'apple', error: createSupabaseError('Apple Sign In failed') },
      { type: 'validation', error: createSupabaseError('Invalid email') }
    ];

    const results = errors.map(({ type, error }) => {
      switch (type) {
        case 'supabase':
          return mapper.mapSupabaseError(error);
        case 'network':
          return mapper.mapNetworkError(error);
        case 'apple':
          return mapper.mapAppleError(error);
        default:
          return mapper.mapError(error);
      }
    });

    expect(results[0].code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    expect(results[1].code).toBe(AuthErrorCode.NETWORK_ERROR);
    expect(results[2].code).toBe(AuthErrorCode.APPLE_FAILED);
    expect(results[3].code).toBe(AuthErrorCode.INVALID_EMAIL);
  });
});
