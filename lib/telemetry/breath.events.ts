/**
 * Breath Telemetrie Events
 * Minimale Events ohne PII für Atem-Übungen Tracking
 */

// ============================================================================
// TYPES
// ============================================================================

export interface BreathEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly properties: Record<string, any>;
  readonly userId?: string; // Anonymisierte User-ID
}

export interface BreathEventProperties {
  readonly method: string;
  readonly durationSec?: number;
  readonly cycles?: number;
  readonly completed?: boolean;
  readonly interruptions?: number;
  readonly errorCode?: string;
  readonly context?: string;
  readonly isOffline?: boolean;
  readonly sessionId?: string;
}

export interface BreathMetrics {
  readonly totalSessions: number;
  readonly completedSessions: number;
  readonly averageDuration: number;
  readonly completionRate: number;
  readonly methodDistribution: Record<string, number>;
  readonly offlineRate: number;
  readonly errorRate: number;
}

// ============================================================================
// EVENT NAMES
// ============================================================================

export const BREATH_EVENTS = {
  // Session Events
  SESSION_START: 'breath.session.start',
  SESSION_COMPLETE: 'breath.session.complete',
  SESSION_CANCEL: 'breath.session.cancel',
  SESSION_PAUSE: 'breath.session.pause',
  SESSION_RESUME: 'breath.session.resume',

  // Persistence Events
  SESSION_SAVE_ATTEMPT: 'breath.session.save.attempt',
  SESSION_SAVE_SUCCESS: 'breath.session.save.success',
  SESSION_SAVE_FAIL: 'breath.session.save.fail',
  SESSION_SAVE_OFFLINE: 'breath.session.save.offline',

  // Error Events
  SESSION_ERROR: 'breath.session.error',
  TIMER_ERROR: 'breath.timer.error',
  PERSISTENCE_ERROR: 'breath.persistence.error',

  // Performance Events
  SESSION_PERFORMANCE: 'breath.session.performance',
  TIMER_DRIFT: 'breath.timer.drift',

  // User Behavior Events
  METHOD_SELECTION: 'breath.method.selection',
  CYCLE_ADJUSTMENT: 'breath.cycle.adjustment',
  SETTINGS_CHANGE: 'breath.settings.change'
} as const;

// ============================================================================
// BREATH TELEMETRY SERVICE
// ============================================================================

/**
 * Breath Telemetrie Service
 * Sammelt und sendet Breath-Events ohne PII
 */
export class BreathTelemetryService {
  private static instance: BreathTelemetryService;
  private events: BreathEvent[] = [];
  private isEnabled: boolean = true;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 Sekunden
  private flushTimer?: NodeJS.Timeout;
  private currentUserId?: string;

  private constructor() {
    this.startPeriodicFlush();
  }

  static getInstance(): BreathTelemetryService {
    if (!BreathTelemetryService.instance) {
      BreathTelemetryService.instance = new BreathTelemetryService();
    }
    return BreathTelemetryService.instance;
  }

  /**
   * Setzt aktuelle User-ID
   */
  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Trackt ein Breath-Event
   */
  trackEvent(
    name: string,
    properties: BreathEventProperties = {}
  ): void {
    if (!this.isEnabled) return;

    const event: BreathEvent = {
      name,
      timestamp: Date.now(),
      properties: this.sanitizeProperties(properties),
      userId: this.currentUserId
    };

    this.events.push(event);

    // Batch-Flush wenn Schwellwert erreicht
    if (this.events.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  /**
   * Trackt Session-Start
   */
  trackSessionStart(
    method: string,
    cycles?: number,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_START, {
      method,
      cycles,
      context
    });
  }

  /**
   * Trackt Session-Complete
   */
  trackSessionComplete(
    method: string,
    durationSec: number,
    cycles: number,
    completed: boolean,
    interruptions?: number
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_COMPLETE, {
      method,
      durationSec,
      cycles,
      completed,
      interruptions
    });
  }

