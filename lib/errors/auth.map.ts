/**
 * Auth Error Mapping - Provider/Supabase → auth/*
 * Einheitliche Fehlerbehandlung ohne PII in Meldungen
 */

import { AuthErrorCode, AuthError } from '../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderError {
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly details?: Record<string, any>;
}

export interface MappedAuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfter?: number;
  readonly backoffRequired: boolean;
  readonly userAction?: string;
  readonly telemetryCode: string;
}

export interface ErrorMappingConfig {
  readonly genericMessages: boolean;
  readonly includeCodes: boolean;
  readonly maxRetryAttempts: number;
  readonly backoffMultiplier: number;
  readonly baseRetryDelay: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_ERROR_CONFIG: ErrorMappingConfig = {
  genericMessages: true,
  includeCodes: false,
  maxRetryAttempts: 3,
  backoffMultiplier: 2,
  baseRetryDelay: 1000 // 1 Sekunde
};

// ============================================================================
// ERROR MAPPING RULES
// ============================================================================

/**
 * Supabase-spezifische Fehler-Mappings
 * Basierend auf Supabase Auth Error Codes
 */
const SUPABASE_ERROR_MAP: Record<string, MappedAuthError> = {
  // Authentication Errors
  'Invalid login credentials': {
    code: AuthErrorCode.INVALID_CREDENTIALS,
    message: 'E-Mail oder Passwort sind falsch',
    retryable: true,
    backoffRequired: true,
    telemetryCode: 'AUTH_INVALID_CREDENTIALS'
  },

  'Email not confirmed': {
    code: AuthErrorCode.EMAIL_NOT_VERIFIED,
    message: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
    retryable: false,
    backoffRequired: false,
    userAction: 'verify_email',
    telemetryCode: 'AUTH_EMAIL_NOT_VERIFIED'
  },

  'User already registered': {
    code: AuthErrorCode.USER_ALREADY_EXISTS,
    message: 'Ein Konto mit dieser E-Mail-Adresse existiert bereits',
    retryable: false,
    backoffRequired: false,
    userAction: 'login_instead',
    telemetryCode: 'AUTH_USER_EXISTS'
  },

  'User not found': {
    code: AuthErrorCode.USER_NOT_FOUND,
    message: 'Kein Konto mit dieser E-Mail-Adresse gefunden',
    retryable: false,
    backoffRequired: false,
    userAction: 'signup_instead',
    telemetryCode: 'AUTH_USER_NOT_FOUND'
  },

  // Token/Session Errors
  'Invalid refresh token': {
    code: AuthErrorCode.TOKEN_INVALID,
    message: 'Session abgelaufen',
    retryable: false,
    backoffRequired: false,
    userAction: 're_login',
    telemetryCode: 'AUTH_TOKEN_INVALID'
  },

  'refresh_token_not_found': {
    code: AuthErrorCode.REFRESH_FAILED,
    message: 'Session abgelaufen',
    retryable: false,
    backoffRequired: false,
    userAction: 're_login',
    telemetryCode: 'AUTH_REFRESH_NOT_FOUND'
  },

  'Token expired': {
    code: AuthErrorCode.TOKEN_EXPIRED,
    message: 'Session abgelaufen',
    retryable: false,
    backoffRequired: false,
    userAction: 're_login',
    telemetryCode: 'AUTH_TOKEN_EXPIRED'
  },

  // Apple SSO Errors
  'User cancelled Apple Sign In': {
    code: AuthErrorCode.APPLE_CANCELLED,
    message: 'Apple-Anmeldung wurde abgebrochen',
    retryable: true,
    backoffRequired: false,
    telemetryCode: 'AUTH_APPLE_CANCELLED'
  },

  'Apple Sign In failed': {
    code: AuthErrorCode.APPLE_FAILED,
    message: 'Apple-Anmeldung fehlgeschlagen',
    retryable: true,
    backoffRequired: true,
    telemetryCode: 'AUTH_APPLE_FAILED'
  },

  'Invalid Apple identity token': {
    code: AuthErrorCode.APPLE_INVALID_TOKEN,
    message: 'Apple-Token ungültig',
    retryable: true,
    backoffRequired: true,
    telemetryCode: 'AUTH_APPLE_INVALID_TOKEN'
  },

  // Network/API Errors
  'Network request failed': {
    code: AuthErrorCode.NETWORK_ERROR,
    message: 'Netzwerkfehler',
    retryable: true,
    backoffRequired: true,
    retryAfter: 5000,
    telemetryCode: 'AUTH_NETWORK_ERROR'
  },

  'Request timeout': {
    code: AuthErrorCode.API_TIMEOUT,
    message: 'Zeitüberschreitung',
    retryable: true,
    backoffRequired: true,
    retryAfter: 3000,
    telemetryCode: 'AUTH_API_TIMEOUT'
  },

  // Rate Limiting
  'Too many requests': {
    code: AuthErrorCode.TOO_MANY_REQUESTS,
    message: 'Zu viele Anfragen',
    retryable: true,
    backoffRequired: true,
    retryAfter: 60000, // 1 Minute
    telemetryCode: 'AUTH_RATE_LIMITED'
  },

  'Account locked': {
    code: AuthErrorCode.ACCOUNT_LOCKED,
    message: 'Konto ist temporär gesperrt',
    retryable: true,
    backoffRequired: true,
    retryAfter: 900000, // 15 Minuten
    telemetryCode: 'AUTH_ACCOUNT_LOCKED'
  },

  // Validation Errors
  'Invalid email': {
    code: AuthErrorCode.INVALID_EMAIL,
    message: 'Ungültige E-Mail-Adresse',
    retryable: false,
    backoffRequired: false,
    telemetryCode: 'AUTH_INVALID_EMAIL'
  },

  'Weak password': {
    code: AuthErrorCode.WEAK_PASSWORD,
    message: 'Passwort ist zu schwach',
    retryable: false,
    backoffRequired: false,
    telemetryCode: 'AUTH_WEAK_PASSWORD'
  },

  // Storage/Security Errors
  'Keychain access denied': {
    code: AuthErrorCode.KEYCHAIN_ERROR,
    message: 'Sicherer Speicher nicht verfügbar',
    retryable: true,
    backoffRequired: true,
    retryAfter: 2000,
    telemetryCode: 'AUTH_KEYCHAIN_ERROR'
  },

  'Secure storage error': {
    code: AuthErrorCode.SECURE_STORAGE_ERROR,
    message: 'Sicherer Speicher nicht verfügbar',
    retryable: true,
    backoffRequired: true,
    retryAfter: 2000,
    telemetryCode: 'AUTH_SECURE_STORAGE_ERROR'
  }
};

/**
 * Generic Error Messages (ohne PII)
 */
const GENERIC_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.NETWORK_ERROR]: 'Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.',
  [AuthErrorCode.API_TIMEOUT]: 'Zeitüberschreitung. Bitte versuchen Sie es erneut.',
  [AuthErrorCode.API_ERROR]: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  [AuthErrorCode.INVALID_CREDENTIALS]: 'E-Mail oder Passwort sind falsch.',
  [AuthErrorCode.EMAIL_NOT_VERIFIED]: 'E-Mail nicht bestätigt.',
  [AuthErrorCode.USER_NOT_FOUND]: 'Benutzer nicht gefunden.',
  [AuthErrorCode.USER_ALREADY_EXISTS]: 'Benutzer bereits registriert.',
  [AuthErrorCode.TOKEN_EXPIRED]: 'Session abgelaufen.',
  [AuthErrorCode.TOKEN_INVALID]: 'Ungültiger Token.',
  [AuthErrorCode.REFRESH_FAILED]: 'Session-Erneuerung fehlgeschlagen.',
  [AuthErrorCode.SESSION_INVALID]: 'Ungültige Session.',
  [AuthErrorCode.APPLE_CANCELLED]: 'Apple-Anmeldung abgebrochen.',
  [AuthErrorCode.APPLE_FAILED]: 'Apple-Anmeldung fehlgeschlagen.',
  [AuthErrorCode.APPLE_INVALID_TOKEN]: 'Ungültiges Apple-Token.',
  [AuthErrorCode.KEYCHAIN_ERROR]: 'Sicherer Speicher nicht verfügbar.',
  [AuthErrorCode.SECURE_STORAGE_ERROR]: 'Sicherer Speicher nicht verfügbar.',
  [AuthErrorCode.TOO_MANY_REQUESTS]: 'Zu viele Anfragen.',
  [AuthErrorCode.ACCOUNT_LOCKED]: 'Konto gesperrt.',
  [AuthErrorCode.INVALID_EMAIL]: 'Ungültige E-Mail-Adresse.',
  [AuthErrorCode.WEAK_PASSWORD]: 'Passwort ist zu schwach.',
  [AuthErrorCode.UNKNOWN_ERROR]: 'Ein Fehler ist aufgetreten.'
};

