/**
 * Breath Session Persistence Service
 * Speichert Atem-Sessions mit Offline-Support und Duplikat-Schutz
 */

import { BreathingSessionsService } from '../db/sessions.service';
import { OfflineOutbox } from '../offline/outbox';
import { CreateBreathingSession, BreathingSession } from '../../models/session.model';
import { BreathSessionInfo } from './controller';
import { NetworkStatus } from '../../lib/net/network';

// ============================================================================
// TYPES
// ============================================================================

export interface BreathSessionData {
  userId: string;
  method: string;
  durationSec: number;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  interruptions?: number;
  cycles?: number;
}

export interface PersistResult {
  success: boolean;
  sessionId?: string;
  isOffline: boolean;
  error?: string;
  retryCount?: number;
}

export interface PersistOptions {
  forceOnline?: boolean;
  retryOnConflict?: boolean;
  timeout?: number;
}

// ============================================================================
// PERSISTENCE SERVICE
// ============================================================================

/**
 * Breath Session Persistence Service
 * Handhabt das Speichern von Atem-Sessions mit Offline-Support
 */
export class BreathPersistenceService {
  private static instance: BreathPersistenceService;
  private outbox: OfflineOutbox;
  private networkStatus: NetworkStatus = 'unknown';
  private pendingSessions: Map<string, BreathSessionData> = new Map();
  private duplicateWindowMs: number = 5000; // 5s Duplikat-Schutz

  private constructor() {
    this.outbox = OfflineOutbox.getInstance();
  }

  static getInstance(): BreathPersistenceService {
    if (!BreathPersistenceService.instance) {
      BreathPersistenceService.instance = new BreathPersistenceService();
    }
    return BreathPersistenceService.instance;
  }

  /**
   * Setzt Netzwerk-Status (wird von NetworkListener aufgerufen)
   */
  setNetworkStatus(status: NetworkStatus): void {
    this.networkStatus = status;
  }

  /**
   * Speichert eine Atem-Session
   */
  async persistSession(
    sessionData: BreathSessionData,
    options: PersistOptions = {}
  ): Promise<PersistResult> {
    try {
      // Duplikat-Schutz
      const duplicateKey = this.createDuplicateKey(sessionData);
      if (this.isDuplicate(duplicateKey)) {
        return {
          success: false,
          isOffline: false,
          error: 'Duplicate session detected'
        };
      }

      // Validiere Session-Daten
      const validationErrors = this.validateSessionData(sessionData);
      if (validationErrors.length > 0) {
        return {
          success: false,
          isOffline: false,
          error: `Validation failed: ${validationErrors.join(', ')}`
        };
      }

      // Mappe zu CreateBreathingSession
      const createSession: CreateBreathingSession = {
        userId: sessionData.userId,
        method: sessionData.method as any, // Validierung erfolgt in DB-Service
        durationSec: sessionData.durationSec,
        completed: sessionData.completed
      };

      // Online-Speicherung versuchen
      if (this.networkStatus === 'online' && !options.forceOnline) {
        try {
          const session = await BreathingSessionsService.create(createSession);
          
          // Erfolgreich gespeichert
          this.markAsProcessed(duplicateKey);
          
          return {
            success: true,
            sessionId: session.id,
            isOffline: false
          };
        } catch (error: any) {
          // Online-Speicherung fehlgeschlagen, zu Outbox hinzufügen
          console.warn('Online session save failed, adding to outbox:', error.message);
        }
      }

      // Offline-Speicherung über Outbox
      const outboxItem = await this.outbox.addItem(
        'create',
        'sessions',
        sessionData.userId,
        createSession
      );

      this.markAsProcessed(duplicateKey);

      return {
        success: true,
        sessionId: outboxItem.id,
        isOffline: true
      };

    } catch (error: any) {
      console.error('Session persistence failed:', error);
      
      return {
        success: false,
        isOffline: this.networkStatus === 'offline',
        error: error.message
      };
    }
  }