  /**
   * Trackt Session-Cancel
   */
  trackSessionCancel(
    method: string,
    durationSec: number,
    cycles: number,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_CANCEL, {
      method,
      durationSec,
      cycles,
      context
    });
  }

  /**
   * Trackt Session-Pause
   */
  trackSessionPause(
    method: string,
    durationSec: number,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_PAUSE, {
      method,
      durationSec,
      context
    });
  }

  /**
   * Trackt Session-Resume
   */
  trackSessionResume(
    method: string,
    durationSec: number,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_RESUME, {
      method,
      durationSec,
      context
    });
  }

  /**
   * Trackt Session-Save
   */
  trackSessionSave(
    method: string,
    durationSec: number,
    completed: boolean,
    isOffline: boolean,
    sessionId?: string,
    errorCode?: string
  ): void {
    const eventName = errorCode 
      ? BREATH_EVENTS.SESSION_SAVE_FAIL
      : isOffline 
        ? BREATH_EVENTS.SESSION_SAVE_OFFLINE
        : BREATH_EVENTS.SESSION_SAVE_SUCCESS;

    this.trackEvent(eventName, {
      method,
      durationSec,
      completed,
      isOffline,
      sessionId,
      errorCode
    });
  }

  /**
   * Trackt Session-Error
   */
  trackSessionError(
    method: string,
    errorCode: string,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.SESSION_ERROR, {
      method,
      errorCode,
      context
    });
  }

  /**
   * Trackt Timer-Error
   */
  trackTimerError(
    errorCode: string,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.TIMER_ERROR, {
      errorCode,
      context
    });
  }

  /**
   * Trackt Persistence-Error
   */
  trackPersistenceError(
    errorCode: string,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.PERSISTENCE_ERROR, {
      errorCode,
      context
    });
  }

  /**
   * Trackt Method-Selection
   */
  trackMethodSelection(
    method: string,
    context?: string
  ): void {
    this.trackEvent(BREATH_EVENTS.METHOD_SELECTION, {
      method,
      context
    });
  }

  /**
   * Trackt Cycle-Adjustment
   */
  trackCycleAdjustment(
    method: string,
    oldCycles: number,
    newCycles: number
  ): void {
    this.trackEvent(BREATH_EVENTS.CYCLE_ADJUSTMENT, {
      method,
      oldCycles,
      newCycles
    });
  }

  /**
   * Trackt Settings-Change
   */
  trackSettingsChange(
    setting: string,
    oldValue: any,
    newValue: any
  ): void {
    this.trackEvent(BREATH_EVENTS.SETTINGS_CHANGE, {
      setting,
      oldValue,
      newValue
    });
  }

  /**
   * Sanitisiert Event-Properties (entfernt PII)
   */
  private sanitizeProperties(properties: BreathEventProperties): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // Erlaubte Properties
    const allowedKeys = [
      'method', 'durationSec', 'cycles', 'completed', 'interruptions',
      'errorCode', 'context', 'isOffline', 'sessionId', 'setting',
      'oldValue', 'newValue', 'oldCycles', 'newCycles'
    ];

    for (const [key, value] of Object.entries(properties)) {
      if (allowedKeys.includes(key)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sendet Events an Backend
   */
  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // TODO: Implement actual event sending
      // await this.sendEventsToBackend(eventsToSend);
      
      console.log(`Sent ${eventsToSend.length} breath events to telemetry`);
    } catch (error) {
      console.error('Failed to send breath events:', error);
      
      // Events wieder zurücksetzen bei Fehler
      this.events.unshift(...eventsToSend);
    }
  }

  /**
   * Startet periodisches Flushen
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  /**
   * Stoppt periodisches Flushen
   */
  private stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Aktiviert/Deaktiviert Telemetrie
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.events = [];
      this.stopPeriodicFlush();
    } else {
      this.startPeriodicFlush();
    }
  }

  /**
   * Gibt aktuelle Statistiken zurück
   */
  getStats(): {
    totalEvents: number;
    isEnabled: boolean;
    batchSize: number;
    flushInterval: number;
  } {
    return {
      totalEvents: this.events.length,
      isEnabled: this.isEnabled,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopPeriodicFlush();
    this.events = [];
    this.currentUserId = undefined;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Erstellt Breath Telemetry Service Instance
 */
export function createBreathTelemetryService(): BreathTelemetryService {
  return BreathTelemetryService.getInstance();
}

/**
 * Utility-Funktionen für Breath-Telemetrie
 */
export const BreathTelemetryUtils = {
  /**
   * Formatiert Event für Logging
   */
  formatEventForLog(event: BreathEvent): string {
    return `[${event.name}] ${JSON.stringify(event.properties)}`;
  },

  /**
   * Erstellt anonymisierte User-ID
   */
  anonymizeUserId(userId: string): string {
    // Einfacher Hash für Anonymisierung
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash)}`;
  },

  /**
   * Validiert Event-Properties
   */
  validateEventProperties(properties: BreathEventProperties): string[] {
    const errors: string[] = [];

    if (properties.method && typeof properties.method !== 'string') {
      errors.push('Method must be a string');
    }

    if (properties.durationSec !== undefined && 
        (typeof properties.durationSec !== 'number' || properties.durationSec < 0)) {
      errors.push('Duration must be a non-negative number');
    }

    if (properties.cycles !== undefined && 
        (typeof properties.cycles !== 'number' || properties.cycles < 0)) {
      errors.push('Cycles must be a non-negative number');
    }

    if (properties.completed !== undefined && typeof properties.completed !== 'boolean') {
      errors.push('Completed must be a boolean');
    }

    if (properties.interruptions !== undefined && 
        (typeof properties.interruptions !== 'number' || properties.interruptions < 0)) {
      errors.push('Interruptions must be a non-negative number');
    }

    return errors;
  },

  /**
   * Berechnet Session-Metriken
   */
  calculateSessionMetrics(events: BreathEvent[]): BreathMetrics {
    const sessionEvents = events.filter(e => 
      e.name === BREATH_EVENTS.SESSION_COMPLETE || 
      e.name === BREATH_EVENTS.SESSION_CANCEL
    );

    const completedEvents = events.filter(e => 
      e.name === BREATH_EVENTS.SESSION_COMPLETE && 
      e.properties.completed === true
    );

    const methodCounts: Record<string, number> = {};
    let totalDuration = 0;

    sessionEvents.forEach(event => {
      const method = event.properties.method as string;
      const duration = event.properties.durationSec as number;

      if (method) {
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      }

      if (duration) {
        totalDuration += duration;
      }
    });

    const totalSessions = sessionEvents.length;
    const completedSessions = completedEvents.length;
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

    const offlineEvents = events.filter(e => 
      e.properties.isOffline === true
    );
    const offlineRate = totalSessions > 0 ? offlineEvents.length / totalSessions : 0;

    const errorEvents = events.filter(e => 
      e.name.includes('.error') || e.name.includes('.fail')
    );
    const errorRate = totalSessions > 0 ? errorEvents.length / totalSessions : 0;

    return {
      totalSessions,
      completedSessions,
      averageDuration,
      completionRate,
      methodDistribution: methodCounts,
      offlineRate,
      errorRate
    };
  }
};
