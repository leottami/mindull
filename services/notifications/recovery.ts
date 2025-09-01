/**
 * Notification Recovery Service
 * Boot-Hook und Timezone-Watcher für Plan-Persistenz und Recovery
 */

import { AppState, AppStateStatus } from 'react-native';
import { PlanStore, PlanSnapshot } from './plan.store';
import { NotificationService } from './notification.service';
import { GratitudeSchedule, RealityCheckSchedule } from './types';

// =========================================================================
// TYPES
// =========================================================================

export interface RecoveryConfig {
  enableAutoRecovery: boolean;
  enableTimezoneWatcher: boolean;
  enableDSTProtection: boolean;
  maxRecoveryAttempts: number;
  recoveryCooldown: number; // ms
}

export interface RecoveryContext {
  userId: string;
  gratitudeSchedule: GratitudeSchedule;
  realityCheckSchedule: RealityCheckSchedule;
  lastRecoveryAttempt?: number;
  recoveryAttempts: number;
}

export interface RecoveryResult {
  success: boolean;
  recovered: boolean;
  error?: string;
  reason?: 'boot' | 'timezone' | 'dst' | 'settings' | 'manual';
  snapshot?: PlanSnapshot;
}

export interface TimezoneInfo {
  current: string;
  previous?: string;
  dstOffset: number;
  previousDstOffset?: number;
  changed: boolean;
  dstChanged: boolean;
}

// =========================================================================
// CONSTANTS
// =========================================================================

const DEFAULT_CONFIG: RecoveryConfig = {
  enableAutoRecovery: true,
  enableTimezoneWatcher: true,
  enableDSTProtection: true,
  maxRecoveryAttempts: 3,
  recoveryCooldown: 5 * 60 * 1000 // 5 Minuten
};

// =========================================================================
// RECOVERY SERVICE
// =========================================================================

export class RecoveryService {
  private static instance: RecoveryService;
  private config: RecoveryConfig;
  private planStore: PlanStore;
  private notificationService: NotificationService;
  private context?: RecoveryContext;
  private timezoneWatcher?: NodeJS.Timeout;
  private appStateListener?: any;

