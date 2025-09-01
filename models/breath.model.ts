/**
 * Breath Model
 * Erweiterte Modelle für Atem-Übungen basierend auf dem Methoden-Katalog
 */

import { 
  BreathingMethod, 
  BreathingPhase, 
  BreathingPhaseConfig, 
  BreathingMethodConfig,
  CustomBreathingConfig,
  BREATHING_METHODS,
  calculateSessionDuration
} from '../services/breath/methods.catalog';

/**
 * Atem-Session-Status
 */
export type BreathingSessionStatus = 
  | 'preparing'    // Vorbereitung
  | 'active'       // Läuft
  | 'paused'       // Pausiert
  | 'completed'    // Abgeschlossen
  | 'cancelled'    // Abgebrochen
  | 'error';       // Fehler

/**
 * Atem-Session-Phase-Status
 */
export interface BreathingPhaseStatus {
  phase: BreathingPhase;
  startTime: number; // Unix timestamp
  endTime?: number;  // Unix timestamp
  durationSec: number;
  remainingSec: number;
  isActive: boolean;
}

/**
 * Atem-Session-Konfiguration
 */
export interface BreathingSessionConfig {
  method: BreathingMethod;
  phases: BreathingPhaseConfig;
  cycles: number;
  customName?: string; // Für benutzerdefinierte Methoden
  audioEnabled: boolean;
  hapticEnabled: boolean;
  backgroundAudio: boolean;
}

/**
 * Atem-Session-Ergebnis
 */
export interface BreathingSessionResult {
  id: string;
  userId: string;
  config: BreathingSessionConfig;
  status: BreathingSessionStatus;
  startTime: number; // Unix timestamp
  endTime?: number;  // Unix timestamp
  actualDurationSec: number;
  completedCycles: number;
  totalCycles: number;
  interruptions: number;
  averageCycleTimeSec: number;
  timestamp: string; // ISO-UTC timestamp
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

/**
 * Atem-Session für Erstellung
 */
export interface CreateBreathingSession {
  userId: string;
  config: BreathingSessionConfig;
}

/**
 * Atem-Session für Updates
 */
export interface UpdateBreathingSession {
  status?: BreathingSessionStatus;
  endTime?: number;
  actualDurationSec?: number;
  completedCycles?: number;
  interruptions?: number;
  averageCycleTimeSec?: number;
}

/**
 * Atem-Session für API-Responses (ohne userId)
 */
export interface BreathingSessionResponse {
  id: string;
  config: BreathingSessionConfig;
  status: BreathingSessionStatus;
  startTime: number;
  endTime?: number;
  actualDurationSec: number;
  completedCycles: number;
  totalCycles: number;
  interruptions: number;
  averageCycleTimeSec: number;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Atem-Statistik für einen Zeitraum
 */
export interface BreathingStats {
  totalSessions: number;
  completedSessions: number;
  totalDurationSec: number;
  averageDurationSec: number;
  totalCycles: number;
  averageCyclesPerSession: number;
  methodUsage: Record<BreathingMethod, number>;
  categoryUsage: Record<string, number>;
  completionRate: number;
  averageInterruptions: number;
  bestMethod: BreathingMethod;
  mostUsedCategory: string;
}

/**
 * Atem-Session-Ereignis
 */
export interface BreathingSessionEvent {
  type: 'start' | 'pause' | 'resume' | 'complete' | 'cancel' | 'phase_change' | 'interruption';
  sessionId: string;
  timestamp: number; // Unix timestamp
  data?: {
    phase?: BreathingPhase;
    cycle?: number;
    reason?: string;
  };
}

/**
 * Validierung für Atem-Sessions
 */
export class BreathSessionValidator {
  /**
   * Validiert eine Atem-Session-Konfiguration
   */
  static validateConfig(config: BreathingSessionConfig): string[] {
    const errors: string[] = [];

    // Validiere Methode
    if (!Object.keys(BREATHING_METHODS).includes(config.method)) {
      errors.push('Ungültige Atem-Methode');
    }

    // Validiere Phasen
    const { phases } = config;
    if (phases.inhaleSec < 1 || phases.inhaleSec > 20) {
      errors.push('Einatmung muss zwischen 1-20 Sekunden liegen');
    }

    if (phases.holdSec < 0 || phases.holdSec > 20) {
      errors.push('Halten muss zwischen 0-20 Sekunden liegen');
    }

    if (phases.exhaleSec < 1 || phases.exhaleSec > 20) {
      errors.push('Ausatmung muss zwischen 1-20 Sekunden liegen');
    }

    if (phases.holdAfterExhaleSec < 0 || phases.holdAfterExhaleSec > 20) {
      errors.push('Halten nach Ausatmung muss zwischen 0-20 Sekunden liegen');
    }

    // Validiere Zyklen
    const methodConfig = BREATHING_METHODS[config.method];
    if (config.cycles < methodConfig.minCycles || config.cycles > methodConfig.maxCycles) {
      errors.push(`Zyklen müssen zwischen ${methodConfig.minCycles}-${methodConfig.maxCycles} liegen`);
    }

    // Validiere Gesamtdauer
    const totalDuration = calculateSessionDuration(phases, config.cycles);
    if (totalDuration < 30) {
      errors.push('Session muss mindestens 30 Sekunden dauern');
    }

    if (totalDuration > 3600) {
      errors.push('Session darf maximal 1 Stunde dauern');
    }

    return errors;
  }

