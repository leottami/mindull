/**
 * Notification Channels & Kategorien
 * Lokale Notifications mit Ton und Haptik-Optionen
 */

import { NotificationCategory } from './types';

// =========================================================================
// CHANNEL CONFIGURATION
// =========================================================================

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  sound: NotificationSound;
  haptic: NotificationHaptic;
  priority: 'high' | 'normal' | 'low';
  enabled: boolean;
}

export interface NotificationSound {
  name: string;
  volume: number; // 0.0 - 1.0
  enabled: boolean;
}

export interface NotificationHaptic {
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
  enabled: boolean;
}

// =========================================================================
// CHANNEL DEFINITIONS
// =========================================================================

export const NOTIFICATION_CHANNELS: Record<NotificationCategory, NotificationChannel> = {
  gratitude_morning: {
    id: 'gratitude_morning',
    name: 'Dankbarkeit - Morgen',
    description: 'Morgendliche Erinnerung für Dankbarkeits-Eintrag',
    sound: {
      name: 'gentle_morning',
      volume: 0.7,
      enabled: true
    },
    haptic: {
      type: 'light',
      enabled: true
    },
    priority: 'normal',
    enabled: true
  },

  gratitude_evening: {
    id: 'gratitude_evening',
    name: 'Dankbarkeit - Abend',
    description: 'Abendliche Erinnerung für Dankbarkeits-Eintrag',
    sound: {
      name: 'gentle_evening',
      volume: 0.6,
      enabled: true
    },
    haptic: {
      type: 'light',
      enabled: true
    },
    priority: 'normal',
    enabled: true
  },

  reality_check: {
    id: 'reality_check',
    name: 'Reality Check',
    description: 'Erinnerung für Reality-Check (Luzides Träumen)',
    sound: {
      name: 'subtle_alert',
      volume: 0.5,
      enabled: true
    },
    haptic: {
      type: 'medium',
      enabled: true
    },
    priority: 'high',
    enabled: true
  },

  reminder: {
    id: 'reminder',
    name: 'Allgemeine Erinnerung',
    description: 'Allgemeine App-Erinnerungen',
    sound: {
      name: 'default',
      volume: 0.6,
      enabled: true
    },
    haptic: {
      type: 'light',
      enabled: true
    },
    priority: 'normal',
    enabled: true
  }
};

// =========================================================================
// CHANNEL MANAGEMENT
// =========================================================================

export class ChannelManager {
  /**
   * Holt Channel-Konfiguration für Kategorie
   */
  static getChannel(category: NotificationCategory): NotificationChannel {
    return NOTIFICATION_CHANNELS[category];
  }

  /**
   * Aktualisiert Channel-Konfiguration
   */
  static updateChannel(
    category: NotificationCategory, 
    updates: Partial<NotificationChannel>
  ): NotificationChannel {
    const channel = NOTIFICATION_CHANNELS[category];
    return { ...channel, ...updates };
  }

  /**
   * Aktiviert/Deaktiviert Channel
   */
  static setChannelEnabled(category: NotificationCategory, enabled: boolean): void {
    NOTIFICATION_CHANNELS[category].enabled = enabled;
  }

  /**
   * Aktiviert/Deaktiviert Sound für Channel
   */
  static setSoundEnabled(category: NotificationCategory, enabled: boolean): void {
    NOTIFICATION_CHANNELS[category].sound.enabled = enabled;
  }

  /**
   * Aktiviert/Deaktiviert Haptik für Channel
   */
  static setHapticEnabled(category: NotificationCategory, enabled: boolean): void {
    NOTIFICATION_CHANNELS[category].haptic.enabled = enabled;
  }

  /**
   * Setzt Sound-Volume für Channel
   */
  static setSoundVolume(category: NotificationCategory, volume: number): void {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0.0 and 1.0');
    }
    NOTIFICATION_CHANNELS[category].sound.volume = volume;
  }

  /**
   * Setzt Haptik-Typ für Channel
   */
  static setHapticType(category: NotificationCategory, type: NotificationHaptic['type']): void {
    NOTIFICATION_CHANNELS[category].haptic.type = type;
  }

  /**
   * Holt alle aktiven Channels
   */
  static getActiveChannels(): NotificationChannel[] {
    return Object.values(NOTIFICATION_CHANNELS).filter(channel => channel.enabled);
  }

  /**
   * Holt alle Channels mit aktivem Sound
   */
  static getChannelsWithSound(): NotificationChannel[] {
    return Object.values(NOTIFICATION_CHANNELS).filter(
      channel => channel.enabled && channel.sound.enabled
    );
  }

  /**
   * Holt alle Channels mit aktiver Haptik
   */
  static getChannelsWithHaptic(): NotificationChannel[] {
    return Object.values(NOTIFICATION_CHANNELS).filter(
      channel => channel.enabled && channel.haptic.enabled
    );
  }
}

// =========================================================================
// DEFAULT SETTINGS
// =========================================================================

export const DEFAULT_CHANNEL_SETTINGS = {
  soundEnabled: true,
  hapticEnabled: true,
  volume: 0.6,
  hapticType: 'light' as const
};

// =========================================================================
// CHANNEL VALIDATION
// =========================================================================

export class ChannelValidator {
  /**
   * Validiert Volume-Wert (0.0 - 1.0)
   */
  static isValidVolume(volume: number): boolean {
    return volume >= 0 && volume <= 1;
  }

  /**
   * Validiert Haptik-Typ
   */
  static isValidHapticType(type: string): type is NotificationHaptic['type'] {
    return ['light', 'medium', 'heavy', 'success', 'warning', 'error'].includes(type);
  }

  /**
   * Validiert Channel-Konfiguration
   */
  static isValidChannel(channel: NotificationChannel): boolean {
    return (
      channel.id &&
      channel.name &&
      this.isValidVolume(channel.sound.volume) &&
      this.isValidHapticType(channel.haptic.type)
    );
  }
}