  /**
   * Speichert Session aus BreathController
   */
  async persistFromController(
    sessionInfo: BreathSessionInfo,
    userId: string,
    options: PersistOptions = {}
  ): Promise<PersistResult> {
    const sessionData: BreathSessionData = {
      userId,
      method: sessionInfo.method,
      durationSec: Math.round(sessionInfo.elapsedMs / 1000),
      completed: sessionInfo.status === 'completed',
      startTime: sessionInfo.startTime,
      endTime: sessionInfo.endTime,
      interruptions: sessionInfo.interruptions,
      cycles: sessionInfo.cycles
    };

    return this.persistSession(sessionData, options);
  }

  /**
   * Prüft ob Session bereits verarbeitet wurde
   */
  private isDuplicate(duplicateKey: string): boolean {
    const now = Date.now();
    const pendingSession = this.pendingSessions.get(duplicateKey);
    
    if (pendingSession) {
      // Prüfe ob innerhalb des Duplikat-Fensters
      const timeDiff = now - (pendingSession.startTime || now);
      if (timeDiff < this.duplicateWindowMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Markiert Session als verarbeitet
   */
  private markAsProcessed(duplicateKey: string): void {
    this.pendingSessions.set(duplicateKey, {
      userId: '',
      method: '',
      durationSec: 0,
      completed: false,
      startTime: Date.now()
    });

    // Cleanup nach Duplikat-Fenster
    setTimeout(() => {
      this.pendingSessions.delete(duplicateKey);
    }, this.duplicateWindowMs);
  }

  /**
   * Erstellt Duplikat-Schlüssel
   */
  private createDuplicateKey(sessionData: BreathSessionData): string {
    return `${sessionData.userId}-${sessionData.method}-${sessionData.durationSec}-${sessionData.completed}`;
  }

  /**
   * Validiert Session-Daten
   */
  private validateSessionData(sessionData: BreathSessionData): string[] {
    const errors: string[] = [];

    if (!sessionData.userId) {
      errors.push('User-ID ist erforderlich');
    }

    if (!sessionData.method) {
      errors.push('Methode ist erforderlich');
    }

    if (typeof sessionData.durationSec !== 'number' || sessionData.durationSec <= 0) {
      errors.push('Dauer muss eine positive Zahl sein');
    }

    if (sessionData.durationSec > 3600) {
      errors.push('Dauer darf maximal 1 Stunde betragen');
    }

    if (typeof sessionData.completed !== 'boolean') {
      errors.push('Completed-Status ist erforderlich');
    }

    return errors;
  }

  /**
   * Gibt Statistiken zurück
   */
  getStats(): {
    pendingSessions: number;
    networkStatus: NetworkStatus;
    outboxSize: number;
  } {
    return {
      pendingSessions: this.pendingSessions.size,
      networkStatus: this.networkStatus,
      outboxSize: 0 // TODO: Implement outbox size tracking
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.pendingSessions.clear();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Erstellt Persistence Service Instance
 */
export function createBreathPersistenceService(): BreathPersistenceService {
  return BreathPersistenceService.getInstance();
}

/**
 * Utility-Funktionen für Session-Persistenz
 */
export const BreathPersistenceUtils = {
  /**
   * Formatiert Session-Daten für Logging
   */
  formatSessionForLog(sessionData: BreathSessionData): string {
    return `Session: ${sessionData.method} (${sessionData.durationSec}s, ${sessionData.completed ? 'completed' : 'incomplete'})`;
  },

  /**
   * Berechnet Session-Hash für Duplikat-Erkennung
   */
  calculateSessionHash(sessionData: BreathSessionData): string {
    const data = `${sessionData.userId}-${sessionData.method}-${sessionData.durationSec}-${sessionData.completed}`;
    // Einfacher Hash für Duplikat-Erkennung
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  },

  /**
   * Validiert Session-Daten
   */
  validateSessionData(sessionData: BreathSessionData): string[] {
    const errors: string[] = [];

    if (!sessionData.userId || typeof sessionData.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }

    if (!sessionData.method || typeof sessionData.method !== 'string') {
      errors.push('Methode ist erforderlich und muss ein String sein');
    }

    if (typeof sessionData.durationSec !== 'number' || sessionData.durationSec <= 0) {
      errors.push('Dauer muss eine positive Zahl sein');
    }

    if (sessionData.durationSec > 3600) {
      errors.push('Dauer darf maximal 1 Stunde betragen');
    }

    if (typeof sessionData.completed !== 'boolean') {
      errors.push('Completed-Status ist erforderlich');
    }

    return errors;
  }
};