// ============================================================================
// ERROR MAPPING SERVICE
// ============================================================================

/**
 * Auth Error Mapping Service
 * Mapped Provider/Supabase Fehler zu einheitlichen Auth-Fehlern
 */
export class AuthErrorMapper {
  private config: ErrorMappingConfig;
  private retryCounts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorMappingConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }

  /**
   * Mapped Provider-Fehler zu Auth-Fehler
   */
  mapError(providerError: ProviderError, context?: string): AuthError {
    const mappedError = this.findMapping(providerError);
    const retryCount = this.getRetryCount(context);
    
    return {
      code: mappedError.code,
      message: this.formatMessage(mappedError, retryCount),
      timestamp: Date.now(),
      retryable: this.shouldRetry(mappedError, retryCount),
      retryAfter: this.calculateRetryDelay(mappedError, retryCount)
    };
  }

  /**
   * Mapped Supabase-spezifische Fehler
   */
  mapSupabaseError(supabaseError: any, context?: string): AuthError {
    const providerError: ProviderError = {
      code: supabaseError?.code || 'unknown',
      message: supabaseError?.message || 'Unknown error',
      status: supabaseError?.status,
      details: supabaseError?.details
    };

    return this.mapError(providerError, context);
  }

  /**
   * Mapped Network/HTTP Fehler
   */
  mapNetworkError(error: any, context?: string): AuthError {
    const providerError: ProviderError = {
      code: this.determineNetworkErrorCode(error),
      message: error?.message || 'Network error',
      status: error?.status || error?.statusCode
    };

    return this.mapError(providerError, context);
  }

  /**
   * Mapped Apple SSO Fehler
   */
  mapAppleError(error: any, context?: string): AuthError {
    const providerError: ProviderError = {
      code: this.determineAppleErrorCode(error),
      message: error?.message || 'Apple authentication failed',
      details: error?.details
    };

    return this.mapError(providerError, context);
  }

  /**
   * Registriert einen Retry-Versuch
   */
  recordRetry(context?: string): void {
    const key = context || 'default';
    const currentCount = this.retryCounts.get(key) || 0;
    this.retryCounts.set(key, currentCount + 1);
  }

  /**
   * Reset Retry-Counter
   */
  resetRetryCount(context?: string): void {
    const key = context || 'default';
    this.retryCounts.delete(key);
  }

  /**
   * Prüft ob weitere Retry-Versuche erlaubt sind
   */
  canRetry(context?: string): boolean {
    const retryCount = this.getRetryCount(context);
    return retryCount < this.config.maxRetryAttempts;
  }

  /**
   * Gibt Retry-Statistiken zurück
   */
  getRetryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.retryCounts.forEach((count, context) => {
      stats[context] = count;
    });
    return stats;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private findMapping(providerError: ProviderError): MappedAuthError {
    // Direkte Message-Match
    if (SUPABASE_ERROR_MAP[providerError.message]) {
      return SUPABASE_ERROR_MAP[providerError.message];
    }

    // Code-basierte Suche
    const codeMatch = Object.values(SUPABASE_ERROR_MAP).find(
      mapping => mapping.telemetryCode.includes(providerError.code)
    );
    if (codeMatch) {
      return codeMatch;
    }

    // Status-Code basierte Zuordnung
    if (providerError.status) {
      return this.mapByStatusCode(providerError.status);
    }

    // Fallback zu unbekanntem Fehler
    return {
      code: AuthErrorCode.UNKNOWN_ERROR,
      message: 'Ein Fehler ist aufgetreten',
      retryable: true,
      backoffRequired: true,
      telemetryCode: 'AUTH_UNKNOWN_ERROR'
    };
  }

  private mapByStatusCode(statusCode: number): MappedAuthError {
    switch (statusCode) {
      case 400:
        return {
          code: AuthErrorCode.API_ERROR,
          message: 'Ungültige Anfrage',
          retryable: false,
          backoffRequired: false,
          telemetryCode: 'AUTH_BAD_REQUEST'
        };
      
      case 401:
        return {
          code: AuthErrorCode.TOKEN_INVALID,
          message: 'Nicht autorisiert',
          retryable: false,
          backoffRequired: false,
          telemetryCode: 'AUTH_UNAUTHORIZED'
        };
      
      case 403:
        return {
          code: AuthErrorCode.ACCOUNT_LOCKED,
          message: 'Zugriff verweigert',
          retryable: true,
          backoffRequired: true,
          retryAfter: 300000, // 5 Minuten
          telemetryCode: 'AUTH_FORBIDDEN'
        };
      
      case 429:
        return {
          code: AuthErrorCode.TOO_MANY_REQUESTS,
          message: 'Zu viele Anfragen',
          retryable: true,
          backoffRequired: true,
          retryAfter: 60000, // 1 Minute
          telemetryCode: 'AUTH_RATE_LIMITED'
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: AuthErrorCode.API_ERROR,
          message: 'Server-Fehler',
          retryable: true,
          backoffRequired: true,
          retryAfter: 10000, // 10 Sekunden
          telemetryCode: 'AUTH_SERVER_ERROR'
        };
      
      default:
        return {
          code: AuthErrorCode.UNKNOWN_ERROR,
          message: 'Ein Fehler ist aufgetreten',
          retryable: true,
          backoffRequired: true,
          telemetryCode: 'AUTH_UNKNOWN_ERROR'
        };
    }
  }

  private formatMessage(mappedError: MappedAuthError, retryCount: number): string {
    let message = this.config.genericMessages 
      ? GENERIC_ERROR_MESSAGES[mappedError.code]
      : mappedError.message;

    // Retry-Information hinzufügen
    if (retryCount > 0 && mappedError.retryable) {
      const remainingAttempts = this.config.maxRetryAttempts - retryCount;
      if (remainingAttempts > 0) {
        message += ` (Versuch ${retryCount + 1}/${this.config.maxRetryAttempts})`;
      }
    }

    // Error-Code hinzufügen (optional)
    if (this.config.includeCodes) {
      message += ` [${mappedError.telemetryCode}]`;
    }

    return message;
  }

  private shouldRetry(mappedError: MappedAuthError, retryCount: number): boolean {
    if (!mappedError.retryable) {
      return false;
    }

    if (retryCount >= this.config.maxRetryAttempts) {
      return false;
    }

    return true;
  }

  private calculateRetryDelay(mappedError: MappedAuthError, retryCount: number): number | undefined {
    if (!mappedError.retryable || retryCount >= this.config.maxRetryAttempts) {
      return undefined;
    }

    if (mappedError.retryAfter) {
      return mappedError.retryAfter;
    }

    if (mappedError.backoffRequired) {
      return this.config.baseRetryDelay * Math.pow(this.config.backoffMultiplier, retryCount);
    }

    return this.config.baseRetryDelay;
  }

  private getRetryCount(context?: string): number {
    const key = context || 'default';
    return this.retryCounts.get(key) || 0;
  }

  private determineNetworkErrorCode(error: any): string {
    if (error?.name === 'AbortError') {
      return 'timeout';
    }
    if (error?.name === 'NetworkError') {
      return 'network';
    }
    if (error?.code === 'NETWORK_ERROR') {
      return 'network';
    }
    return 'unknown';
  }

  private determineAppleErrorCode(error: any): string {
    if (error?.code === 'ERR_CANCELED') {
      return 'cancelled';
    }
    if (error?.code === 'ERR_INVALID_RESPONSE') {
      return 'invalid_response';
    }
    return 'unknown';
  }
}

// ============================================================================
// SINGLETON & FACTORY
// ============================================================================

let authErrorMapperInstance: AuthErrorMapper | null = null;

export function getAuthErrorMapper(config?: Partial<ErrorMappingConfig>): AuthErrorMapper {
  if (!authErrorMapperInstance) {
    authErrorMapperInstance = new AuthErrorMapper(config);
  }
  return authErrorMapperInstance;
}

/**
 * Für Tests: Reset der Singleton-Instance
 */
export function resetAuthErrorMapper(): void {
  authErrorMapperInstance = null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Schnelle Fehler-Mapping-Funktion
 */
export function mapAuthError(error: any, context?: string): AuthError {
  const mapper = getAuthErrorMapper();
  return mapper.mapError(error, context);
}

/**
 * Supabase-spezifische Mapping-Funktion
 */
export function mapSupabaseAuthError(error: any, context?: string): AuthError {
  const mapper = getAuthErrorMapper();
  return mapper.mapSupabaseError(error, context);
}

/**
 * Network-Fehler Mapping-Funktion
 */
export function mapNetworkAuthError(error: any, context?: string): AuthError {
  const mapper = getAuthErrorMapper();
  return mapper.mapNetworkError(error, context);
}