  private constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.planStore = new PlanStore();
    this.notificationService = NotificationService.getInstance();
  }

  static getInstance(): RecoveryService {
    if (!RecoveryService.instance) {
      RecoveryService.instance = new RecoveryService();
    }
    return RecoveryService.instance;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Initialisiert Recovery-Service mit User-Kontext
   */
  initialize(context: RecoveryContext): void {
    this.context = context;
    
    if (this.config.enableTimezoneWatcher) {
      this.startTimezoneWatcher();
    }
    
    if (this.config.enableAutoRecovery) {
      this.startAppStateWatcher();
    }
  }

  /**
   * Boot-Hook: Wird beim App-Start aufgerufen
   */
  async onBoot(): Promise<RecoveryResult> {
    if (!this.context) {
      return {
        success: false,
        recovered: false,
        error: 'Recovery service not initialized',
        reason: 'boot'
      };
    }

    try {
      // Prüfe ob Plan existiert
      const hasPlan = await this.planStore.hasPlan(this.context.userId);
      if (!hasPlan) {
        return {
          success: true,
          recovered: false,
          reason: 'boot'
        };
      }

      // Lade gespeicherten Plan
      const loadResult = await this.planStore.loadPlan(this.context.userId);
      if (!loadResult.success || !loadResult.snapshot) {
        return {
          success: false,
          recovered: false,
          error: loadResult.error,
          reason: 'boot'
        };
      }

      // Prüfe Timezone-Änderungen
      const timezoneInfo = this.checkTimezoneChanges(loadResult.snapshot);
      
      if (timezoneInfo.changed || timezoneInfo.dstChanged) {
        // Timezone/DST geändert - Plan neu generieren
        return await this.handleTimezoneChange(timezoneInfo, 'boot');
      }

      // Prüfe ob Plan noch aktuell ist
      const isPlanValid = this.validatePlan(loadResult.snapshot);
      if (!isPlanValid) {
        return await this.regeneratePlan('boot');
      }

      // Restore Plan
      await this.restorePlan(loadResult.snapshot);
      
      return {
        success: true,
        recovered: true,
        reason: 'boot',
        snapshot: loadResult.snapshot
      };

    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: 'boot'
      };
    }
  }

  /**
   * Wird bei Settings-Änderungen aufgerufen
   */
  async onSettingsChange(): Promise<RecoveryResult> {
    if (!this.context) {
      return {
        success: false,
        recovered: false,
        error: 'Recovery service not initialized',
        reason: 'settings'
      };
    }

    return await this.regeneratePlan('settings');
  }

  /**
   * Wird bei Login aufgerufen
   */
  async onLogin(userId: string): Promise<RecoveryResult> {
    // Lösche alle bestehenden Pläne
    await this.planStore.clearPlan();
    this.notificationService.clearAll();

    // Setze User-Kontext
    if (this.context) {
      this.context.userId = userId;
      this.context.recoveryAttempts = 0;
    }

    // Generiere neuen Plan
    return await this.regeneratePlan('manual');
  }

  /**
   * Wird bei Logout aufgerufen
   */
  async onLogout(): Promise<RecoveryResult> {
    // Lösche alle Pläne
    await this.planStore.clearPlan();
    this.notificationService.clearAll();

    // Reset Context
    this.context = undefined;

    return {
      success: true,
      recovered: false,
      reason: 'manual'
    };
  }

  /**
   * Manueller Recovery-Trigger
   */
  async manualRecovery(): Promise<RecoveryResult> {
    if (!this.context) {
      return {
        success: false,
        recovered: false,
        error: 'Recovery service not initialized',
        reason: 'manual'
      };
    }

    return await this.regeneratePlan('manual');
  }

  /**
   * Cleanup beim Service-Shutdown
   */
  cleanup(): void {
    if (this.timezoneWatcher) {
      clearInterval(this.timezoneWatcher);
      this.timezoneWatcher = undefined;
    }

    if (this.appStateListener) {
      AppState.removeEventListener('change', this.appStateListener);
      this.appStateListener = undefined;
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Startet Timezone-Watcher
   */
  private startTimezoneWatcher(): void {
    this.timezoneWatcher = setInterval(() => {
      this.checkTimezoneChanges();
    }, 60 * 1000); // Prüfe jede Minute
  }

  /**
   * Startet App-State-Watcher
   */
  private startAppStateWatcher(): void {
    this.appStateListener = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App wurde aktiv - prüfe Recovery
        this.onAppActivated();
      }
    };

    AppState.addEventListener('change', this.appStateListener);
  }

  /**
   * Wird aufgerufen wenn App aktiv wird
   */
  private async onAppActivated(): Promise<void> {
    if (!this.context) return;

    // Prüfe Cooldown
    const now = Date.now();
    if (this.context.lastRecoveryAttempt && 
        now - this.context.lastRecoveryAttempt < this.config.recoveryCooldown) {
      return;
    }

    // Prüfe Timezone-Änderungen
    const metadata = await this.planStore.getPlanMetadata();
    if (metadata.timezone) {
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (metadata.timezone !== currentTimezone) {
        await this.handleTimezoneChange({
          current: currentTimezone,
          previous: metadata.timezone,
          dstOffset: 0,
          changed: true,
          dstChanged: false
        }, 'manual');
      }
    }
  }

  /**
   * Prüft Timezone-Änderungen
   */
  private checkTimezoneChanges(snapshot?: PlanSnapshot): TimezoneInfo {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentDstOffset = this.calculateDSTOffset(new Date(), currentTimezone);

    if (!snapshot) {
      return {
        current: currentTimezone,
        dstOffset: currentDstOffset,
        changed: false,
        dstChanged: false
      };
    }

    const timezoneChanged = snapshot.timezone !== currentTimezone;
    const dstChanged = Math.abs(snapshot.dstOffset - currentDstOffset) > 1; // 1 Minute Toleranz

    return {
      current: currentTimezone,
      previous: snapshot.timezone,
      dstOffset: currentDstOffset,
      previousDstOffset: snapshot.dstOffset,
      changed: timezoneChanged,
      dstChanged
    };
  }

  /**
   * Behandelt Timezone-Änderungen
   */
  private async handleTimezoneChange(
    timezoneInfo: TimezoneInfo, 
    reason: RecoveryResult['reason']
  ): Promise<RecoveryResult> {
    if (!this.context) {
      return {
        success: false,
        recovered: false,
        error: 'Recovery service not initialized',
        reason
      };
    }

    // Prüfe DST-Schutz
    if (this.config.enableDSTProtection && timezoneInfo.dstChanged) {
      const currentHour = new Date().getHours();
      if (currentHour >= 22 || currentHour <= 6) {
        // Nachts - verzögere Recovery bis morgen
        return {
          success: true,
          recovered: false,
          reason,
          error: 'DST change detected during quiet hours - recovery delayed'
        };
      }
    }

    return await this.regeneratePlan(reason);
  }

  /**
   * Validiert gespeicherten Plan
   */
  private validatePlan(snapshot: PlanSnapshot): boolean {
    const now = new Date();
    const snapshotDate = new Date(snapshot.timestamp);
    const daysSinceSnapshot = (now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24);

    // Plan ist gültig wenn weniger als 7 Tage alt
    return daysSinceSnapshot < 7;
  }

  /**
   * Generiert Plan neu
   */
  private async regeneratePlan(reason: RecoveryResult['reason']): Promise<RecoveryResult> {
    if (!this.context) {
      return {
        success: false,
        recovered: false,
        error: 'Recovery service not initialized',
        reason
      };
    }

    // Prüfe Recovery-Limits
    if (this.context.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      return {
        success: false,
        recovered: false,
        error: 'Maximum recovery attempts exceeded',
        reason
      };
    }

    try {
      // Lösche alten Plan
      this.notificationService.clearAll();

      // Generiere neuen Plan
      const gratitudeResult = await this.notificationService.planGratitude(
        this.context.userId,
        this.context.gratitudeSchedule
      );

      const realityCheckResult = await this.notificationService.planRealityChecks(
        this.context.userId,
        this.context.realityCheckSchedule
      );

      // Speichere neuen Plan
      const saveResult = await this.planStore.savePlan(this.context.userId);

      // Update Recovery-Context
      this.context.recoveryAttempts++;
      this.context.lastRecoveryAttempt = Date.now();

      if (saveResult.success && saveResult.snapshot) {
        return {
          success: true,
          recovered: true,
          reason,
          snapshot: saveResult.snapshot
        };
      } else {
        return {
          success: false,
          recovered: false,
          error: saveResult.error,
          reason
        };
      }

    } catch (error) {
      return {
        success: false,
        recovered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason
      };
    }
  }

  /**
   * Stellt Plan aus Snapshot wieder her
   */
  private async restorePlan(snapshot: PlanSnapshot): Promise<void> {
    // Restore Notifications in Service
    for (const notification of snapshot.notifications) {
      // Hier würde die Restore-Logik stehen
      // Für jetzt nur Mock-Implementation
    }
  }

  /**
   * Berechnet DST-Offset
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

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Debug-Methode: Zeigt Recovery-Status
   */
  getDebugInfo() {
    return {
      config: this.config,
      context: this.context,
      hasTimezoneWatcher: !!this.timezoneWatcher,
      hasAppStateListener: !!this.appStateListener
    };
  }
}
