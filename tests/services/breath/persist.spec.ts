/**
 * Breath Persistence Service Tests
 * Testet Session-Persistenz mit Offline-Support und Duplikat-Schutz
 */

import { 
  BreathPersistenceService, 
  createBreathPersistenceService,
  BreathPersistenceUtils,
  BreathSessionData,
  PersistResult,
  PersistOptions
} from '../../../services/breath/persist';
import { BreathSessionInfo } from '../../../services/breath/controller';

// Mock dependencies
jest.mock('../../../services/db/sessions.service', () => ({
  BreathingSessionsService: {
    create: jest.fn()
  }
}));
jest.mock('../../../services/offline/outbox', () => ({
  OfflineOutbox: {
    getInstance: jest.fn()
  }
}));

describe('Breath Persistence Service', () => {
  let persistenceService: BreathPersistenceService;
  let mockOutboxInstance: any;
  let mockBreathingSessionsService: any;
  let mockOfflineOutbox: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Outbox instance
    mockOutboxInstance = {
      addItem: jest.fn(),
      processQueue: jest.fn(),
      getStats: jest.fn()
    };
    
    // Get mocked modules
    mockBreathingSessionsService = require('../../../services/db/sessions.service').BreathingSessionsService;
    mockOfflineOutbox = require('../../../services/offline/outbox').OfflineOutbox;
    
    mockOfflineOutbox.getInstance.mockReturnValue(mockOutboxInstance);
    
    // Reset singleton instance
    (BreathPersistenceService as any).instance = undefined;
    persistenceService = createBreathPersistenceService();
  });

  afterEach(() => {
    persistenceService.cleanup();
  });

  describe('Konstruktor und Initialisierung', () => {
    it('sollte Service mit Singleton-Pattern erstellen', () => {
      const service1 = createBreathPersistenceService();
      const service2 = createBreathPersistenceService();
      
      expect(service1).toBe(service2);
    });

    it('sollte Outbox-Instance initialisieren', () => {
      expect(mockOfflineOutbox.getInstance).toHaveBeenCalled();
    });

    it('sollte Netzwerk-Status setzen', () => {
      persistenceService.setNetworkStatus('online');
      persistenceService.setNetworkStatus('offline');
      
      // Status wird intern gespeichert
      expect(persistenceService.getStats().networkStatus).toBe('offline');
    });
  });

  describe('Session-Persistenz', () => {
    const validSessionData: BreathSessionData = {
      userId: 'user123',
      method: 'box',
      durationSec: 120,
      completed: true,
      startTime: Date.now() - 120000,
      endTime: Date.now(),
      interruptions: 0,
      cycles: 3
    };

    it('sollte Session erfolgreich online speichern', async () => {
      persistenceService.setNetworkStatus('online');
      
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      const result = await persistenceService.persistSession(validSessionData);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session123');
      expect(result.isOffline).toBe(false);
      expect(mockBreathingSessionsService.create).toHaveBeenCalledWith({
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      });
    });

    it('sollte Session offline über Outbox speichern', async () => {
      persistenceService.setNetworkStatus('offline');
      
      const mockOutboxItem = {
        id: 'outbox123',
        type: 'create',
        domain: 'sessions',
        userId: 'user123',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      mockOutboxInstance.addItem.mockResolvedValue(mockOutboxItem);

      const result = await persistenceService.persistSession(validSessionData);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('outbox123');
      expect(result.isOffline).toBe(true);
      expect(mockOutboxInstance.addItem).toHaveBeenCalledWith(
        'create',
        'sessions',
        'user123',
        {
          userId: 'user123',
          method: 'box',
          durationSec: 120,
          completed: true
        }
      );
    });

    it('sollte Online-Fehler zu Outbox umleiten', async () => {
      persistenceService.setNetworkStatus('online');
      
      mockBreathingSessionsService.create.mockRejectedValue(new Error('Network error'));
      
      const mockOutboxItem = {
        id: 'outbox123',
        type: 'create',
        domain: 'sessions',
        userId: 'user123',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      mockOutboxInstance.addItem.mockResolvedValue(mockOutboxItem);

      const result = await persistenceService.persistSession(validSessionData);

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(mockOutboxInstance.addItem).toHaveBeenCalled();
    });

    it('sollte Duplikat-Sessions verhindern', async () => {
      persistenceService.setNetworkStatus('online');
      
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      // Erste Session
      const result1 = await persistenceService.persistSession(validSessionData);
      expect(result1.success).toBe(true);

      // Zweite identische Session (Duplikat)
      const result2 = await persistenceService.persistSession(validSessionData);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Duplicate session detected');
    });

    it('sollte Session-Daten validieren', async () => {
      const invalidSessionData: BreathSessionData = {
        userId: '',
        method: '',
        durationSec: -1,
        completed: false
      };

      const result = await persistenceService.persistSession(invalidSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('Controller-Integration', () => {
    const mockSessionInfo: BreathSessionInfo = {
      status: 'completed',
      method: 'box',
      phases: {
        inhale: { durationSec: 4 },
        hold: { durationSec: 4 },
        exhale: { durationSec: 4 },
        holdAfterExhale: { durationSec: 4 }
      },
      cycles: 3,
      currentPhase: 'inhale',
      currentCycle: 1,
      totalDurationMs: 120000,
      elapsedMs: 120000,
      remainingMs: 0,
      progress: 1.0,
      phaseInfo: {
        phase: 'inhale',
        phaseIndex: 0,
        cycleIndex: 1,
        totalCycles: 3,
        phaseDurationMs: 4000,
        phaseElapsedMs: 4000,
        phaseRemainingMs: 0,
        phaseProgress: 1.0,
        isActive: false
      },
      interruptions: 0,
      startTime: Date.now() - 120000,
      endTime: Date.now()
    };

    it('sollte Session aus Controller persistieren', async () => {
      persistenceService.setNetworkStatus('online');
      
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      const result = await persistenceService.persistFromController(
        mockSessionInfo,
        'user123'
      );

      expect(result.success).toBe(true);
      expect(mockBreathingSessionsService.create).toHaveBeenCalledWith({
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      });
    });

    it('sollte unvollständige Session korrekt markieren', async () => {
      const incompleteSessionInfo: BreathSessionInfo = {
        ...mockSessionInfo,
        status: 'cancelled',
        elapsedMs: 60000,
        progress: 0.5
      };

      persistenceService.setNetworkStatus('online');
      
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        method: 'box',
        durationSec: 60,
        completed: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      const result = await persistenceService.persistFromController(
        incompleteSessionInfo,
        'user123'
      );

      expect(result.success).toBe(true);
      expect(mockBreathingSessionsService.create).toHaveBeenCalledWith({
        userId: 'user123',
        method: 'box',
        durationSec: 60,
        completed: false
      });
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte Outbox-Fehler behandeln', async () => {
      persistenceService.setNetworkStatus('offline');
      
      mockOutboxInstance.addItem.mockRejectedValue(new Error('Outbox error'));

      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const result = await persistenceService.persistSession(sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Outbox error');
      expect(result.isOffline).toBe(true);
    });

    it('sollte Validierungsfehler behandeln', async () => {
      const invalidSessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 0, // Ungültig
        completed: true
      };

      const result = await persistenceService.persistSession(invalidSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dauer muss eine positive Zahl sein');
    });

    it('sollte extreme Dauer-Werte validieren', async () => {
      const invalidSessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 7200, // 2 Stunden - zu lang
        completed: true
      };

      const result = await persistenceService.persistSession(invalidSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dauer darf maximal 1 Stunde betragen');
    });
  });

  describe('Statistiken', () => {
    it('sollte aktuelle Statistiken zurückgeben', () => {
      persistenceService.setNetworkStatus('online');
      
      const stats = persistenceService.getStats();
      
      expect(stats.networkStatus).toBe('online');
      expect(stats.pendingSessions).toBe(0);
      expect(typeof stats.outboxSize).toBe('number');
    });

    it('sollte Pending-Sessions zählen', async () => {
      persistenceService.setNetworkStatus('online');
      
      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const mockSession = {
        id: 'session123',
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      await persistenceService.persistSession(sessionData);
      
      const stats = persistenceService.getStats();
      expect(stats.pendingSessions).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('sollte Service korrekt aufräumen', () => {
      persistenceService.cleanup();
      
      const stats = persistenceService.getStats();
      expect(stats.pendingSessions).toBe(0);
    });
  });

  describe('BreathPersistenceUtils', () => {
    it('sollte Session-Daten für Logging formatieren', () => {
      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const formatted = BreathPersistenceUtils.formatSessionForLog(sessionData);
      
      expect(formatted).toContain('Session: box');
      expect(formatted).toContain('120s');
      expect(formatted).toContain('completed');
    });

    it('sollte Session-Hash berechnen', () => {
      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const hash1 = BreathPersistenceUtils.calculateSessionHash(sessionData);
      const hash2 = BreathPersistenceUtils.calculateSessionHash(sessionData);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    it('sollte Session-Daten validieren', () => {
      const validSessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const errors = BreathPersistenceUtils.validateSessionData(validSessionData);
      expect(errors).toHaveLength(0);
    });

    it('sollte ungültige Session-Daten erkennen', () => {
      const invalidSessionData: BreathSessionData = {
        userId: '',
        method: '',
        durationSec: -1,
        completed: false
      };

      const errors = BreathPersistenceUtils.validateSessionData(invalidSessionData);
      
      expect(errors).toContain('User-ID ist erforderlich und muss ein String sein');
      expect(errors).toContain('Methode ist erforderlich und muss ein String sein');
      expect(errors).toContain('Dauer muss eine positive Zahl sein');
    });
  });

  describe('Offline-Szenarien', () => {
    it('sollte Offline-Modus korrekt handhaben', async () => {
      persistenceService.setNetworkStatus('offline');
      
      const mockOutboxItem = {
        id: 'outbox123',
        type: 'create',
        domain: 'sessions',
        userId: 'user123',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      mockOutboxInstance.addItem.mockResolvedValue(mockOutboxItem);

      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      const result = await persistenceService.persistSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(mockOutboxInstance.addItem).toHaveBeenCalled();
      expect(mockBreathingSessionsService.create).not.toHaveBeenCalled();
    });

    it('sollte Online-Modus nach Offline-Wiederherstellung', async () => {
      // Starte offline
      persistenceService.setNetworkStatus('offline');
      
      const mockOutboxItem = {
        id: 'outbox123',
        type: 'create',
        domain: 'sessions',
        userId: 'user123',
        payload: {},
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      mockOutboxInstance.addItem.mockResolvedValue(mockOutboxItem);

      const sessionData: BreathSessionData = {
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true
      };

      // Speichere offline
      await persistenceService.persistSession(sessionData);

      // Wechsle zu online
      persistenceService.setNetworkStatus('online');
      
      const mockSession = {
        id: 'session456',
        userId: 'user123',
        method: 'box',
        durationSec: 120,
        completed: true,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockBreathingSessionsService.create.mockResolvedValue(mockSession);

      // Neue Session sollte online gespeichert werden
      const result = await persistenceService.persistSession({
        ...sessionData,
        durationSec: 180 // Andere Dauer um Duplikat zu vermeiden
      });

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(false);
      expect(mockBreathingSessionsService.create).toHaveBeenCalled();
    });
  });
});