  /**
   * Validiert eine Atem-Session
   */
  static validateSession(session: BreathingSessionResult): string[] {
    const errors: string[] = [];

    if (!session.id || typeof session.id !== 'string') {
      errors.push('ID ist erforderlich und muss ein String sein');
    }

    if (!session.userId || typeof session.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }

    if (!session.config) {
      errors.push('Konfiguration ist erforderlich');
    } else {
      errors.push(...this.validateConfig(session.config));
    }

    if (!Object.values(BreathingSessionStatus).includes(session.status)) {
      errors.push('Ungültiger Session-Status');
    }

    if (session.startTime <= 0) {
      errors.push('Startzeit muss positiv sein');
    }

    if (session.endTime && session.endTime < session.startTime) {
      errors.push('Endzeit muss nach Startzeit liegen');
    }

    if (session.actualDurationSec < 0) {
      errors.push('Tatsächliche Dauer darf nicht negativ sein');
    }

    if (session.completedCycles < 0 || session.completedCycles > session.totalCycles) {
      errors.push('Abgeschlossene Zyklen müssen zwischen 0 und Gesamtzyklen liegen');
    }

    if (session.interruptions < 0) {
      errors.push('Unterbrechungen dürfen nicht negativ sein');
    }

    return errors;
  }

  /**
   * Validiert CreateBreathingSession
   */
  static validateCreateSession(session: CreateBreathingSession): string[] {
    const errors: string[] = [];

    if (!session.userId || typeof session.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }

    if (!session.config) {
      errors.push('Konfiguration ist erforderlich');
    } else {
      errors.push(...this.validateConfig(session.config));
    }

    return errors;
  }

