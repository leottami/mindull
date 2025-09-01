/**
 * Auth Telemetrie Events Tests
 * Testet Event-Tracking ohne PII
 */

import {
  AuthTelemetryService,
  authTelemetry,
  AUTH_EVENTS,
  AuthEvent,
  AuthEventProperties,
  AuthMetrics
} from '../../../lib/telemetry/auth.events';

// ============================================================================
// TEST HELPERS
// ============================================================================

const createMockEventProperties = (
  overrides: Partial<AuthEventProperties> = {}
): AuthEventProperties => ({
  method: 'email',
  success: true,
  ...overrides
});

const createMockEvent = (
  name: string,
  properties: AuthEventProperties,
  userId?: string
): AuthEvent => ({
  name,
  timestamp: Date.now(),
  properties,
  userId
});

// ============================================================================
// AUTH TELEMETRY SERVICE TESTS
// ============================================================================

describe('AuthTelemetryService', () => {
  let telemetryService: AuthTelemetryService;

  beforeEach(() => {
    telemetryService = AuthTelemetryService.getInstance();
    telemetryService.clear();
    telemetryService.setEnabled(true);
  });

  describe('Event Tracking', () => {
    it('sollte Events korrekt tracken', () => {
      const properties = createMockEventProperties({
        method: 'email',
        success: true,
        duration: 1500
      });

      telemetryService.trackEvent('test.event', properties, 'user_123');

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('test.event');
      expect(events[0].properties).toEqual(properties);
      expect(events[0].userId).toBe('user_123');
    });

    it('sollte User-ID anonymisieren', () => {
      const properties = createMockEventProperties();
      const originalUserId = 'user_123_original';

      telemetryService.trackEvent('test.event', properties, originalUserId);

      const events = telemetryService.getEvents();
      expect(events[0].userId).not.toBe(originalUserId);
      expect(events[0].userId).toMatch(/^user_\d+$/);
    });

    it('sollte keine PII in Properties enthalten', () => {
      const propertiesWithPII = {
        method: 'email' as const,
        success: true,
        email: 'user@example.com', // PII
        password: 'secret123', // PII
        token: 'jwt_token' // PII
      };

      telemetryService.trackEvent('test.event', propertiesWithPII);

      const events = telemetryService.getEvents();
      const trackedProperties = events[0].properties;

      expect(trackedProperties.email).toBeUndefined();
      expect(trackedProperties.password).toBeUndefined();
      expect(trackedProperties.token).toBeUndefined();
      expect(trackedProperties.method).toBe('email');
      expect(trackedProperties.success).toBe(true);
    });

    it('sollte Telemetrie deaktivieren können', () => {
      telemetryService.setEnabled(false);

      const properties = createMockEventProperties();
      telemetryService.trackEvent('test.event', properties);

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('Sign-In Tracking', () => {
    it('sollte erfolgreichen Sign-In tracken', () => {
      telemetryService.trackSignIn(
        'email',
        true,
        undefined,
        1200,
        false,
        0,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_IN_SUCCESS);
      expect(events[0].properties.method).toBe('email');
      expect(events[0].properties.success).toBe(true);
      expect(events[0].properties.duration).toBe(1200);
      expect(events[0].properties.isNewUser).toBe(false);
      expect(events[0].properties.retryCount).toBe(0);
    });

    it('sollte fehlgeschlagenen Sign-In tracken', () => {
      telemetryService.trackSignIn(
        'apple',
        false,
        'INVALID_CREDENTIALS',
        800,
        undefined,
        2,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_IN_FAIL);
      expect(events[0].properties.method).toBe('apple');
      expect(events[0].properties.success).toBe(false);
      expect(events[0].properties.errorCode).toBe('INVALID_CREDENTIALS');
      expect(events[0].properties.retryCount).toBe(2);
    });
  });

  describe('Sign-Up Tracking', () => {
    it('sollte erfolgreichen Sign-Up tracken', () => {
      telemetryService.trackSignUp(
        'email',
        true,
        undefined,
        2000,
        0,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_UP_SUCCESS);
      expect(events[0].properties.method).toBe('email');
      expect(events[0].properties.success).toBe(true);
      expect(events[0].properties.duration).toBe(2000);
    });

    it('sollte fehlgeschlagenen Sign-Up tracken', () => {
      telemetryService.trackSignUp(
        'apple',
        false,
        'WEAK_PASSWORD',
        1500,
        1,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_UP_FAIL);
      expect(events[0].properties.method).toBe('apple');
      expect(events[0].properties.success).toBe(false);
      expect(events[0].properties.errorCode).toBe('WEAK_PASSWORD');
    });
  });

  describe('Apple SSO Tracking', () => {
    it('sollte erfolgreichen Apple Sign-In tracken', () => {
      telemetryService.trackAppleSignIn(
        true,
        undefined,
        1800,
        true,
        false,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.APPLE_SIGN_IN_SUCCESS);
      expect(events[0].properties.method).toBe('apple');
      expect(events[0].properties.success).toBe(true);
      expect(events[0].properties.isNewUser).toBe(true);
    });

    it('sollte abgebrochenen Apple Sign-In tracken', () => {
      telemetryService.trackAppleSignIn(
        false,
        undefined,
        500,
        undefined,
        true,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.APPLE_SIGN_IN_CANCELLED);
      expect(events[0].properties.method).toBe('apple');
      expect(events[0].properties.success).toBe(false);
    });

    it('sollte fehlgeschlagenen Apple Sign-In tracken', () => {
      telemetryService.trackAppleSignIn(
        false,
        'APPLE_INVALID_TOKEN',
        1200,
        undefined,
        false,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.APPLE_SIGN_IN_FAIL);
      expect(events[0].properties.errorCode).toBe('APPLE_INVALID_TOKEN');
    });
  });

  describe('Session Refresh Tracking', () => {
    it('sollte erfolgreichen Session Refresh tracken', () => {
      telemetryService.trackSessionRefresh(
        true,
        undefined,
        300,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SESSION_REFRESH_SUCCESS);
      expect(events[0].properties.method).toBe('session_refresh');
      expect(events[0].properties.success).toBe(true);
      expect(events[0].properties.duration).toBe(300);
    });

    it('sollte fehlgeschlagenen Session Refresh tracken', () => {
      telemetryService.trackSessionRefresh(
        false,
        'REFRESH_FAILED',
        500,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SESSION_REFRESH_FAIL);
      expect(events[0].properties.success).toBe(false);
      expect(events[0].properties.errorCode).toBe('REFRESH_FAILED');
    });
  });

  describe('Sign-Out Tracking', () => {
    it('sollte Sign-Out tracken', () => {
      telemetryService.trackSignOut('user_123');

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_OUT);
      expect(events[0].properties.method).toBe('signout');
      expect(events[0].properties.success).toBe(true);
    });
  });

  describe('Error Tracking', () => {
    it('sollte Auth-Fehler tracken', () => {
      telemetryService.trackError(
        'NETWORK_ERROR',
        'signin',
        'login_screen',
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.AUTH_ERROR);
      expect(events[0].properties.errorCode).toBe('NETWORK_ERROR');
      expect(events[0].properties.method).toBe('signin');
      expect(events[0].properties.context).toBe('login_screen');
    });
  });

  describe('Rate Limit Tracking', () => {
    it('sollte Rate Limit Events tracken', () => {
      telemetryService.trackRateLimit(
        'signin',
        3,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.RATE_LIMIT_HIT);
      expect(events[0].properties.errorCode).toBe('RATE_LIMITED');
      expect(events[0].properties.retryCount).toBe(3);
      expect(events[0].properties.method).toBe('signin');
    });
  });

  describe('Performance Tracking', () => {
    it('sollte Performance Events tracken', () => {
      telemetryService.trackPerformance(
        'token_validation',
        50,
        true,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.AUTH_PERFORMANCE);
      expect(events[0].properties.method).toBe('token_validation');
      expect(events[0].properties.duration).toBe(50);
      expect(events[0].properties.success).toBe(true);
    });
  });

  describe('Metrics Calculation', () => {
    it('sollte korrekte Metriken berechnen', () => {
      // Mehrere Events tracken
      telemetryService.trackSignIn('email', true, undefined, 1000, false, 0, 'user_1');
      telemetryService.trackSignIn('apple', true, undefined, 1500, true, 0, 'user_2');
      telemetryService.trackSignIn('email', false, 'INVALID_CREDENTIALS', 800, undefined, 1, 'user_3');
      telemetryService.trackSignUp('email', true, undefined, 2000, 0, 'user_4');

      const metrics = telemetryService.getMetrics();

      expect(metrics.totalAttempts).toBe(4);
      expect(metrics.successRate).toBe(75); // 3 von 4 erfolgreich
      expect(metrics.averageDuration).toBe(1325); // (1000 + 1500 + 800 + 2000) / 4
      expect(metrics.errorDistribution['INVALID_CREDENTIALS']).toBe(1);
      expect(metrics.methodDistribution['email']).toBe(3);
      expect(metrics.methodDistribution['apple']).toBe(1);
    });

    it('sollte Metriken bei leeren Events korrekt berechnen', () => {
      const metrics = telemetryService.getMetrics();

      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(Object.keys(metrics.errorDistribution)).toHaveLength(0);
      expect(Object.keys(metrics.methodDistribution)).toHaveLength(0);
    });

    it('sollte Metriken bei nur fehlgeschlagenen Events korrekt berechnen', () => {
      telemetryService.trackSignIn('email', false, 'NETWORK_ERROR', 1000, undefined, 1, 'user_1');
      telemetryService.trackSignIn('apple', false, 'APPLE_FAILED', 1500, undefined, 2, 'user_2');

      const metrics = telemetryService.getMetrics();

      expect(metrics.totalAttempts).toBe(2);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageDuration).toBe(1250);
      expect(metrics.errorDistribution['NETWORK_ERROR']).toBe(1);
      expect(metrics.errorDistribution['APPLE_FAILED']).toBe(1);
    });
  });

  describe('Batch Processing', () => {
    it('sollte Events bei Batch-Größe flushen', async () => {
      // Batch-Größe ist standardmäßig 10
      for (let i = 0; i < 15; i++) {
        telemetryService.trackEvent(`test.event.${i}`, createMockEventProperties());
      }

      // Warte auf async flush
      await new Promise(resolve => setTimeout(resolve, 50));

      const events = telemetryService.getEvents();
      // Nach Flush sollten nur die letzten 5 Events übrig sein
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Event Sanitization', () => {
    it('sollte nur erlaubte Properties tracken', () => {
      const propertiesWithExtra = {
        method: 'email' as const,
        success: true,
        duration: 1000,
        // Nicht erlaubte Properties
        email: 'user@example.com',
        password: 'secret123',
        token: 'jwt_token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      };

      telemetryService.trackEvent('test.event', propertiesWithExtra);

      const events = telemetryService.getEvents();
      const trackedProperties = events[0].properties;

      // Erlaubte Properties sollten vorhanden sein
      expect(trackedProperties.method).toBe('email');
      expect(trackedProperties.success).toBe(true);
      expect(trackedProperties.duration).toBe(1000);

      // Nicht erlaubte Properties sollten entfernt worden sein
      expect(trackedProperties.email).toBeUndefined();
      expect(trackedProperties.password).toBeUndefined();
      expect(trackedProperties.token).toBeUndefined();
      expect(trackedProperties.ipAddress).toBeUndefined();
      expect(trackedProperties.userAgent).toBeUndefined();
    });
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe('authTelemetry Utility Functions', () => {
  let telemetryService: AuthTelemetryService;

  beforeEach(() => {
    telemetryService = AuthTelemetryService.getInstance();
    telemetryService.clear();
    telemetryService.setEnabled(true);
  });

  describe('Sign-In Utility', () => {
    it('sollte Sign-In über Utility tracken', () => {
      authTelemetry.signIn(
        'email',
        true,
        undefined,
        1200,
        false,
        0,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_IN_SUCCESS);
      expect(events[0].properties.method).toBe('email');
    });
  });

  describe('Sign-Up Utility', () => {
    it('sollte Sign-Up über Utility tracken', () => {
      authTelemetry.signUp(
        'apple',
        true,
        undefined,
        1800,
        0,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_UP_SUCCESS);
      expect(events[0].properties.method).toBe('apple');
    });
  });

  describe('Apple SSO Utility', () => {
    it('sollte Apple SSO über Utility tracken', () => {
      authTelemetry.appleSignIn(
        true,
        undefined,
        1500,
        true,
        false,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.APPLE_SIGN_IN_SUCCESS);
      expect(events[0].properties.method).toBe('apple');
    });
  });

  describe('Session Refresh Utility', () => {
    it('sollte Session Refresh über Utility tracken', () => {
      authTelemetry.sessionRefresh(
        true,
        undefined,
        300,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SESSION_REFRESH_SUCCESS);
    });
  });

  describe('Sign-Out Utility', () => {
    it('sollte Sign-Out über Utility tracken', () => {
      authTelemetry.signOut('user_123');

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.SIGN_OUT);
    });
  });

  describe('Error Utility', () => {
    it('sollte Error über Utility tracken', () => {
      authTelemetry.error(
        'NETWORK_ERROR',
        'signin',
        'login_screen',
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.AUTH_ERROR);
      expect(events[0].properties.errorCode).toBe('NETWORK_ERROR');
    });
  });

  describe('Rate Limit Utility', () => {
    it('sollte Rate Limit über Utility tracken', () => {
      authTelemetry.rateLimit(
        'signin',
        3,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.RATE_LIMIT_HIT);
      expect(events[0].properties.retryCount).toBe(3);
    });
  });

  describe('Performance Utility', () => {
    it('sollte Performance über Utility tracken', () => {
      authTelemetry.performance(
        'token_validation',
        50,
        true,
        'user_123'
      );

      const events = telemetryService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(AUTH_EVENTS.AUTH_PERFORMANCE);
      expect(events[0].properties.duration).toBe(50);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Auth Telemetry Integration', () => {
  let telemetryService: AuthTelemetryService;

  beforeEach(() => {
    telemetryService = AuthTelemetryService.getInstance();
    telemetryService.clear();
    telemetryService.setEnabled(true);
  });

  it('sollte vollständigen Auth-Flow tracken', () => {
    // 1. Sign-Up
    authTelemetry.signUp('email', true, undefined, 2000, 0, 'user_123');

    // 2. Sign-In
    authTelemetry.signIn('email', true, undefined, 1200, false, 0, 'user_123');

    // 3. Session Refresh
    authTelemetry.sessionRefresh(true, undefined, 300, 'user_123');

    // 4. Apple SSO
    authTelemetry.appleSignIn(true, undefined, 1500, false, false, 'user_123');

    // 5. Error
    authTelemetry.error('NETWORK_ERROR', 'signin', 'login_screen', 'user_123');

    // 6. Rate Limit
    authTelemetry.rateLimit('signin', 3, 'user_123');

    // 7. Performance
    authTelemetry.performance('token_validation', 50, true, 'user_123');

    // 8. Sign-Out
    authTelemetry.signOut('user_123');

    const events = telemetryService.getEvents();
    expect(events).toHaveLength(8);

    // Prüfe verschiedene Event-Typen
    const eventNames = events.map(e => e.name);
    expect(eventNames).toContain(AUTH_EVENTS.SIGN_UP_SUCCESS);
    expect(eventNames).toContain(AUTH_EVENTS.SIGN_IN_SUCCESS);
    expect(eventNames).toContain(AUTH_EVENTS.SESSION_REFRESH_SUCCESS);
    expect(eventNames).toContain(AUTH_EVENTS.APPLE_SIGN_IN_SUCCESS);
    expect(eventNames).toContain(AUTH_EVENTS.AUTH_ERROR);
    expect(eventNames).toContain(AUTH_EVENTS.RATE_LIMIT_HIT);
    expect(eventNames).toContain(AUTH_EVENTS.AUTH_PERFORMANCE);
    expect(eventNames).toContain(AUTH_EVENTS.SIGN_OUT);
  });

  it('sollte Metriken für Auth-Flow berechnen', () => {
    // Simuliere realistische Auth-Session
    authTelemetry.signIn('email', true, undefined, 1200, false, 0, 'user_123');
    authTelemetry.signIn('apple', true, undefined, 1500, true, 0, 'user_123');
    authTelemetry.signIn('email', false, 'INVALID_CREDENTIALS', 800, undefined, 1, 'user_123');
    authTelemetry.sessionRefresh(true, undefined, 300, 'user_123');
    authTelemetry.sessionRefresh(false, 'REFRESH_FAILED', 500, 'user_123');

    const metrics = telemetryService.getMetrics();

    expect(metrics.totalAttempts).toBe(5);
    expect(metrics.successRate).toBe(60); // 3 von 5 erfolgreich
    expect(metrics.averageDuration).toBe(860); // (1200 + 1500 + 800 + 300 + 500) / 5
    expect(metrics.errorDistribution['INVALID_CREDENTIALS']).toBe(1);
    expect(metrics.errorDistribution['REFRESH_FAILED']).toBe(1);
    expect(metrics.methodDistribution['email']).toBe(2);
    expect(metrics.methodDistribution['apple']).toBe(1);
    expect(metrics.methodDistribution['session_refresh']).toBe(2);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Auth Telemetry Performance', () => {
  let telemetryService: AuthTelemetryService;

  beforeEach(() => {
    telemetryService = AuthTelemetryService.getInstance();
    telemetryService.clear();
    telemetryService.setEnabled(true);
  });

  it('sollte schnelle Event-Tracking durchführen', () => {
    const startTime = Date.now();

    // 100 Events tracken
    for (let i = 0; i < 100; i++) {
      telemetryService.trackEvent(`test.event.${i}`, createMockEventProperties());
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(100); // Sollte unter 100ms für 100 Events sein
    expect(telemetryService.getEvents()).toHaveLength(100);
  });

  it('sollte schnelle Metriken-Berechnung durchführen', () => {
    // 1000 Events erstellen
    for (let i = 0; i < 1000; i++) {
      telemetryService.trackEvent(`test.event.${i}`, createMockEventProperties({
        success: i % 2 === 0, // 50% Erfolgsrate
        duration: 100 + (i % 100), // Verschiedene Dauer
        errorCode: i % 10 === 0 ? 'ERROR' : undefined
      }));
    }

    const startTime = Date.now();
    const metrics = telemetryService.getMetrics();
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(50); // Sollte unter 50ms für Metriken-Berechnung sein
    expect(metrics.totalAttempts).toBe(1000);
    expect(metrics.successRate).toBe(50);
  });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('Auth Telemetry Security', () => {
  let telemetryService: AuthTelemetryService;

  beforeEach(() => {
    telemetryService = AuthTelemetryService.getInstance();
    telemetryService.clear();
    telemetryService.setEnabled(true);
  });

  it('sollte User-IDs konsistent anonymisieren', () => {
    const userId1 = 'user_123_original';
    const userId2 = 'user_123_original'; // Gleiche ID

    telemetryService.trackEvent('test.event.1', createMockEventProperties(), userId1);
    telemetryService.trackEvent('test.event.2', createMockEventProperties(), userId2);

    const events = telemetryService.getEvents();
    expect(events[0].userId).toBe(events[1].userId); // Sollte gleiche anonymisierte ID sein
  });

  it('sollte verschiedene User-IDs unterschiedlich anonymisieren', () => {
    const userId1 = 'user_123_original';
    const userId2 = 'user_456_original'; // Andere ID

    telemetryService.trackEvent('test.event.1', createMockEventProperties(), userId1);
    telemetryService.trackEvent('test.event.2', createMockEventProperties(), userId2);

    const events = telemetryService.getEvents();
    expect(events[0].userId).not.toBe(events[1].userId); // Sollte verschiedene anonymisierte IDs sein
  });

  it('sollte keine PII in Event-Properties enthalten', () => {
    const propertiesWithPII = {
      method: 'email' as const,
      success: true,
      // PII-Properties
      email: 'user@example.com',
      password: 'secret123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      phone: '+49123456789',
      address: 'Musterstraße 1, 12345 Berlin',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      sessionId: 'sess_abc123def456'
    };

    telemetryService.trackEvent('test.event', propertiesWithPII);

    const events = telemetryService.getEvents();
    const trackedProperties = events[0].properties;

    // PII-Properties sollten entfernt worden sein
    const piiProperties = ['email', 'password', 'token', 'phone', 'address', 'ipAddress', 'userAgent', 'sessionId'];
    piiProperties.forEach(prop => {
      expect(trackedProperties[prop]).toBeUndefined();
    });

    // Erlaubte Properties sollten vorhanden sein
    expect(trackedProperties.method).toBe('email');
    expect(trackedProperties.success).toBe(true);
  });
});
