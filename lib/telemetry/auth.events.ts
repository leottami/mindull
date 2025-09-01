/**
 * Auth Telemetrie Events
 * Minimale Events ohne PII für Auth-Tracking
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AuthEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly properties: Record<string, any>;
  readonly userId?: string; // Anonymisierte User-ID
}

export interface AuthEventProperties {
  readonly method: 'email' | 'apple' | 'unknown';
  readonly success: boolean;
  readonly errorCode?: string;
  readonly duration?: number; // in Millisekunden
  readonly isNewUser?: boolean;
  readonly retryCount?: number;
  readonly context?: string;
}

export interface AuthMetrics {
  readonly totalAttempts: number;
  readonly successRate: number;
  readonly averageDuration: number;
  readonly errorDistribution: Record<string, number>;
  readonly methodDistribution: Record<string, number>;
}

// ============================================================================
// EVENT NAMES
// ============================================================================

export const AUTH_EVENTS = {
  // Sign-In Events
  SIGN_IN_ATTEMPT: 'auth.signin.attempt',
  SIGN_IN_SUCCESS: 'auth.signin.success',
  SIGN_IN_FAIL: 'auth.signin.fail',

  // Sign-Up Events
  SIGN_UP_ATTEMPT: 'auth.signup.attempt',
  SIGN_UP_SUCCESS: 'auth.signup.success',
  SIGN_UP_FAIL: 'auth.signup.fail',

  // Apple SSO Events
  APPLE_SIGN_IN_ATTEMPT: 'auth.apple.attempt',
  APPLE_SIGN_IN_SUCCESS: 'auth.apple.success',
  APPLE_SIGN_IN_FAIL: 'auth.apple.fail',
  APPLE_SIGN_IN_CANCELLED: 'auth.apple.cancelled',

  // Session Events
  SESSION_REFRESH_ATTEMPT: 'auth.session.refresh.attempt',
  SESSION_REFRESH_SUCCESS: 'auth.session.refresh.success',
  SESSION_REFRESH_FAIL: 'auth.session.refresh.fail',

  // Logout Events
  SIGN_OUT: 'auth.signout',

  // Error Events
  AUTH_ERROR: 'auth.error',
  RATE_LIMIT_HIT: 'auth.rate_limit.hit',

  // Performance Events
  AUTH_PERFORMANCE: 'auth.performance'
} as const;

// ============================================================================
// AUTH TELEMETRY SERVICE
// ============================================================================

/**
 * Auth Telemetrie Service
 * Sammelt und sendet Auth-Events ohne PII
 */
