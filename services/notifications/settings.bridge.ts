/**
 * Notification Settings Bridge
 * Brücke zwischen Notification-Service und Profile-Settings
 */

import { UserProfile, UpdateUserProfile } from '../../models/profile.model';
import { GratitudeSchedule, RealityCheckSchedule } from './types';
import { ChannelManager, NotificationChannel } from './channels';

// =========================================================================
// TYPES
// =========================================================================

export interface NotificationSettings {
  gratitude: GratitudeSchedule;
  realityChecks: RealityCheckSchedule;
  sound: {
    enabled: boolean;
    volume: number; // 0.0 - 1.0
  };
  haptic: {
    enabled: boolean;
  };
  snooze: {
    options: number[]; // Minuten: [5, 10, 15]
    maxPerDay: number; // Max 3 Snoozes pro Tag
    maxPerCategory: number; // Max 3 Snoozes pro Kategorie
  };
}

export interface SettingsUpdateResult {
  success: boolean;
  error?: string;
  requiresPlanUpdate: boolean;
  updatedSettings?: NotificationSettings;
}

// =========================================================================
// SETTINGS BRIDGE
// =========================================================================

export class SettingsBridge {
  /**
   * Konvertiert UserProfile zu NotificationSettings
   */
  static profileToNotificationSettings(profile: UserProfile): NotificationSettings {
    return {
      gratitude: {
        enabled: true, // Immer aktiv wenn Profile existiert
        morning: profile.reminderMorning || '08:00',
        evening: profile.reminderEvening || '20:00'
      },
      realityChecks: {
        enabled: profile.realityCheckEnabled || false,
        startTime: profile.realityCheckStart || '10:00',
        endTime: profile.realityCheckEnd || '18:00',
        count: profile.realityCheckCount || 3,
        quietHoursStart: '20:00',
        quietHoursEnd: '10:00'
      },
      sound: {
        enabled: true, // Default: an
        volume: 0.6 // Default: 60%
      },
      haptic: {
        enabled: true // Default: an
      },
      snooze: {
        options: [5, 10, 15], // 5, 10, 15 Minuten
        maxPerDay: 3,
        maxPerCategory: 3
      }
    };
  }

  /**
   * Konvertiert NotificationSettings zu UpdateUserProfile
   */
  static notificationSettingsToProfileUpdate(
    settings: NotificationSettings
  ): UpdateUserProfile {
    return {
      reminderMorning: settings.gratitude.morning,
      reminderEvening: settings.gratitude.evening,
      realityCheckEnabled: settings.realityChecks.enabled,
      realityCheckStart: settings.realityChecks.startTime,
      realityCheckEnd: settings.realityChecks.endTime,
      realityCheckCount: settings.realityChecks.count
    };
  }

  /**
   * Validiert NotificationSettings
   */
  static validateSettings(settings: NotificationSettings): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validiere Gratitude-Zeiten
    if (!this.isValidTime(settings.gratitude.morning)) {
      errors.push('Ungültige morgendliche Gratitude-Zeit');
    }
    if (!this.isValidTime(settings.gratitude.evening)) {
      errors.push('Ungültige abendliche Gratitude-Zeit');
    }

    // Validiere Reality-Check-Zeiten
    if (settings.realityChecks.enabled) {
      if (!this.isValidTime(settings.realityChecks.startTime)) {
        errors.push('Ungültige Reality-Check Start-Zeit');
      }
      if (!this.isValidTime(settings.realityChecks.endTime)) {
        errors.push('Ungültige Reality-Check End-Zeit');
      }
      if (settings.realityChecks.count < 3 || settings.realityChecks.count > 5) {
        errors.push('Reality-Check Count muss zwischen 3 und 5 liegen');
      }
    }

    // Validiere Sound-Volume
    if (settings.sound.volume < 0 || settings.sound.volume > 1) {
      errors.push('Sound-Volume muss zwischen 0.0 und 1.0 liegen');
    }

