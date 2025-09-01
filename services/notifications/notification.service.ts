/**
 * Notification Service
 * Lokale Notifications für Gratitude und Reality-Checks
 * Idempotente API mit 7-Tage-Planungshorizont
 */

import { 
  Notification, 
  CreateNotification, 
  NotificationCategory,
  NotificationStatus,
  NotificationPriority,
  GratitudeSchedule,
  RealityCheckSchedule,
  ScheduledNotification,
  NotificationPlanResult,
  SnoozeResult,
  NotificationValidator
} from './types';
import { ChannelManager, NotificationChannel } from './channels';

// =========================================================================
// INTERNAL TYPES
// =========================================================================

interface NotificationStore {
  notifications: Map<string, Notification>;
  lastPlannedDate: string; // YYYY-MM-DD
}

interface PlanningContext {
  userId: string;
  currentDate: string; // YYYY-MM-DD
  schedule: {
    gratitude: GratitudeSchedule;
    realityChecks: RealityCheckSchedule;
  };
}

// =========================================================================
// NOTIFICATION SERVICE
// =========================================================================

export class NotificationService {
  private static instance: NotificationService;
  private store: NotificationStore;

  private constructor() {
    this.store = {
      notifications: new Map(),
      lastPlannedDate: ''
    };
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Plant Gratitude-Notifications für die nächsten 7 Tage
   * Idempotent: gleiche Eingaben → gleicher Plan
   */
  async planGratitude(
    userId: string, 
    schedule: GratitudeSchedule
  ): Promise<NotificationPlanResult> {
    try {
      // Validierung
      if (!schedule.enabled) {
        return { scheduled: 0, cancelled: 0, errors: [] };
      }

      if (!NotificationValidator.isValidTime(schedule.morning) || 
          !NotificationValidator.isValidTime(schedule.evening)) {
        return { 
          scheduled: 0, 
          cancelled: 0, 
          errors: ['Invalid time format for gratitude schedule'] 
        };
      }

      const context: PlanningContext = {
        userId,
        currentDate: this.getCurrentDate(),
        schedule: { gratitude: schedule, realityChecks: { enabled: false, startTime: '', endTime: '', count: 0, quietHoursStart: '', quietHoursEnd: '' } }
      };

      // Prüfe ob bereits für heute geplant
      if (this.shouldSkipPlanning(context)) {
        return { scheduled: 0, cancelled: 0, errors: [] };
      }

      const result = await this.planGratitudeNotifications(context);
      this.store.lastPlannedDate = context.currentDate;

      return result;
    } catch (error) {
      return { 
        scheduled: 0, 
        cancelled: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  /**
   * Plant Reality-Check-Notifications für die nächsten 7 Tage
   * Idempotent: gleiche Eingaben → gleicher Plan
   */
  async planRealityChecks(
    userId: string, 
    schedule: RealityCheckSchedule
  ): Promise<NotificationPlanResult> {
    try {
      // Validierung
      if (!schedule.enabled) {
        return { scheduled: 0, cancelled: 0, errors: [] };
      }

      if (!NotificationValidator.isValidTime(schedule.startTime) || 
          !NotificationValidator.isValidTime(schedule.endTime) ||
          !NotificationValidator.isValidRealityCheckCount(schedule.count)) {
        return { 
          scheduled: 0, 
          cancelled: 0, 
          errors: ['Invalid reality check schedule configuration'] 
        };
      }

      const context: PlanningContext = {
        userId,
        currentDate: this.getCurrentDate(),
        schedule: { gratitude: { enabled: false, morning: '', evening: '' }, realityChecks: schedule }
      };

      // Prüfe ob bereits für heute geplant
      if (this.shouldSkipPlanning(context)) {
        return { scheduled: 0, cancelled: 0, errors: [] };
      }

      const result = await this.planRealityCheckNotifications(context);
      this.store.lastPlannedDate = context.currentDate;

      return result;
    } catch (error) {
      return { 
        scheduled: 0, 
        cancelled: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  /**
   * Listet alle geplanten Notifications für User
   */
  async listScheduled(userId: string): Promise<ScheduledNotification[]> {
    const notifications = Array.from(this.store.notifications.values())
      .filter(n => n.userId === userId && n.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    return notifications.map(this.mapToScheduledNotification);
  }

  /**
   * Löscht alle Notifications für User
   */
  async cancelAll(userId: string): Promise<number> {
    let cancelledCount = 0;

    for (const [id, notification] of this.store.notifications.entries()) {
      if (notification.userId === userId && notification.status === 'scheduled') {
        notification.status = 'cancelled';
        notification.updatedAt = new Date().toISOString();
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Plant alle Notifications neu basierend auf aktuellem Schedule
   */
  async rescheduleAll(
    userId: string, 
    gratitudeSchedule: GratitudeSchedule,
    realityCheckSchedule: RealityCheckSchedule
  ): Promise<NotificationPlanResult> {
    // Lösche alle bestehenden geplanten Notifications
    await this.cancelAll(userId);

    // Plane neu
    const gratitudeResult = await this.planGratitude(userId, gratitudeSchedule);
    const realityCheckResult = await this.planRealityChecks(userId, realityCheckSchedule);

    return {
      scheduled: gratitudeResult.scheduled + realityCheckResult.scheduled,
      cancelled: gratitudeResult.cancelled + realityCheckResult.cancelled,
      errors: [...gratitudeResult.errors, ...realityCheckResult.errors]
    };
  }

  /**
   * Verschiebt Notification um X Minuten
   */
  async snooze(
    notificationId: string, 
    minutes: number
  ): Promise<SnoozeResult> {
    const notification = this.store.notifications.get(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'scheduled') {
      throw new Error('Can only snooze scheduled notifications');
    }

    // Markiere ursprüngliche als snoozed
    notification.status = 'snoozed';
    notification.updatedAt = new Date().toISOString();

    // Erstelle neue snoozed Notification
    const snoozedAt = new Date(notification.scheduledAt);
    snoozedAt.setMinutes(snoozedAt.getMinutes() + minutes);

    const snoozedNotification: Notification = {
      ...notification,
      id: this.generateId(),
      scheduledAt: snoozedAt.toISOString(),
      status: 'scheduled',
      metadata: {
        ...notification.metadata,
        snoozedFrom: notificationId,
        snoozedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.notifications.set(snoozedNotification.id, snoozedNotification);

    return {
      originalId: notificationId,
      snoozedId: snoozedNotification.id,
      newScheduledAt: snoozedNotification.scheduledAt
    };
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private shouldSkipPlanning(context: PlanningContext): boolean {
    return this.store.lastPlannedDate === context.currentDate;
  }

  private async planGratitudeNotifications(context: PlanningContext): Promise<NotificationPlanResult> {
    const { userId, schedule } = context;
    let scheduled = 0;
    let cancelled = 0;
    const errors: string[] = [];

    try {
      // Plane für die nächsten 7 Tage
      for (let i = 0; i < 7; i++) {
        const targetDate = this.addDays(context.currentDate, i);
        
        // Morning gratitude
        const morningTime = this.combineDateTime(targetDate, schedule.gratitude.morning);
        if (morningTime > new Date()) {
          const morningNotification = this.createGratitudeNotification(
            userId, 
            'gratitude_morning', 
            morningTime,
            'Dankbarkeit - Morgen',
            'Zeit für deinen morgendlichen Dankbarkeits-Eintrag'
          );
          this.store.notifications.set(morningNotification.id, morningNotification);
          scheduled++;
        }

        // Evening gratitude
        const eveningTime = this.combineDateTime(targetDate, schedule.gratitude.evening);
        if (eveningTime > new Date()) {
          const eveningNotification = this.createGratitudeNotification(
            userId, 
            'gratitude_evening', 
            eveningTime,
            'Dankbarkeit - Abend',
            'Zeit für deinen abendlichen Dankbarkeits-Eintrag'
          );
          this.store.notifications.set(eveningNotification.id, eveningNotification);
          scheduled++;
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return { scheduled, cancelled, errors };
  }

  private async planRealityCheckNotifications(context: PlanningContext): Promise<NotificationPlanResult> {
    const { userId, schedule } = context;
    let scheduled = 0;
    let cancelled = 0;
    const errors: string[] = [];

    try {
      // Plane für die nächsten 7 Tage
      for (let i = 0; i < 7; i++) {
        const targetDate = this.addDays(context.currentDate, i);
        const notificationsForDay = this.generateRealityCheckTimes(
          targetDate,
          schedule.realityChecks
        );

        for (const time of notificationsForDay) {
          if (time > new Date()) {
            const notification = this.createRealityCheckNotification(
              userId,
              time,
              'Reality Check',
              'Zeit für einen Reality-Check'
            );
            this.store.notifications.set(notification.id, notification);
            scheduled++;
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return { scheduled, cancelled, errors };
  }

  private createGratitudeNotification(
    userId: string,
    category: 'gratitude_morning' | 'gratitude_evening',
    scheduledAt: Date,
    title: string,
    body: string
  ): Notification {
    const channel = ChannelManager.getChannel(category);
    
    return {
      id: this.generateId(),
      category,
      title,
      body,
      scheduledAt: scheduledAt.toISOString(),
      status: 'scheduled',
      priority: channel.priority,
      userId,
      metadata: {
        channelId: channel.id,
        soundEnabled: channel.sound.enabled,
        hapticEnabled: channel.haptic.enabled
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private createRealityCheckNotification(
    userId: string,
    scheduledAt: Date,
    title: string,
    body: string
  ): Notification {
    const channel = ChannelManager.getChannel('reality_check');
    
    return {
      id: this.generateId(),
      category: 'reality_check',
      title,
      body,
      scheduledAt: scheduledAt.toISOString(),
      status: 'scheduled',
      priority: channel.priority,
      userId,
      metadata: {
        channelId: channel.id,
        soundEnabled: channel.sound.enabled,
        hapticEnabled: channel.haptic.enabled
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private generateRealityCheckTimes(
    date: string, 
    schedule: RealityCheckSchedule
  ): Date[] {
    const times: Date[] = [];
    const startHour = parseInt(schedule.startTime.split(':')[0]);
    const startMinute = parseInt(schedule.startTime.split(':')[1]);
    const endHour = parseInt(schedule.endTime.split(':')[0]);
    const endMinute = parseInt(schedule.endTime.split(':')[1]);

    const startTime = new Date(date);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    const timeWindow = endTime.getTime() - startTime.getTime();
    const interval = timeWindow / (schedule.count + 1);

    for (let i = 1; i <= schedule.count; i++) {
      const time = new Date(startTime.getTime() + (interval * i));
      // Füge etwas Zufälligkeit hinzu (±15 Minuten)
      const randomOffset = (Math.random() - 0.5) * 30 * 60 * 1000;
      time.setTime(time.getTime() + randomOffset);
      times.push(time);
    }

    return times.sort((a, b) => a.getTime() - b.getTime());
  }

  private mapToScheduledNotification(notification: Notification): ScheduledNotification {
    return {
      id: notification.id,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      scheduledAt: notification.scheduledAt,
      status: notification.status,
      priority: notification.priority
    };
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private addDays(date: string, days: number): string {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }

  private combineDateTime(date: string, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  // =========================================================================
  // TESTING SUPPORT
  // =========================================================================

  /**
   * Nur für Tests: Löscht alle Notifications
   */
  clearAll(): void {
    this.store.notifications.clear();
    this.store.lastPlannedDate = '';
  }

  /**
   * Nur für Tests: Holt alle Notifications
   */
  getAllNotifications(): Notification[] {
    return Array.from(this.store.notifications.values());
  }
}