export class AuthTelemetryService {
  private static instance: AuthTelemetryService;
  private events: AuthEvent[] = [];
  private isEnabled: boolean = true;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 Sekunden
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startPeriodicFlush();
  }

  static getInstance(): AuthTelemetryService {
    if (!AuthTelemetryService.instance) {
      AuthTelemetryService.instance = new AuthTelemetryService();
    }
    return AuthTelemetryService.instance;
  }

  /**
   * Trackt ein Auth-Event
   */
  trackEvent(
    eventName: string,
    properties: AuthEventProperties,
    userId?: string
  ): void {
    if (!this.isEnabled) return;

    const event: AuthEvent = {
      name: eventName,
      timestamp: Date.now(),
      properties: this.sanitizeProperties(properties),
      userId: userId ? this.anonymizeUserId(userId) : undefined
    };

    this.events.push(event);

    // Flush wenn Batch-Größe erreicht ist
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Trackt Sign-In Event
   */
  trackSignIn(
    method: 'email' | 'apple',
    success: boolean,
    errorCode?: string,
    duration?: number,
    isNewUser?: boolean,
    retryCount?: number,
    userId?: string
  ): void {
    const eventName = success ? AUTH_EVENTS.SIGN_IN_SUCCESS : AUTH_EVENTS.SIGN_IN_FAIL;
    
    this.trackEvent(eventName, {
      method,
      success,
      errorCode,
      duration,
      isNewUser,
      retryCount,
      context: 'signin'
    }, userId);
  }

  /**
   * Trackt Sign-Up Event
   */
  trackSignUp(
    method: 'email' | 'apple',
    success: boolean,
    errorCode?: string,
    duration?: number,
    retryCount?: number,
    userId?: string
  ): void {
    const eventName = success ? AUTH_EVENTS.SIGN_UP_SUCCESS : AUTH_EVENTS.SIGN_UP_FAIL;
    
    this.trackEvent(eventName, {
      method,
      success,
      errorCode,
      duration,
      retryCount,
      context: 'signup'
    }, userId);
  }

  /**
   * Trackt Apple SSO Event
   */
  trackAppleSignIn(
    success: boolean,
    errorCode?: string,
    duration?: number,
    isNewUser?: boolean,
    cancelled?: boolean,
    userId?: string
  ): void {
    let eventName: string;
    
    if (cancelled) {
      eventName = AUTH_EVENTS.APPLE_SIGN_IN_CANCELLED;
    } else if (success) {
      eventName = AUTH_EVENTS.APPLE_SIGN_IN_SUCCESS;
    } else {
      eventName = AUTH_EVENTS.APPLE_SIGN_IN_FAIL;
    }

    this.trackEvent(eventName, {
      method: 'apple',
      success,
      errorCode,
      duration,
      isNewUser,
      context: 'apple_sso'
    }, userId);
  }

  /**
   * Trackt Session Refresh Event
   */
  trackSessionRefresh(
    success: boolean,
    errorCode?: string,
    duration?: number,
    userId?: string
  ): void {
    const eventName = success ? AUTH_EVENTS.SESSION_REFRESH_SUCCESS : AUTH_EVENTS.SESSION_REFRESH_FAIL;
    
    this.trackEvent(eventName, {
      method: 'session_refresh',
      success,
      errorCode,
      duration,
      context: 'session_refresh'
    }, userId);
  }

  /**
   * Trackt Sign-Out Event
   */
  trackSignOut(userId?: string): void {
    this.trackEvent(AUTH_EVENTS.SIGN_OUT, {
      method: 'signout',
      success: true,
      context: 'signout'
    }, userId);
  }

  /**
   * Trackt Auth Error
   */
  trackError(
    errorCode: string,
    method: string,
    context?: string,
    userId?: string
  ): void {
    this.trackEvent(AUTH_EVENTS.AUTH_ERROR, {
      method: method as any,
      success: false,
      errorCode,
      context
    }, userId);
  }

  /**
   * Trackt Rate Limit Event
   */
  trackRateLimit(
    method: string,
    retryCount: number,
    userId?: string
  ): void {
    this.trackEvent(AUTH_EVENTS.RATE_LIMIT_HIT, {
      method: method as any,
      success: false,
      errorCode: 'RATE_LIMITED',
      retryCount,
      context: 'rate_limit'
    }, userId);
  }

  /**
   * Trackt Performance Event
   */
  trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    userId?: string
  ): void {
    this.trackEvent(AUTH_EVENTS.AUTH_PERFORMANCE, {
      method: operation as any,
      success,
      duration,
      context: 'performance'
    }, userId);
  }

  /**
   * Gibt Auth-Metriken zurück
   */
  getMetrics(): AuthMetrics {
    const totalAttempts = this.events.length;
    const successCount = this.events.filter(e => e.properties.success).length;
    const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;

    // Durchschnittliche Dauer
    const durationEvents = this.events.filter(e => e.properties.duration);
    const averageDuration = durationEvents.length > 0 
      ? durationEvents.reduce((sum, e) => sum + e.properties.duration, 0) / durationEvents.length 
      : 0;

    // Error-Verteilung
    const errorDistribution: Record<string, number> = {};
    this.events
      .filter(e => e.properties.errorCode)
      .forEach(e => {
        const code = e.properties.errorCode;
        errorDistribution[code] = (errorDistribution[code] || 0) + 1;
      });

    // Method-Verteilung
    const methodDistribution: Record<string, number> = {};
    this.events.forEach(e => {
      const method = e.properties.method;
      methodDistribution[method] = (methodDistribution[method] || 0) + 1;
    });

    return {
      totalAttempts,
      successRate,
      averageDuration,
      errorDistribution,
      methodDistribution
    };
  }

  /**
   * Löscht alle Events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Aktiviert/Deaktiviert Telemetrie
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.clear();
      this.stopPeriodicFlush();
    } else {
      this.startPeriodicFlush();
    }
  }

  /**
   * Gibt aktuelle Events zurück (für Tests)
   */
  getEvents(): AuthEvent[] {
    return [...this.events];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Bereinigt Properties von PII
   */
  private sanitizeProperties(properties: AuthEventProperties): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // Nur erlaubte Properties kopieren
    if (properties.method) sanitized.method = properties.method;
    if (properties.success !== undefined) sanitized.success = properties.success;
    if (properties.errorCode) sanitized.errorCode = properties.errorCode;
    if (properties.duration) sanitized.duration = properties.duration;
    if (properties.isNewUser !== undefined) sanitized.isNewUser = properties.isNewUser;
    if (properties.retryCount) sanitized.retryCount = properties.retryCount;
    if (properties.context) sanitized.context = properties.context;

    return sanitized;
  }

  /**
   * Anonymisiert User-ID
   */
  private anonymizeUserId(userId: string): string {
    // Einfache Hash-Funktion für User-ID Anonymisierung
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash)}`;
  }

  /**
   * Sendet Events an Telemetrie-Service
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // Hier würde die tatsächliche Telemetrie-API aufgerufen
      await this.sendToTelemetryService(eventsToSend);
    } catch (error) {
      console.error('Failed to send auth telemetry events:', error);
      // Events bei Fehler wieder hinzufügen
      this.events.unshift(...eventsToSend);
    }
  }

  /**
   * Sendet Events an Telemetrie-Service (Mock)
   */
  private async sendToTelemetryService(events: AuthEvent[]): Promise<void> {
    // Mock-Implementation für MVP
    // In Production würde hier Sentry, Analytics, etc. aufgerufen
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth Telemetry Events:', events);
    }

    // Simuliere API-Call
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Startet periodisches Flushing
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stoppt periodisches Flushing
   */
  private stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Schnelle Event-Tracking-Funktionen
 */
export const authTelemetry = {
  /**
   * Trackt Sign-In
   */
  signIn: (
    method: 'email' | 'apple',
    success: boolean,
    errorCode?: string,
    duration?: number,
    isNewUser?: boolean,
    retryCount?: number,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackSignIn(method, success, errorCode, duration, isNewUser, retryCount, userId);
  },

  /**
   * Trackt Sign-Up
   */
  signUp: (
    method: 'email' | 'apple',
    success: boolean,
    errorCode?: string,
    duration?: number,
    retryCount?: number,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackSignUp(method, success, errorCode, duration, retryCount, userId);
  },

  /**
   * Trackt Apple SSO
   */
  appleSignIn: (
    success: boolean,
    errorCode?: string,
    duration?: number,
    isNewUser?: boolean,
    cancelled?: boolean,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackAppleSignIn(success, errorCode, duration, isNewUser, cancelled, userId);
  },

  /**
   * Trackt Session Refresh
   */
  sessionRefresh: (
    success: boolean,
    errorCode?: string,
    duration?: number,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackSessionRefresh(success, errorCode, duration, userId);
  },

  /**
   * Trackt Sign-Out
   */
  signOut: (userId?: string) => {
    const service = AuthTelemetryService.getInstance();
    service.trackSignOut(userId);
  },

  /**
   * Trackt Error
   */
  error: (
    errorCode: string,
    method: string,
    context?: string,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackError(errorCode, method, context, userId);
  },

  /**
   * Trackt Rate Limit
   */
  rateLimit: (
    method: string,
    retryCount: number,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackRateLimit(method, retryCount, userId);
  },

  /**
   * Trackt Performance
   */
  performance: (
    operation: string,
    duration: number,
    success: boolean,
    userId?: string
  ) => {
    const service = AuthTelemetryService.getInstance();
    service.trackPerformance(operation, duration, success, userId);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AuthTelemetryService,
  authTelemetry
};

export type {
  AuthEvent,
  AuthEventProperties,
  AuthMetrics
};
