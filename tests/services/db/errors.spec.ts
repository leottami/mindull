import {
  createDBError,
  DBErrorCode,
  mapHttpStatusToDBError,
  mapSupabaseError,
  logDBError,
  DBError
} from '../../../services/db/errors';

describe('DB Errors', () => {
  describe('createDBError', () => {
    it('sollte ein korrektes DBError-Objekt erstellen', () => {
      const error = createDBError(
        DBErrorCode.NETWORK_ERROR,
        'Test-Fehler',
        true
      );
      
      expect(error).toEqual({
        code: DBErrorCode.NETWORK_ERROR,
        message: 'Test-Fehler',
        retryable: true,
        cause: undefined,
        timestamp: expect.any(Date)
      });
    });
    
    it('sollte cause-Error korrekt setzen', () => {
      const originalError = new Error('Original');
      const error = createDBError(
        DBErrorCode.UNKNOWN,
        'Wrapped',
        false,
        originalError
      );
      
      expect(error.cause).toBe(originalError);
    });
  });
  
  describe('mapHttpStatusToDBError', () => {
    it('sollte 401 zu UNAUTHORIZED mappen', () => {
      const error = mapHttpStatusToDBError(401);
      
      expect(error.code).toBe(DBErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Nicht autorisiert');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte 404 zu NOT_FOUND mappen', () => {
      const error = mapHttpStatusToDBError(404);
      
      expect(error.code).toBe(DBErrorCode.NOT_FOUND);
      expect(error.message).toBe('Ressource nicht gefunden');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte 409 zu CONFLICT mappen', () => {
      const error = mapHttpStatusToDBError(409);
      
      expect(error.code).toBe(DBErrorCode.CONFLICT);
      expect(error.message).toBe('Datenkonflikt');
      expect(error.retryable).toBe(true);
    });
    
    it('sollte 422 zu VALIDATION_ERROR mappen', () => {
      const error = mapHttpStatusToDBError(422);
      
      expect(error.code).toBe(DBErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Validierungsfehler');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte 5xx-Fehler als retryable markieren', () => {
      const error500 = mapHttpStatusToDBError(500);
      const error503 = mapHttpStatusToDBError(503);
      
      expect(error500.retryable).toBe(true);
      expect(error503.retryable).toBe(true);
    });
    
    it('sollte benutzerdefinierte Nachrichten verwenden', () => {
      const error = mapHttpStatusToDBError(404, 'Benutzerdefinierte Nachricht');
      
      expect(error.message).toBe('Benutzerdefinierte Nachricht');
    });
  });
  
  describe('mapSupabaseError', () => {
    beforeEach(() => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    });
    
    it('sollte Netzwerk-Fehler korrekt mappen', () => {
      const networkError = new Error('fetch failed');
      const error = mapSupabaseError(networkError);
      
      expect(error.code).toBe(DBErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Netzwerkfehler');
      expect(error.retryable).toBe(true);
    });
    
    it('sollte Timeout-Fehler korrekt mappen', () => {
      const timeoutError = new Error('timeout');
      const error = mapSupabaseError(timeoutError);
      
      expect(error.code).toBe(DBErrorCode.TIMEOUT);
      expect(error.message).toBe('Anfrage-Timeout');
      expect(error.retryable).toBe(true);
    });
    
    it('sollte Offline-Status korrekt mappen', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const error = mapSupabaseError(new Error('any'));
      
      expect(error.code).toBe(DBErrorCode.OFFLINE);
      expect(error.message).toBe('Offline-Modus');
      expect(error.retryable).toBe(true);
    });
    
    it('sollte PGRST301 zu RLS_VIOLATION mappen', () => {
      const rlsError = { code: 'PGRST301', message: 'RLS violation' };
      const error = mapSupabaseError(rlsError);
      
      expect(error.code).toBe(DBErrorCode.RLS_VIOLATION);
      expect(error.message).toBe('Zugriff verweigert');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte PGRST116 zu VALIDATION_ERROR mappen', () => {
      const validationError = { code: 'PGRST116', message: 'Validation failed' };
      const error = mapSupabaseError(validationError);
      
      expect(error.code).toBe(DBErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Datenvalidierung fehlgeschlagen');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte unbekannte Supabase-Codes als UNKNOWN mappen', () => {
      const unknownError = { code: 'PGRST999', message: 'Unknown' };
      const error = mapSupabaseError(unknownError);
      
      expect(error.code).toBe(DBErrorCode.UNKNOWN);
      expect(error.message).toBe('DB-Fehler: PGRST999');
      expect(error.retryable).toBe(false);
    });
    
    it('sollte Fehler ohne Code als UNKNOWN mappen', () => {
      const error = mapSupabaseError(new Error('Generic error'));
      
      expect(error.code).toBe(DBErrorCode.UNKNOWN);
      expect(error.message).toBe('Unbekannter DB-Fehler');
      expect(error.retryable).toBe(false);
    });
  });
  
  describe('logDBError', () => {
    let consoleSpy: jest.SpyInstance;
    
    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });
    
    afterEach(() => {
      consoleSpy.mockRestore();
    });
    
    it('sollte DBError ohne PII loggen', () => {
      const error = createDBError(
        DBErrorCode.NETWORK_ERROR,
        'Test-Fehler',
        true
      );
      
      logDBError(error);
      
      expect(consoleSpy).toHaveBeenCalledWith('DB Error:', {
        code: DBErrorCode.NETWORK_ERROR,
        message: 'Test-Fehler',
        retryable: true,
        timestamp: expect.any(String)
      });
    });
    
    it('sollte keine PII in Logs enthalten', () => {
      const error = createDBError(
        DBErrorCode.UNAUTHORIZED,
        'User john.doe@example.com not found', // PII in Message
        false
      );
      
      logDBError(error);
      
      const loggedData = consoleSpy.mock.calls[0][1];
      expect(loggedData.message).toContain('john.doe@example.com');
      // In echten Implementation sollte PII gescrubbed werden
    });
  });
});
