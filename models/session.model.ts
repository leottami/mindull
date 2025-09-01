/**
 * Breathing Session Model
 * Atem-Übungen mit verschiedenen Methoden
 */

export type BreathingMethod = 
  | 'box'           // 4-4-4-4 Box Breathing
  | '478'           // 4-7-8 Breathing
  | 'coherent'      // 5-5 Coherent Breathing
  | 'triangle'      // 4-7-8 Triangle
  | 'custom';       // Benutzerdefinierte Zeiten

export interface BreathingSession {
  id: string;
  userId: string;
  method: BreathingMethod;
  durationSec: number;
  completed: boolean;
  timestamp: string; // ISO-UTC timestamp
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

/**
 * Breathing-Session für Erstellung
 */
export interface CreateBreathingSession {
  userId: string;
  method: BreathingMethod;
  durationSec: number;
  completed?: boolean;
}

/**
 * Breathing-Session für Updates
 */
export interface UpdateBreathingSession {
  completed?: boolean;
  durationSec?: number;
}

/**
 * Breathing-Session für API-Responses (ohne userId)
 */
export interface BreathingSessionResponse {
  id: string;
  method: BreathingMethod;
  durationSec: number;
  completed: boolean;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Atem-Methode-Konfiguration
 */
export interface BreathingMethodConfig {
  name: string;
  description: string;
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  cycles: number;
}

/**
 * Validierung für Breathing-Sessions
 */
export class SessionValidator {
  /**
   * Validiert Breathing-Method
   */
  static isValidMethod(method: string): method is BreathingMethod {
    return ['box', '478', 'coherent', 'triangle', 'custom'].includes(method);
  }
  
  /**
   * Validiert Dauer in Sekunden
   */
  static isValidDuration(durationSec: number): boolean {
    return Number.isInteger(durationSec) && durationSec > 0 && durationSec <= 3600; // Max 1h
  }
  
  /**
   * Validiert komplette Breathing-Session
   */
  static validateSession(session: BreathingSession): string[] {
    const errors: string[] = [];
    
    if (!session.id || typeof session.id !== 'string') {
      errors.push('ID ist erforderlich und muss ein String sein');
    }
    
    if (!session.userId || typeof session.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidMethod(session.method)) {
      errors.push('Ungültige Atem-Methode');
    }
    
    if (!this.isValidDuration(session.durationSec)) {
      errors.push('Dauer muss zwischen 1 und 3600 Sekunden liegen');
    }
    
    if (typeof session.completed !== 'boolean') {
      errors.push('Completed-Flag muss boolean sein');
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
    
    if (!this.isValidMethod(session.method)) {
      errors.push('Ungültige Atem-Methode');
    }
    
    if (!this.isValidDuration(session.durationSec)) {
      errors.push('Dauer muss zwischen 1 und 3600 Sekunden liegen');
    }
    
    return errors;
  }
  
  /**
   * Validiert UpdateBreathingSession
   */
  static validateUpdateSession(session: UpdateBreathingSession): string[] {
    const errors: string[] = [];
    
    if (session.completed !== undefined && typeof session.completed !== 'boolean') {
      errors.push('Completed-Flag muss boolean sein');
    }
    
    if (session.durationSec !== undefined && !this.isValidDuration(session.durationSec)) {
      errors.push('Dauer muss zwischen 1 und 3600 Sekunden liegen');
    }
    
    return errors;
  }
  
  /**
   * Prüft ob eine Session zu alt ist (älter als 1 Jahr)
   */
  static isTooOldSession(timestamp: string): boolean {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return new Date(timestamp) < oneYearAgo;
  }
  
  /**
   * Prüft ob eine Session in der Zukunft liegt
   */
  static isFutureSession(timestamp: string): boolean {
    return new Date(timestamp) > new Date();
  }
}

/**
 * Atem-Methoden-Konfigurationen
 */
export const BREATHING_METHODS: Record<BreathingMethod, BreathingMethodConfig> = {
  box: {
    name: 'Box Breathing',
    description: 'Gleichmäßiges 4-4-4-4 Atemmuster für Entspannung',
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    holdAfterExhaleSec: 4,
    cycles: 10
  },
  '478': {
    name: '4-7-8 Breathing',
    description: 'Tiefe Einatmung, lange Pause, vollständige Ausatmung',
    inhaleSec: 4,
    holdSec: 7,
    exhaleSec: 8,
    holdAfterExhaleSec: 0,
    cycles: 8
  },
  coherent: {
    name: 'Coherent Breathing',
    description: 'Gleichmäßige 5-5 Atmung für Herz-Kohärenz',
    inhaleSec: 5,
    holdSec: 0,
    exhaleSec: 5,
    holdAfterExhaleSec: 0,
    cycles: 12
  },
  triangle: {
    name: 'Triangle Breathing',
    description: 'Dreieckiges Atemmuster für Fokus',
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    holdAfterExhaleSec: 0,
    cycles: 10
  },
  custom: {
    name: 'Benutzerdefiniert',
    description: 'Eigene Atem-Zeiten',
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    holdAfterExhaleSec: 4,
    cycles: 10
  }
};

/**
 * Berechnet die Gesamtdauer einer Atem-Methode
 */
export function calculateMethodDuration(method: BreathingMethod): number {
  const config = BREATHING_METHODS[method];
  const cycleDuration = config.inhaleSec + config.holdSec + config.exhaleSec + config.holdAfterExhaleSec;
  return cycleDuration * config.cycles;
}

/**
 * Erstellt eine neue Breathing-Session mit normalisierten Daten
 */
export function createBreathingSession(data: CreateBreathingSession): CreateBreathingSession {
  return {
    userId: data.userId,
    method: data.method,
    durationSec: Math.round(data.durationSec), // Runden auf ganze Sekunden
    completed: data.completed ?? false
  };
}

/**
 * Konvertiert Breathing-Session zu Response-Format
 */
export function toBreathingSessionResponse(session: BreathingSession): BreathingSessionResponse {
  return {
    id: session.id,
    method: session.method,
    durationSec: session.durationSec,
    completed: session.completed,
    timestamp: session.timestamp,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

/**
 * Gruppiert Sessions nach Datum
 */
export function groupSessionsByDate(sessions: BreathingSession[]): Map<string, BreathingSession[]> {
  const grouped = new Map<string, BreathingSession[]>();
  
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
 * Berechnet Statistiken für Sessions
 */
export function calculateSessionStats(sessions: BreathingSession[]) {
  const completed = sessions.filter(s => s.completed);
  const totalDuration = completed.reduce((sum, s) => sum + s.durationSec, 0);
  const methodCounts = new Map<BreathingMethod, number>();
  
  completed.forEach(session => {
    methodCounts.set(session.method, (methodCounts.get(session.method) || 0) + 1);
  });
  
  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    totalDurationSec: totalDuration,
    averageDurationSec: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    methodCounts: Object.fromEntries(methodCounts),
    completionRate: sessions.length > 0 ? (completed.length / sessions.length) * 100 : 0
  };
}
