/**
 * Notification Domänen-Typen
 * Lokale Notifications für Gratitude und Reality-Checks
 */

// =========================================================================
// NOTIFICATION TYPES
// =========================================================================

export type NotificationCategory = 
  | 'gratitude_morning'
  | 'gratitude_evening'
  | 'reality_check'
  | 'reminder';

export type NotificationStatus = 
  | 'scheduled'
  | 'delivered'
  | 'cancelled'
  | 'snoozed';

export type NotificationPriority = 
  | 'high'
  | 'normal'
  | 'low';

// =========================================================================
// NOTIFICATION INTERFACES
// =========================================================================

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  scheduledAt: string; // ISO-UTC timestamp
  deliveredAt?: string; // ISO-UTC timestamp
  status: NotificationStatus;
  priority: NotificationPriority;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

export interface CreateNotification {
  category: NotificationCategory;
  title: string;
  body: string;
  scheduledAt: string; // ISO-UTC timestamp
  priority?: NotificationPriority;
  userId: string;
  metadata?: Record<string, any>;
}

export interface UpdateNotification {
  title?: string;
  body?: string;
  scheduledAt?: string;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

// =========================================================================
// PLANNING INTERFACES
// =========================================================================

export interface GratitudeSchedule {
  morning: string; // HH:mm format
  evening: string; // HH:mm format
  enabled: boolean;
}

export interface RealityCheckSchedule {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  count: number; // 3-5 checks per day
  quietHoursStart: string; // HH:mm format (default: 20:00)
  quietHoursEnd: string; // HH:mm format (default: 10:00)
}

export interface NotificationSchedule {
  gratitude: GratitudeSchedule;
  realityChecks: RealityCheckSchedule;
}

// =========================================================================
// RESPONSE INTERFACES
// =========================================================================

export interface ScheduledNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  scheduledAt: string;
  status: NotificationStatus;
  priority: NotificationPriority;
}

export interface NotificationPlanResult {
  scheduled: number;
  cancelled: number;
  errors: string[];
}

export interface SnoozeResult {
  originalId: string;
  snoozedId: string;
  newScheduledAt: string;
}

// =========================================================================
// VALIDATION
// =========================================================================

export class NotificationValidator {
  /**
   * Validiert Zeit-Format (HH:mm)
   */
  static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validiert Reality-Check-Count (3-5)
   */
  static isValidRealityCheckCount(count: number): boolean {
    return count >= 3 && count <= 5;
  }

  /**
   * Validiert Datum-Format (YYYY-MM-DD)
   */
  static isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(date);
  }

  /**
   * Validiert ISO-UTC Timestamp
   */
  static isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }
}
