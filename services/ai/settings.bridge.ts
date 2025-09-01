/**
 * AI Settings Bridge
 * Verwaltet Opt-in, Sprache und Kontingentübersicht für AI-Insights
 */

import { Language } from './prompt.builder';
import { RateLimitStatus } from './openai.client';

/**
 * AI Settings für Benutzer
 */
export interface AISettings {
  userId: string;
  enabled: boolean;
  language: Language;
  eveningReminderEnabled: boolean;
  morningReminderEnabled: boolean;
  eveningReminderTime: string; // HH:mm format
  morningReminderTime: string; // HH:mm format
  lastEveningInsight?: string;
  lastMorningInsight?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Usage Statistics
 */
export interface AIUsageStats {
  userId: string;
  callsToday: number;
  tokensToday: number;
  totalCalls: number;
  totalTokens: number;
  lastCallTime?: string;
  isLimited: boolean;
  remainingCalls: number;
  remainingTokens: number;
}

/**
 * AI Insight Trigger
 */
export interface AIInsightTrigger {
  type: 'evening' | 'morning';
  shouldShow: boolean;
  reason: string;
  lastShown?: string;
}

/**
 * AI Settings Bridge Klasse
 */
export class AISettingsBridge {
  private static readonly DEFAULT_EVENING_TIME = '19:00';
  private static readonly DEFAULT_MORNING_TIME = '06:00';
  private static readonly MAX_CALLS_PER_DAY = 4;
  private static readonly MAX_TOKENS_PER_DAY = 2000;

