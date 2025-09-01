/**
 * Einheitliches Fehler-Schema für DB-Operationen
 * Keine PII in Fehlermeldungen - nur Codes und knappe Messages
 */
export interface DBError {
  code: string;
  message: string;
  retryable: boolean;
  cause?: Error;
  timestamp: Date;
}

/**
 * Fehler-Codes für DB-Operationen
 */
export enum DBErrorCode {
  // Authentifizierung
  UNAUTHORIZED = 'DB_UNAUTHORIZED',
  TOKEN_EXPIRED = 'DB_TOKEN_EXPIRED',
  
  // Netzwerk
  NETWORK_ERROR = 'DB_NETWORK_ERROR',
  TIMEOUT = 'DB_TIMEOUT',
  OFFLINE = 'DB_OFFLINE',
  
  // Datenbank
  NOT_FOUND = 'DB_NOT_FOUND',
  CONFLICT = 'DB_CONFLICT',
  VALIDATION_ERROR = 'DB_VALIDATION_ERROR',
  RLS_VIOLATION = 'DB_RLS_VIOLATION',
  
  // Konfiguration
  CONFIG_ERROR = 'DB_CONFIG_ERROR',
  
  // Unbekannt
  UNKNOWN = 'DB_UNKNOWN'
}

/**
 * Erstellt ein strukturiertes DBError-Objekt
 */
export function createDBError(
  code: DBErrorCode,
  message: string,
  retryable: boolean = false,
  cause?: Error
): DBError {
  return {
    code,
    message,
    retryable,
    cause,
    timestamp: new Date()
  };
}

/**
 * Mappt HTTP-Status-Codes zu DBError-Codes
 */
export function mapHttpStatusToDBError(status: number, message?: string): DBError {
  switch (status) {
    case 401:
      return createDBError(
        DBErrorCode.UNAUTHORIZED,
        message || 'Nicht autorisiert',
        false
      );
    case 404:
      return createDBError(
        DBErrorCode.NOT_FOUND,
        message || 'Ressource nicht gefunden',
        false
      );
    case 409:
      return createDBError(
        DBErrorCode.CONFLICT,
        message || 'Datenkonflikt',
        true
      );
    case 422:
      return createDBError(
        DBErrorCode.VALIDATION_ERROR,
        message || 'Validierungsfehler',
        false
      );
    default:
      return createDBError(
        DBErrorCode.UNKNOWN,
        message || `HTTP ${status}`,
        status >= 500
      );
  }
}

/**
 * Mappt Supabase-Fehler zu DBError
 */
export function mapSupabaseError(error: any): DBError {
  // Netzwerk-Fehler
  if (error.message?.includes('fetch')) {
    return createDBError(
      DBErrorCode.NETWORK_ERROR,
      'Netzwerkfehler',
      true,
      error
    );
  }
  
  // Timeout
  if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
    return createDBError(
      DBErrorCode.TIMEOUT,
      'Anfrage-Timeout',
      true,
      error
    );
  }
  
  // Offline
  if (!navigator.onLine || error.message?.includes('offline')) {
    return createDBError(
      DBErrorCode.OFFLINE,
      'Offline-Modus',
      true,
      error
    );
  }
  
  // Supabase-spezifische Fehler
  if (error.code) {
    switch (error.code) {
      case 'PGRST301':
        return createDBError(
          DBErrorCode.RLS_VIOLATION,
          'Zugriff verweigert',
          false,
          error
        );
      case 'PGRST116':
        return createDBError(
          DBErrorCode.VALIDATION_ERROR,
          'Datenvalidierung fehlgeschlagen',
          false,
          error
        );
      default:
        return createDBError(
          DBErrorCode.UNKNOWN,
          `DB-Fehler: ${error.code}`,
          false,
          error
        );
    }
  }
  
  // Fallback
  return createDBError(
    DBErrorCode.UNKNOWN,
    'Unbekannter DB-Fehler',
    false,
    error
  );
}

/**
 * Loggt DB-Fehler ohne PII
 */
export function logDBError(error: DBError): void {
  const logData = {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    timestamp: error.timestamp.toISOString()
  };
  
  // Optional: Sentry-Integration
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    // Sentry.captureException(error.cause || new Error(error.message), {
    //   tags: { component: 'db', errorCode: error.code },
    //   extra: logData
    // });
  }
  
  console.error('DB Error:', logData);
}
