/**
 * Notification Telemetry Events
 * Anonyme Events nur bei Opt-in mit Rate-Limiting
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationCategory } from '../../services/notifications/types';

// =========================================================================
// TYPES
// =========================================================================

export type NotificationEventType = 
  | 'notif.delivered'
  | 'notif.opened'
  | 'notif.snoozed'
  | 'notif.dismissed';

export interface NotificationEvent {
  type: NotificationEventType;
  category: NotificationCategory;
  timestamp: string; // ISO-UTC
  sessionId: string; // Anonyme Session-ID
  metadata?: Record<string, any>;
}

export interface TelemetryConfig {
  enabled: boolean;
  maxEventsPerDay: number;
  storageKey: string;
  sessionIdKey: string;
}

export interface TelemetryResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
  eventCount?: number;
}

export interface DailyEventCount {
  date: string; // YYYY-MM-DD
  count: number;
  events: NotificationEvent[];
}

// =========================================================================
// CONSTANTS
// =========================================================================

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false,
  maxEventsPerDay: 20,
  storageKey: '@mindull:notification_telemetry',
  sessionIdKey: '@mindull:telemetry_session'
};

const EVENT_CODES = {
  DELIVERED: 'delivered',
  OPENED: 'opened',
  SNOOZED: 'snoozed',
  DISMISSED: 'dismissed'
} as const;

const CATEGORY_CODES = {
  gratitude_morning: 'grat_m',
  gratitude_evening: 'grat_e',
  reality_check: 'rc',
  reminder: 'rem'
} as const;

// =========================================================================
// NOTIFICATION TELEMETRY
// =========================================================================

export class NotificationTelemetry {
  private static instance: NotificationTelemetry;
  private config: TelemetryConfig;
  private sessionId: string | null = null;

  private constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(): NotificationTelemetry {
    if (!NotificationTelemetry.instance) {
      NotificationTelemetry.instance = new NotificationTelemetry();
    }
    return NotificationTelemetry.instance;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Initialisiert Telemetrie mit Opt-in-Status
   */
  async initialize(optIn: boolean): Promise<void> {
    this.config.enabled = optIn;
    
    if (optIn) {
      await this.ensureSessionId();
    }
  }

  /**
   * Sendet Notification-Event (nur bei Opt-in)
   */
  async trackEvent(
    type: NotificationEventType,
    category: NotificationCategory,
    metadata?: Record<string, any>
  ): Promise<TelemetryResult> {
    if (!this.config.enabled) {
      return { success: true }; // Silently ignore when disabled
    }

    try {
      // Prüfe Rate-Limit
      const rateLimitResult = await this.checkRateLimit();
      if (rateLimitResult.rateLimited) {
        return {
          success: false,
          rateLimited: true,
          error: 'Rate limit exceeded',
          eventCount: rateLimitResult.count
        };
      }

      // Erstelle Event
      const event: NotificationEvent = {
        type,
        category,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId!,
        metadata: this.sanitizeMetadata(metadata)
      };

      // Speichere Event
      await this.saveEvent(event);

      return {
        success: true,
        eventCount: rateLimitResult.count + 1
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trackt Notification-Delivery
   */
  async trackDelivered(category: NotificationCategory): Promise<TelemetryResult> {
    return this.trackEvent('notif.delivered', category);
  }

  /**
   * Trackt Notification-Öffnung
   */
  async trackOpened(category: NotificationCategory): Promise<TelemetryResult> {
    return this.trackEvent('notif.opened', category);
  }

  /**
   * Trackt Notification-Snooze
   */
  async trackSnoozed(
    category: NotificationCategory, 
    snoozeMinutes: number
  ): Promise<TelemetryResult> {
    return this.trackEvent('notif.snoozed', category, {
      snoozeMinutes,
      snoozeOption: this.getSnoozeOption(snoozeMinutes)
    });
  }

  /**
   * Trackt Notification-Dismissal
   */
  async trackDismissed(category: NotificationCategory): Promise<TelemetryResult> {
    return this.trackEvent('notif.dismissed', category);
  }

  /**
   * Holt Event-Statistiken für aktuellen Tag
   */
  async getDailyStats(): Promise<{
    date: string;
    totalEvents: number;
    eventsByType: Record<NotificationEventType, number>;
    eventsByCategory: Record<NotificationCategory, number>;
  }> {
    const today = this.getCurrentDate();
    const dailyEvents = await this.getDailyEvents(today);

    const stats = {
      date: today,
      totalEvents: dailyEvents.length,
      eventsByType: {
        'notif.delivered': 0,
        'notif.opened': 0,
        'notif.snoozed': 0,
        'notif.dismissed': 0
      },
      eventsByCategory: {
        'gratitude_morning': 0,
        'gratitude_evening': 0,
        'reality_check': 0,
        'reminder': 0
      }
    };

    dailyEvents.forEach(event => {
      stats.eventsByType[event.type]++;
      stats.eventsByCategory[event.category]++;
    });

    return stats;
  }

  /**
   * Löscht alle Telemetrie-Daten
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.config.storageKey);
      await AsyncStorage.removeItem(this.config.sessionIdKey);
      this.sessionId = null;
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Exportiert Telemetrie-Daten (für GDPR)
   */
  async exportData(): Promise<{
    sessionId: string;
    events: NotificationEvent[];
    config: TelemetryConfig;
  }> {
    const allEvents = await this.getAllEvents();
    
    return {
      sessionId: this.sessionId || '',
      events: allEvents,
      config: this.config
    };
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Stellt sicher dass Session-ID existiert
   */
  private async ensureSessionId(): Promise<void> {
    if (this.sessionId) return;

    try {
      const existingSessionId = await AsyncStorage.getItem(this.config.sessionIdKey);
      
      if (existingSessionId) {
        this.sessionId = existingSessionId;
      } else {
        this.sessionId = this.generateSessionId();
        await AsyncStorage.setItem(this.config.sessionIdKey, this.sessionId);
      }
    } catch (error) {
      // Fallback: generiere neue Session-ID
      this.sessionId = this.generateSessionId();
    }
  }

  /**
   * Generiert anonyme Session-ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Prüft Rate-Limit für aktuellen Tag
   */
  private async checkRateLimit(): Promise<{ rateLimited: boolean; count: number }> {
    const today = this.getCurrentDate();
    const dailyEvents = await this.getDailyEvents(today);
    
    return {
      rateLimited: dailyEvents.length >= this.config.maxEventsPerDay,
      count: dailyEvents.length
    };
  }

  /**
   * Speichert Event
   */
  private async saveEvent(event: NotificationEvent): Promise<void> {
    const today = this.getCurrentDate();
    const dailyEvents = await this.getDailyEvents(today);
    
    dailyEvents.push(event);
    
    // Speichere nur Events des aktuellen Tages
    const allData = await this.getAllEvents();
    const otherDaysEvents = allData.filter(e => 
      e.timestamp.split('T')[0] !== today
    );
    
    const updatedData = [...otherDaysEvents, ...dailyEvents];
    await this.saveAllEvents(updatedData);
  }

  /**
   * Holt Events für spezifischen Tag
   */
  private async getDailyEvents(date: string): Promise<NotificationEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => 
      event.timestamp.split('T')[0] === date
    );
  }

  /**
   * Holt alle Events
   */
  private async getAllEvents(): Promise<NotificationEvent[]> {
    try {
      const data = await AsyncStorage.getItem(this.config.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Speichert alle Events
   */
  private async saveAllEvents(events: NotificationEvent[]): Promise<void> {
    await AsyncStorage.setItem(this.config.storageKey, JSON.stringify(events));
  }

  /**
   * Bereinigt Metadata von PII
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, any> = {};
    
    // Erlaubte Felder (keine PII)
    const allowedFields = ['snoozeMinutes', 'snoozeOption', 'notificationId'];
    
    for (const [key, value] of Object.entries(metadata)) {
      if (allowedFields.includes(key)) {
        sanitized[key] = value;
      }
    }
    
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * Kategorisiert Snooze-Option
   */
  private getSnoozeOption(minutes: number): string {
    if (minutes <= 5) return 'short';
    if (minutes <= 15) return 'medium';
    return 'long';
  }

  /**
   * Holt aktuelles Datum im YYYY-MM-DD Format
   */
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Debug-Methode: Zeigt Telemetrie-Status
   */
  getDebugInfo() {
    return {
      config: this.config,
      sessionId: this.sessionId,
      isEnabled: this.config.enabled
    };
  }

  /**
   * Debug-Methode: Zeigt alle gespeicherten Events
   */
  async debugGetAllEvents(): Promise<NotificationEvent[]> {
    return this.getAllEvents();
  }

  /**
   * Debug-Methode: Zeigt Rate-Limit-Status
   */
  async debugGetRateLimitStatus(): Promise<{
    today: string;
    currentCount: number;
    maxAllowed: number;
    rateLimited: boolean;
  }> {
    const today = this.getCurrentDate();
    const dailyEvents = await this.getDailyEvents(today);
    
    return {
      today,
      currentCount: dailyEvents.length,
      maxAllowed: this.config.maxEventsPerDay,
      rateLimited: dailyEvents.length >= this.config.maxEventsPerDay
    };
  }
}

// =========================================================================
// CONVENIENCE FUNCTIONS
// =========================================================================

/**
 * Initialisiert Telemetrie global
 */
export async function initializeNotificationTelemetry(optIn: boolean): Promise<void> {
  const telemetry = NotificationTelemetry.getInstance();
  await telemetry.initialize(optIn);
}

/**
 * Trackt Notification-Delivery
 */
export async function trackNotificationDelivered(category: NotificationCategory): Promise<TelemetryResult> {
  const telemetry = NotificationTelemetry.getInstance();
  return telemetry.trackDelivered(category);
}

/**
 * Trackt Notification-Öffnung
 */
export async function trackNotificationOpened(category: NotificationCategory): Promise<TelemetryResult> {
  const telemetry = NotificationTelemetry.getInstance();
  return telemetry.trackOpened(category);
}

/**
 * Trackt Notification-Snooze
 */
export async function trackNotificationSnoozed(
  category: NotificationCategory, 
  snoozeMinutes: number
): Promise<TelemetryResult> {
  const telemetry = NotificationTelemetry.getInstance();
  return telemetry.trackSnoozed(category, snoozeMinutes);
}

/**
 * Trackt Notification-Dismissal
 */
export async function trackNotificationDismissed(category: NotificationCategory): Promise<TelemetryResult> {
  const telemetry = NotificationTelemetry.getInstance();
  return telemetry.trackDismissed(category);
}