  /**
   * Holt AI-Settings für User
   */
  static async getSettings(userId: string): Promise<AISettings> {
    // TODO: Implementiere echte Datenbank-Abfrage
    // Für jetzt: Mock-Daten
    return {
      userId,
      enabled: true,
      language: 'de',
      eveningReminderEnabled: true,
      morningReminderEnabled: true,
      eveningReminderTime: this.DEFAULT_EVENING_TIME,
      morningReminderTime: this.DEFAULT_MORNING_TIME,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Speichert AI-Settings für User
   */
  static async saveSettings(settings: AISettings): Promise<void> {
    // TODO: Implementiere echte Datenbank-Speicherung
    console.log('Saving AI settings:', settings);
  }

  /**
   * Aktualisiert AI-Settings
   */
  static async updateSettings(userId: string, updates: Partial<AISettings>): Promise<AISettings> {
    const currentSettings = await this.getSettings(userId);
    const updatedSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.saveSettings(updatedSettings);
    return updatedSettings;
  }

  /**
   * Holt AI-Usage-Statistiken
   */
  static async getUsageStats(userId: string, rateLimitStatus: RateLimitStatus): Promise<AIUsageStats> {
    return {
      userId,
      callsToday: rateLimitStatus.callsToday,
      tokensToday: rateLimitStatus.tokensToday,
      totalCalls: rateLimitStatus.callsToday, // Vereinfacht
      totalTokens: rateLimitStatus.tokensToday, // Vereinfacht
      lastCallTime: rateLimitStatus.lastCallTime,
      isLimited: rateLimitStatus.isLimited,
      remainingCalls: Math.max(0, this.MAX_CALLS_PER_DAY - rateLimitStatus.callsToday),
      remainingTokens: Math.max(0, this.MAX_TOKENS_PER_DAY - rateLimitStatus.tokensToday)
    };
  }

  /**
   * Prüft ob Evening-Insight angezeigt werden soll
   */
  static async shouldShowEveningInsight(userId: string): Promise<AIInsightTrigger> {
    const settings = await this.getSettings(userId);
    
    if (!settings.enabled || !settings.eveningReminderEnabled) {
      return {
        type: 'evening',
        shouldShow: false,
        reason: 'AI-Insights deaktiviert'
      };
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    const eveningTime = settings.eveningReminderTime;
    
    // Prüfe ob es nach der Evening-Zeit ist
    const shouldShowByTime = currentTime >= eveningTime;
    
    // Prüfe ob heute bereits ein Evening-Insight erstellt wurde
    const today = now.toDateString();
    const lastEveningDate = settings.lastEveningInsight 
      ? new Date(settings.lastEveningInsight).toDateString()
      : null;
    
    const alreadyShownToday = lastEveningDate === today;

    if (shouldShowByTime && !alreadyShownToday) {
      return {
        type: 'evening',
        shouldShow: true,
        reason: 'Zeit für Tagesrückblick',
        lastShown: settings.lastEveningInsight
      };
    }

    return {
      type: 'evening',
      shouldShow: false,
      reason: alreadyShownToday ? 'Bereits heute erstellt' : 'Noch nicht Zeit',
      lastShown: settings.lastEveningInsight
    };
  }

  /**
   * Prüft ob Morning-Insight angezeigt werden soll
   */
  static async shouldShowMorningInsight(userId: string): Promise<AIInsightTrigger> {
    const settings = await this.getSettings(userId);
    
    if (!settings.enabled || !settings.morningReminderEnabled) {
      return {
        type: 'morning',
        shouldShow: false,
        reason: 'AI-Insights deaktiviert'
      };
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    const morningTime = settings.morningReminderTime;
    
    // Prüfe ob es nach der Morning-Zeit ist
    const shouldShowByTime = currentTime >= morningTime;
    
    // Prüfe ob heute bereits ein Morning-Insight erstellt wurde
    const today = now.toDateString();
    const lastMorningDate = settings.lastMorningInsight 
      ? new Date(settings.lastMorningInsight).toDateString()
      : null;
    
    const alreadyShownToday = lastMorningDate === today;

    if (shouldShowByTime && !alreadyShownToday) {
      return {
        type: 'morning',
        shouldShow: true,
        reason: 'Zeit für Tagesfokus',
        lastShown: settings.lastMorningInsight
      };
    }

    return {
      type: 'morning',
      shouldShow: false,
      reason: alreadyShownToday ? 'Bereits heute erstellt' : 'Noch nicht Zeit',
      lastShown: settings.lastMorningInsight
    };
  }

  /**
   * Markiert Evening-Insight als erstellt
   */
  static async markEveningInsightCreated(userId: string, insight: string): Promise<void> {
    await this.updateSettings(userId, {
      lastEveningInsight: new Date().toISOString()
    });
  }

  /**
   * Markiert Morning-Insight als erstellt
   */
  static async markMorningInsightCreated(userId: string, insight: string): Promise<void> {
    await this.updateSettings(userId, {
      lastMorningInsight: new Date().toISOString()
    });
  }

  /**
   * Validiert Settings
   */
  static validateSettings(settings: Partial<AISettings>): string[] {
    const errors: string[] = [];

    if (settings.language && !['de', 'en'].includes(settings.language)) {
      errors.push('Sprache muss "de" oder "en" sein');
    }

    if (settings.eveningReminderTime && !this.isValidTime(settings.eveningReminderTime)) {
      errors.push('Evening-Zeit muss im Format HH:mm sein');
    }

    if (settings.morningReminderTime && !this.isValidTime(settings.morningReminderTime)) {
      errors.push('Morning-Zeit muss im Format HH:mm sein');
    }

    return errors;
  }

  /**
   * Prüft ob Zeit-Format gültig ist
   */
  private static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Holt verfügbare Sprachen
   */
  static getAvailableLanguages(): Array<{ code: Language; name: string }> {
    return [
      { code: 'de', name: 'Deutsch' },
      { code: 'en', name: 'English' }
    ];
  }

  /**
   * Holt Standard-Zeiten
   */
  static getDefaultTimes(): { evening: string; morning: string } {
    return {
      evening: this.DEFAULT_EVENING_TIME,
      morning: this.DEFAULT_MORNING_TIME
    };
  }

  /**
   * Formatiert Usage-Statistiken für Anzeige
   */
  static formatUsageStats(stats: AIUsageStats): {
    callsText: string;
    tokensText: string;
    statusText: string;
    isLimited: boolean;
  } {
    const callsText = `${stats.callsToday}/${this.MAX_CALLS_PER_DAY} Aufrufe heute`;
    const tokensText = `${stats.tokensToday}/${this.MAX_TOKENS_PER_DAY} Tokens heute`;
    
    let statusText = 'Verfügbar';
    if (stats.isLimited) {
      statusText = 'Limit erreicht';
    } else if (stats.remainingCalls <= 1) {
      statusText = 'Fast erreicht';
    }

    return {
      callsText,
      tokensText,
      statusText,
      isLimited: stats.isLimited
    };
  }

  /**
   * Prüft ob User AI-Insights verwenden kann
   */
  static async canUseAIInsights(userId: string, rateLimitStatus: RateLimitStatus): Promise<{
    canUse: boolean;
    reason?: string;
    remainingCalls: number;
    remainingTokens: number;
  }> {
    const settings = await this.getSettings(userId);
    
    if (!settings.enabled) {
      return {
        canUse: false,
        reason: 'AI-Insights deaktiviert',
        remainingCalls: 0,
        remainingTokens: 0
      };
    }

    if (rateLimitStatus.isLimited) {
      return {
        canUse: false,
        reason: 'Tägliches Limit erreicht',
        remainingCalls: 0,
        remainingTokens: 0
      };
    }

    return {
      canUse: true,
      remainingCalls: Math.max(0, this.MAX_CALLS_PER_DAY - rateLimitStatus.callsToday),
      remainingTokens: Math.max(0, this.MAX_TOKENS_PER_DAY - rateLimitStatus.tokensToday)
    };
  }
}
