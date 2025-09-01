/**
 * Notification Plan Store
 * Lokale Persistenz für Notification-Pläne mit Versionierung und Migrations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notification, ScheduledNotification } from './types';
import { NotificationService } from './notification.service';

// =========================================================================
// TYPES
// =========================================================================

export interface PlanSnapshot {
  version: string;
  userId: string;
  timestamp: string; // ISO-UTC
  timezone: string; // IANA timezone identifier
  dstOffset: number; // DST offset in minutes
  notifications: Notification[];
  metadata: {
    totalScheduled: number;
    gratitudeCount: number;
    realityCheckCount: number;
    lastPlannedDate: string; // YYYY-MM-DD
  };
}

export interface PlanStoreConfig {
  storageKey: string;
  currentVersion: string;
  enableAutoRecovery: boolean;
  maxSnapshots: number;
}

export interface PlanStoreResult {
  success: boolean;
  error?: string;
  snapshot?: PlanSnapshot;
  migrated: boolean;
}

// =========================================================================
// CONSTANTS
// =========================================================================

const DEFAULT_CONFIG: PlanStoreConfig = {
  storageKey: '@mindull:notification_plans',
  currentVersion: '1.0.0',
  enableAutoRecovery: true,
  maxSnapshots: 5
};

const VERSION_MIGRATIONS = {
  '1.0.0': (data: any): PlanSnapshot => {
    // Initial version - no migration needed
    return data;
  }
  // Future migrations can be added here
  // '1.1.0': (data: any): PlanSnapshot => { ... }
};

// =========================================================================
// PLAN STORE
// =========================================================================

export class PlanStore {
  private config: PlanStoreConfig;
  private notificationService: NotificationService;

  constructor(config: Partial<PlanStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.notificationService = NotificationService.getInstance();
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Speichert aktuellen Plan als Snapshot
   */
  async savePlan(userId: string): Promise<PlanStoreResult> {
    try {
      const snapshot = await this.createSnapshot(userId);
      const serialized = JSON.stringify(snapshot);
      
      await AsyncStorage.setItem(this.config.storageKey, serialized);
      
      return {
        success: true,
        snapshot,
        migrated: false
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        migrated: false
      };
    }
  }

  /**
   * Lädt gespeicherten Plan
   */
  async loadPlan(userId: string): Promise<PlanStoreResult> {
    try {
      const serialized = await AsyncStorage.getItem(this.config.storageKey);
      
      if (!serialized) {
        return {
          success: false,
          error: 'No saved plan found',
          migrated: false
        };
      }

      let data = JSON.parse(serialized);
      
      // Validiere und migriere falls nötig
      const validationResult = this.validateSnapshot(data);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          migrated: false
        };
      }

      // Prüfe ob Migration nötig ist
      if (data.version !== this.config.currentVersion) {
        const migrationResult = await this.migrateSnapshot(data);
        if (!migrationResult.success) {
          return migrationResult;
        }
        data = migrationResult.snapshot;
      }

      // Prüfe ob Snapshot für aktuellen User ist
      if (data.userId !== userId) {
        return {
          success: false,
          error: 'Snapshot belongs to different user',
          migrated: false
        };
      }

      return {
        success: true,
        snapshot: data,
        migrated: data.version !== this.config.currentVersion
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        migrated: false
      };
    }
  }

  /**
   * Löscht gespeicherten Plan
   */
  async clearPlan(): Promise<PlanStoreResult> {
    try {
      await AsyncStorage.removeItem(this.config.storageKey);
      return { success: true, migrated: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        migrated: false
      };
    }
  }

  /**
   * Prüft ob Plan für User existiert
   */
  async hasPlan(userId: string): Promise<boolean> {
    try {
      const result = await this.loadPlan(userId);
      return result.success && result.snapshot?.userId === userId;
    } catch {
      return false;
    }
  }

  /**
   * Holt Plan-Metadaten ohne vollständiges Laden
   */
  async getPlanMetadata(): Promise<{
    userId?: string;
    timestamp?: string;
    version?: string;
    timezone?: string;
  }> {
    try {
      const serialized = await AsyncStorage.getItem(this.config.storageKey);
      if (!serialized) return {};

      const data = JSON.parse(serialized);
      return {
        userId: data.userId,
        timestamp: data.timestamp,
        version: data.version,
        timezone: data.timezone
      };
    } catch {
      return {};
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Erstellt Snapshot aus aktuellem Service-State
   */
  private async createSnapshot(userId: string): Promise<PlanSnapshot> {
    const notifications = this.notificationService.getAllNotifications();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const dstOffset = this.calculateDSTOffset(now, timezone);

    const gratitudeCount = notifications.filter(n => 
      n.category === 'gratitude_morning' || n.category === 'gratitude_evening'
    ).length;

    const realityCheckCount = notifications.filter(n => 
      n.category === 'reality_check'
    ).length;

    return {
      version: this.config.currentVersion,
      userId,
      timestamp: now.toISOString(),
      timezone,
      dstOffset,
      notifications: notifications.map(n => ({ ...n })),
      metadata: {
        totalScheduled: notifications.length,
        gratitudeCount,
        realityCheckCount,
        lastPlannedDate: this.getCurrentDate()
      }
    };
  }

  /**
   * Validiert Snapshot-Struktur
   */
  private validateSnapshot(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid snapshot format' };
    }

    const requiredFields = ['version', 'userId', 'timestamp', 'timezone', 'notifications', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    if (!Array.isArray(data.notifications)) {
      return { valid: false, error: 'Notifications must be an array' };
    }

    return { valid: true };
  }

  /**
   * Migriert Snapshot auf aktuelle Version
   */
  private async migrateSnapshot(data: any): Promise<PlanStoreResult> {
    try {
      const currentVersion = data.version;
      const targetVersion = this.config.currentVersion;

      if (!(currentVersion in VERSION_MIGRATIONS)) {
        return {
          success: false,
          error: `No migration path from version ${currentVersion} to ${targetVersion}`,
          migrated: false
        };
      }

      const migration = VERSION_MIGRATIONS[currentVersion as keyof typeof VERSION_MIGRATIONS];
      const migratedSnapshot = migration(data);
      migratedSnapshot.version = targetVersion;

      // Speichere migrierten Snapshot
      const serialized = JSON.stringify(migratedSnapshot);
      await AsyncStorage.setItem(this.config.storageKey, serialized);

      return {
        success: true,
        snapshot: migratedSnapshot,
        migrated: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
        migrated: false
      };
    }
  }

  /**
   * Berechnet DST-Offset für gegebene Zeit und Zeitzone
   */
  private calculateDSTOffset(date: Date, timezone: string): number {
    try {
      const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const local = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return (local.getTime() - utc.getTime()) / (1000 * 60); // In Minuten
    } catch {
      return 0;
    }
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
   * Debug-Methode: Zeigt alle gespeicherten Daten
   */
  async debugStorage(): Promise<any> {
    try {
      const serialized = await AsyncStorage.getItem(this.config.storageKey);
      return serialized ? JSON.parse(serialized) : null;
    } catch {
      return null;
    }
  }

  /**
   * Debug-Methode: Löscht alle gespeicherten Daten
   */
  async debugClearAll(): Promise<void> {
    await AsyncStorage.removeItem(this.config.storageKey);
  }
}