    // Validiere Snooze-Optionen
    if (settings.snooze.options.length === 0) {
      errors.push('Mindestens eine Snooze-Option erforderlich');
    }
    if (settings.snooze.maxPerDay < 1) {
      errors.push('Max Snoozes pro Tag muss mindestens 1 sein');
    }
    if (settings.snooze.maxPerCategory < 1) {
      errors.push('Max Snoozes pro Kategorie muss mindestens 1 sein');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Prüft ob Settings-Update Plan-Update erfordert
   */
  static requiresPlanUpdate(
    oldSettings: NotificationSettings,
    newSettings: NotificationSettings
  ): boolean {
    // Gratitude-Zeiten geändert
    if (oldSettings.gratitude.morning !== newSettings.gratitude.morning ||
        oldSettings.gratitude.evening !== newSettings.gratitude.evening) {
      return true;
    }

    // Reality-Check-Einstellungen geändert
    if (oldSettings.realityChecks.enabled !== newSettings.realityChecks.enabled ||
        oldSettings.realityChecks.startTime !== newSettings.realityChecks.startTime ||
        oldSettings.realityChecks.endTime !== newSettings.realityChecks.endTime ||
        oldSettings.realityChecks.count !== newSettings.realityChecks.count) {
      return true;
    }

    return false;
  }

  /**
   * Aktualisiert Channel-Einstellungen basierend auf Settings
   */
  static updateChannels(settings: NotificationSettings): void {
    // Aktualisiere Sound-Einstellungen für alle Channels
    const channels = ChannelManager.getActiveChannels();
    
    channels.forEach(channel => {
      ChannelManager.setSoundEnabled(channel.id as any, settings.sound.enabled);
      if (settings.sound.enabled) {
        ChannelManager.setSoundVolume(channel.id as any, settings.sound.volume);
      }
    });

    // Aktualisiere Haptik-Einstellungen für alle Channels
    channels.forEach(channel => {
      ChannelManager.setHapticEnabled(channel.id as any, settings.haptic.enabled);
    });
  }

  /**
   * Holt aktuelle Channel-Einstellungen
   */
  static getChannelSettings(): {
    sound: { enabled: boolean; volume: number };
    haptic: { enabled: boolean };
  } {
    const channels = ChannelManager.getActiveChannels();
    
    if (channels.length === 0) {
      return {
        sound: { enabled: true, volume: 0.6 },
        haptic: { enabled: true }
      };
    }

    // Verwende erste Channel als Referenz (alle sollten gleich sein)
    const firstChannel = channels[0];
    
    return {
      sound: {
        enabled: firstChannel.sound.enabled,
        volume: firstChannel.sound.volume
      },
      haptic: {
        enabled: firstChannel.haptic.enabled
      }
    };
  }

  /**
   * Synchronisiert Settings mit Channels
   */
  static syncSettingsWithChannels(settings: NotificationSettings): NotificationSettings {
    const channelSettings = this.getChannelSettings();
    
    return {
      ...settings,
      sound: {
        enabled: channelSettings.sound.enabled,
        volume: channelSettings.sound.volume
      },
      haptic: {
        enabled: channelSettings.haptic.enabled
      }
    };
  }

  /**
   * Erstellt Default-Settings
   */
  static getDefaultSettings(): NotificationSettings {
    return {
      gratitude: {
        enabled: true,
        morning: '08:00',
        evening: '20:00'
      },
      realityChecks: {
        enabled: false,
        startTime: '10:00',
        endTime: '18:00',
        count: 3,
        quietHoursStart: '20:00',
        quietHoursEnd: '10:00'
      },
      sound: {
        enabled: true,
        volume: 0.6
      },
      haptic: {
        enabled: true
      },
      snooze: {
        options: [5, 10, 15],
        maxPerDay: 3,
        maxPerCategory: 3
      }
    };
  }

  /**
   * Validiert Zeit-Format (HH:mm)
   */
  private static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Debug-Methode: Zeigt Settings-Diff
   */
  static getSettingsDiff(
    oldSettings: NotificationSettings,
    newSettings: NotificationSettings
  ): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};

    // Gratitude
    if (oldSettings.gratitude.morning !== newSettings.gratitude.morning) {
      diff['gratitude.morning'] = {
        old: oldSettings.gratitude.morning,
        new: newSettings.gratitude.morning
      };
    }
    if (oldSettings.gratitude.evening !== newSettings.gratitude.evening) {
      diff['gratitude.evening'] = {
        old: oldSettings.gratitude.evening,
        new: newSettings.gratitude.evening
      };
    }

    // Reality Checks
    if (oldSettings.realityChecks.enabled !== newSettings.realityChecks.enabled) {
      diff['realityChecks.enabled'] = {
        old: oldSettings.realityChecks.enabled,
        new: newSettings.realityChecks.enabled
      };
    }
    if (oldSettings.realityChecks.startTime !== newSettings.realityChecks.startTime) {
      diff['realityChecks.startTime'] = {
        old: oldSettings.realityChecks.startTime,
        new: newSettings.realityChecks.startTime
      };
    }
    if (oldSettings.realityChecks.endTime !== newSettings.realityChecks.endTime) {
      diff['realityChecks.endTime'] = {
        old: oldSettings.realityChecks.endTime,
        new: newSettings.realityChecks.endTime
      };
    }
    if (oldSettings.realityChecks.count !== newSettings.realityChecks.count) {
      diff['realityChecks.count'] = {
        old: oldSettings.realityChecks.count,
        new: newSettings.realityChecks.count
      };
    }

    // Sound
    if (oldSettings.sound.enabled !== newSettings.sound.enabled) {
      diff['sound.enabled'] = {
        old: oldSettings.sound.enabled,
        new: newSettings.sound.enabled
      };
    }
    if (oldSettings.sound.volume !== newSettings.sound.volume) {
      diff['sound.volume'] = {
        old: oldSettings.sound.volume,
        new: newSettings.sound.volume
      };
    }

    // Haptic
    if (oldSettings.haptic.enabled !== newSettings.haptic.enabled) {
      diff['haptic.enabled'] = {
        old: oldSettings.haptic.enabled,
        new: newSettings.haptic.enabled
      };
    }

    return diff;
  }
}