  /**
   * Validiert UpdateBreathingSession
   */
  static validateUpdateSession(session: UpdateBreathingSession): string[] {
    const errors: string[] = [];

    if (session.status && !Object.values(BreathingSessionStatus).includes(session.status)) {
      errors.push('Ungültiger Session-Status');
    }

    if (session.endTime && session.endTime <= 0) {
      errors.push('Endzeit muss positiv sein');
    }

    if (session.actualDurationSec !== undefined && session.actualDurationSec < 0) {
      errors.push('Tatsächliche Dauer darf nicht negativ sein');
    }

    if (session.completedCycles !== undefined && session.completedCycles < 0) {
      errors.push('Abgeschlossene Zyklen dürfen nicht negativ sein');
    }

    if (session.interruptions !== undefined && session.interruptions < 0) {
      errors.push('Unterbrechungen dürfen nicht negativ sein');
    }

    if (session.averageCycleTimeSec !== undefined && session.averageCycleTimeSec < 0) {
      errors.push('Durchschnittliche Zykluszeit darf nicht negativ sein');
    }

    return errors;
  }
}

/**
 * Erstellt eine neue Atem-Session mit normalisierten Daten
 */
export function createBreathingSession(data: CreateBreathingSession): CreateBreathingSession {
  return {
    userId: data.userId,
    config: {
      ...data.config,
      audioEnabled: data.config.audioEnabled ?? true,
      hapticEnabled: data.config.hapticEnabled ?? true,
      backgroundAudio: data.config.backgroundAudio ?? false
    }
  };
}

/**
 * Konvertiert Atem-Session zu Response-Format
 */
export function toBreathingSessionResponse(session: BreathingSessionResult): BreathingSessionResponse {
  return {
    id: session.id,
    config: session.config,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    actualDurationSec: session.actualDurationSec,
    completedCycles: session.completedCycles,
    totalCycles: session.totalCycles,
    interruptions: session.interruptions,
    averageCycleTimeSec: session.averageCycleTimeSec,
    timestamp: session.timestamp,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

/**
 * Berechnet Statistiken für Atem-Sessions
 */
export function calculateBreathingStats(sessions: BreathingSessionResult[]): BreathingStats {
  const completed = sessions.filter(s => s.status === 'completed');
  const totalDuration = completed.reduce((sum, s) => sum + s.actualDurationSec, 0);
  const totalCycles = completed.reduce((sum, s) => sum + s.completedCycles, 0);
  const totalInterruptions = completed.reduce((sum, s) => sum + s.interruptions, 0);
  
  const methodUsage = new Map<BreathingMethod, number>();
  const categoryUsage = new Map<string, number>();
  
  completed.forEach(session => {
    const method = session.config.method;
    methodUsage.set(method, (methodUsage.get(method) || 0) + 1);
    
    const category = BREATHING_METHODS[method].category;
    categoryUsage.set(category, (categoryUsage.get(category) || 0) + 1);
  });

  // Beste Methode (meiste Verwendung)
  const bestMethod = Array.from(methodUsage.entries())
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'box';

  // Meistgenutzte Kategorie
  const mostUsedCategory = Array.from(categoryUsage.entries())
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'relaxation';

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    totalDurationSec: totalDuration,
    averageDurationSec: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    totalCycles,
    averageCyclesPerSession: completed.length > 0 ? Math.round(totalCycles / completed.length) : 0,
    methodUsage: Object.fromEntries(methodUsage),
    categoryUsage: Object.fromEntries(categoryUsage),
    completionRate: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0,
    averageInterruptions: completed.length > 0 ? Math.round(totalInterruptions / completed.length) : 0,
    bestMethod,
    mostUsedCategory
  };
}

/**
 * Gruppiert Sessions nach Datum
 */
export function groupBreathingSessionsByDate(sessions: BreathingSessionResult[]): Map<string, BreathingSessionResult[]> {
  const grouped = new Map<string, BreathingSessionResult[]>();
  
  sessions.forEach(session => {
    const date = session.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(session);
  });
  
  return grouped;
}

/**
 * Filtert Sessions nach Methode
 */
export function filterSessionsByMethod(sessions: BreathingSessionResult[], method: BreathingMethod): BreathingSessionResult[] {
  return sessions.filter(session => session.config.method === method);
}

/**
 * Filtert Sessions nach Status
 */
export function filterSessionsByStatus(sessions: BreathingSessionResult[], status: BreathingSessionStatus): BreathingSessionResult[] {
  return sessions.filter(session => session.status === status);
}

/**
 * Sortiert Sessions nach Datum (neueste zuerst)
 */
export function sortSessionsByDate(sessions: BreathingSessionResult[]): BreathingSessionResult[] {
  return [...sessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Sortiert Sessions nach Dauer (längste zuerst)
 */
export function sortSessionsByDuration(sessions: BreathingSessionResult[]): BreathingSessionResult[] {
  return [...sessions].sort((a, b) => b.actualDurationSec - a.actualDurationSec);
}
