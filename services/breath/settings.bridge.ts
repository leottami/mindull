/**
 * Breath Settings Bridge
 * Verbindung zwischen Breath-Services und User-Settings
 */

import { 
  BreathingMethod, 
  BREATHING_METHODS,
  BREATHING_CONSTRAINTS,
  BreathingMethodConfig,
  CustomBreathingConfig 
} from './methods.catalog';
import { 
  CueSettings, 
  CueIntensity, 
  CueType,
  CueUtils 
} from './cues';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Breath Settings Interface
 */
export interface BreathSettings {
  // Audio & Haptics
  audioEnabled: boolean;
  hapticEnabled: boolean;
  audioIntensity: CueIntensity;
  hapticIntensity: CueIntensity;
  
  // Default Method
  defaultMethod: BreathingMethod;
  defaultCycles: number;
  
  // Custom Method Settings
  customPhases: {
    inhaleSec: number;
    holdSec: number;
    exhaleSec: number;
    holdAfterExhaleSec: number;
  };
  
  // Session Preferences
  autoStart: boolean;
  backgroundBehavior: 'pause' | 'stop' | 'continue';
  showProgress: boolean;
  
  // Advanced Settings
  strictTiming: boolean;
  allowInterruptions: boolean;
  sessionReminders: boolean;
}

/**
 * Settings Validation Result
 */
export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedSettings?: Partial<BreathSettings>;
}

/**
 * Settings Change Event
 */
export interface BreathSettingsChangeEvent {
  type: 'audio' | 'haptic' | 'method' | 'cycles' | 'phases' | 'session' | 'advanced';
  key: keyof BreathSettings;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Default Breath Settings
 */
export const DEFAULT_BREATH_SETTINGS: BreathSettings = {
  // Audio & Haptics
  audioEnabled: true,
  hapticEnabled: true,
  audioIntensity: 'gentle',
  hapticIntensity: 'gentle',
  
  // Default Method
  defaultMethod: 'box',
  defaultCycles: BREATHING_METHODS.box.defaultCycles,
  
  // Custom Method Settings
  customPhases: {
    inhaleSec: 4,
    holdSec: 4,
    exhaleSec: 4,
    holdAfterExhaleSec: 4
  },
  
  // Session Preferences
  autoStart: false,
  backgroundBehavior: 'pause',
  showProgress: true,
  
  // Advanced Settings
  strictTiming: false,
  allowInterruptions: true,
  sessionReminders: true
};

// ============================================================================
// SETTINGS VALIDATOR
// ============================================================================

/**
 * Breath Settings Validator
 */
export class BreathSettingsValidator {
  
  /**
   * Validiert alle Breath-Settings
   */
  static validateSettings(settings: Partial<BreathSettings>): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const correctedSettings: Partial<BreathSettings> = {};

    // Audio & Haptics Validation
    if (settings.audioEnabled !== undefined) {
      if (typeof settings.audioEnabled !== 'boolean') {
        errors.push('audioEnabled muss ein Boolean sein');
      }
    }

    if (settings.hapticEnabled !== undefined) {
      if (typeof settings.hapticEnabled !== 'boolean') {
        errors.push('hapticEnabled muss ein Boolean sein');
      }
    }

    if (settings.audioIntensity !== undefined) {
      if (!['gentle', 'distinct'].includes(settings.audioIntensity)) {
        errors.push('audioIntensity muss "gentle" oder "distinct" sein');
        correctedSettings.audioIntensity = 'gentle';
      }
    }

    if (settings.hapticIntensity !== undefined) {
      if (!['gentle', 'distinct'].includes(settings.hapticIntensity)) {
        errors.push('hapticIntensity muss "gentle" oder "distinct" sein');
        correctedSettings.hapticIntensity = 'gentle';
      }
    }

    // Default Method Validation
    if (settings.defaultMethod !== undefined) {
      if (!Object.keys(BREATHING_METHODS).includes(settings.defaultMethod)) {
        errors.push(`defaultMethod "${settings.defaultMethod}" ist nicht verfügbar`);
        correctedSettings.defaultMethod = 'box';
      }
    }

    if (settings.defaultCycles !== undefined) {
      const method = settings.defaultMethod || DEFAULT_BREATH_SETTINGS.defaultMethod;
      const methodConfig = BREATHING_METHODS[method];
      
      if (methodConfig && settings.defaultCycles < methodConfig.minCycles) {
        errors.push(`defaultCycles muss mindestens ${methodConfig.minCycles} sein`);
        correctedSettings.defaultCycles = methodConfig.minCycles;
      } else if (methodConfig && settings.defaultCycles > methodConfig.maxCycles) {
        errors.push(`defaultCycles darf maximal ${methodConfig.maxCycles} sein`);
        correctedSettings.defaultCycles = methodConfig.maxCycles;
      }
    }

    // Custom Phases Validation
    if (settings.customPhases) {
      const phases = settings.customPhases;
      const constraints = BREATHING_CONSTRAINTS.phase;
      let correctedPhases = { ...phases };

      if (phases.inhaleSec < constraints.min || phases.inhaleSec > constraints.max) {
        errors.push(`inhaleSec muss zwischen ${constraints.min} und ${constraints.max} Sekunden sein`);
        correctedPhases.inhaleSec = Math.max(constraints.min, Math.min(constraints.max, phases.inhaleSec));
      }

      if (phases.holdSec < constraints.min || phases.holdSec > constraints.max) {
        errors.push(`holdSec muss zwischen ${constraints.min} und ${constraints.max} Sekunden sein`);
        correctedPhases.holdSec = Math.max(constraints.min, Math.min(constraints.max, phases.holdSec));
      }

      if (phases.exhaleSec < constraints.min || phases.exhaleSec > constraints.max) {
        errors.push(`exhaleSec muss zwischen ${constraints.min} und ${constraints.max} Sekunden sein`);
        correctedPhases.exhaleSec = Math.max(constraints.min, Math.min(constraints.max, phases.exhaleSec));
      }

      if (phases.holdAfterExhaleSec < constraints.min || phases.holdAfterExhaleSec > constraints.max) {
        errors.push(`holdAfterExhaleSec muss zwischen ${constraints.min} und ${constraints.max} Sekunden sein`);
        correctedPhases.holdAfterExhaleSec = Math.max(constraints.min, Math.min(constraints.max, phases.holdAfterExhaleSec));
      }

      // Only set correctedPhases if any corrections were made
      if (JSON.stringify(correctedPhases) !== JSON.stringify(phases)) {
        correctedSettings.customPhases = correctedPhases;
      }
    }

    // Session Preferences Validation
    if (settings.autoStart !== undefined) {
      if (typeof settings.autoStart !== 'boolean') {
        errors.push('autoStart muss ein Boolean sein');
      }
    }

    if (settings.backgroundBehavior !== undefined) {
      if (!['pause', 'stop', 'continue'].includes(settings.backgroundBehavior)) {
        errors.push('backgroundBehavior muss "pause", "stop" oder "continue" sein');
        correctedSettings.backgroundBehavior = 'pause';
      }
    }

    if (settings.showProgress !== undefined) {
      if (typeof settings.showProgress !== 'boolean') {
        errors.push('showProgress muss ein Boolean sein');
      }
    }

    // Advanced Settings Validation
    if (settings.strictTiming !== undefined) {
      if (typeof settings.strictTiming !== 'boolean') {
        errors.push('strictTiming muss ein Boolean sein');
      }
    }

    if (settings.allowInterruptions !== undefined) {
      if (typeof settings.allowInterruptions !== 'boolean') {
        errors.push('allowInterruptions muss ein Boolean sein');
      }
    }

    if (settings.sessionReminders !== undefined) {
      if (typeof settings.sessionReminders !== 'boolean') {
        errors.push('sessionReminders muss ein Boolean sein');
      }
    }

    // Warnings für potenzielle Probleme
    if (settings.audioEnabled === false && settings.hapticEnabled === false) {
      warnings.push('Audio und Haptik sind beide deaktiviert - keine Feedback-Signale');
    }

    if (settings.backgroundBehavior === 'continue' && settings.allowInterruptions === false) {
      warnings.push('Hintergrund-Verhalten "continue" mit deaktivierten Unterbrechungen kann problematisch sein');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedSettings: Object.keys(correctedSettings).length > 0 ? correctedSettings : undefined
    };
  }

  /**
   * Validiert einzelne Einstellung
   */
  static validateSingleSetting<K extends keyof BreathSettings>(
    key: K, 
    value: BreathSettings[K]
  ): { isValid: boolean; error?: string; correctedValue?: BreathSettings[K] } {
    const validation = BreathSettingsValidator.validateSettings({ [key]: value } as Partial<BreathSettings>);
    
    return {
      isValid: validation.isValid,
      error: validation.errors[0],
      correctedValue: validation.correctedSettings?.[key]
    };
  }
}

// ============================================================================
// SETTINGS BRIDGE SERVICE
// ============================================================================

/**
 * Breath Settings Bridge Service
 * Verbindet Breath-Services mit User-Settings
 */
export class BreathSettingsBridge {
  private static instance: BreathSettingsBridge;
  private settings: BreathSettings;
  private changeListeners: Array<(event: BreathSettingsChangeEvent) => void> = [];

  private constructor() {
    this.settings = { ...DEFAULT_BREATH_SETTINGS };
  }

  static getInstance(): BreathSettingsBridge {
    if (!BreathSettingsBridge.instance) {
      BreathSettingsBridge.instance = new BreathSettingsBridge();
    }
    return BreathSettingsBridge.instance;
  }

  /**
   * Lädt Settings aus Storage
   */
  async loadSettings(): Promise<BreathSettings> {
    try {
      // TODO: Implementierung mit AsyncStorage oder SecureStore
      // const storedSettings = await AsyncStorage.getItem('breath_settings');
      // if (storedSettings) {
      //   const parsed = JSON.parse(storedSettings);
      //   const validation = BreathSettingsValidator.validateSettings(parsed);
      //   if (validation.isValid) {
      //     this.settings = { ...DEFAULT_BREATH_SETTINGS, ...parsed };
      //   } else {
      //     console.warn('Invalid settings loaded, using defaults:', validation.errors);
      //     if (validation.correctedSettings) {
      //       this.settings = { ...DEFAULT_BREATH_SETTINGS, ...parsed, ...validation.correctedSettings };
      //     }
      //   }
      // }
      
      return this.settings;
    } catch (error) {
      console.error('Failed to load breath settings:', error);
      return this.settings;
    }
  }

  /**
   * Speichert Settings in Storage
   */
  async saveSettings(settings: Partial<BreathSettings>): Promise<boolean> {
    try {
      const validation = BreathSettingsValidator.validateSettings(settings);
      
      if (!validation.isValid) {
        console.error('Invalid settings:', validation.errors);
        return false;
      }

      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...settings };

      // Speichere in Storage
      // TODO: Implementierung mit AsyncStorage oder SecureStore
      // await AsyncStorage.setItem('breath_settings', JSON.stringify(this.settings));

      // Benachrichtige Listener über Änderungen
      this.notifySettingsChanges(oldSettings, this.settings);

      return true;
    } catch (error) {
      console.error('Failed to save breath settings:', error);
      return false;
    }
  }

  /**
   * Aktualisiert einzelne Einstellung
   */
  async updateSetting<K extends keyof BreathSettings>(
    key: K, 
    value: BreathSettings[K]
  ): Promise<boolean> {
    return this.saveSettings({ [key]: value } as Partial<BreathSettings>);
  }

  /**
   * Holt aktuelle Settings
   */
  getSettings(): BreathSettings {
    return { ...this.settings };
  }

  /**
   * Holt einzelne Einstellung
   */
  getSetting<K extends keyof BreathSettings>(key: K): BreathSettings[K] {
    return this.settings[key];
  }

  /**
   * Setzt Settings auf Standardwerte zurück
   */
  async resetToDefaults(): Promise<boolean> {
    return this.saveSettings(DEFAULT_BREATH_SETTINGS);
  }

  /**
   * Registriert Listener für Settings-Änderungen
   */
  onSettingsChange(listener: (event: BreathSettingsChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Benachrichtigt Listener über Settings-Änderungen
   */
  private notifySettingsChanges(oldSettings: BreathSettings, newSettings: BreathSettings): void {
    const changes: Array<{ key: keyof BreathSettings; oldValue: any; newValue: any }> = [];

    // Finde geänderte Einstellungen
    (Object.keys(newSettings) as Array<keyof BreathSettings>).forEach(key => {
      if (oldSettings[key] !== newSettings[key]) {
        changes.push({
          key,
          oldValue: oldSettings[key],
          newValue: newSettings[key]
        });
      }
    });

    // Erstelle Events und benachrichtige Listener
    changes.forEach(change => {
      const event: BreathSettingsChangeEvent = {
        type: this.getChangeType(change.key),
        key: change.key,
        oldValue: change.oldValue,
        newValue: change.newValue,
        timestamp: Date.now()
      };

      this.changeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Settings change listener error:', error);
        }
      });
    });
  }

  /**
   * Bestimmt den Typ einer Settings-Änderung
   */
  private getChangeType(key: keyof BreathSettings): BreathSettingsChangeEvent['type'] {
    if (['audioEnabled', 'audioIntensity'].includes(key)) {
      return 'audio';
    }
    if (['hapticEnabled', 'hapticIntensity'].includes(key)) {
      return 'haptic';
    }
    if (['defaultMethod', 'defaultCycles'].includes(key)) {
      return 'method';
    }
    if (['customPhases'].includes(key)) {
      return 'phases';
    }
    if (['autoStart', 'backgroundBehavior', 'showProgress'].includes(key)) {
      return 'session';
    }
    return 'advanced';
  }

  /**
   * Konvertiert Settings zu CueSettings
   */
  getCueSettings(): CueSettings {
    return {
      audioEnabled: this.settings.audioEnabled,
      hapticEnabled: this.settings.hapticEnabled,
      audioIntensity: this.settings.audioIntensity,
      hapticIntensity: this.settings.hapticIntensity
    };
  }

  /**
   * Konvertiert Settings zu Controller-Config
   */
  getControllerConfig(): {
    method: BreathingMethod;
    cycles: number;
    customPhases?: any;
    audioEnabled: boolean;
    hapticEnabled: boolean;
    backgroundBehavior: 'pause' | 'stop' | 'continue';
  } {
    return {
      method: this.settings.defaultMethod,
      cycles: this.settings.defaultCycles,
      customPhases: this.settings.defaultMethod === 'custom' ? this.settings.customPhases : undefined,
      audioEnabled: this.settings.audioEnabled,
      hapticEnabled: this.settings.hapticEnabled,
      backgroundBehavior: this.settings.backgroundBehavior
    };
  }

  /**
   * Validiert und korrigiert Settings
   */
  async validateAndCorrectSettings(settings: Partial<BreathSettings>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    correctedSettings?: Partial<BreathSettings>;
  }> {
    const validation = BreathSettingsValidator.validateSettings(settings);
    
    if (validation.correctedSettings) {
      await this.saveSettings(validation.correctedSettings);
    }
    
    return validation;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Erstellt Settings Bridge Instance
 */
export function createBreathSettingsBridge(): BreathSettingsBridge {
  return BreathSettingsBridge.getInstance();
}

/**
 * Settings Utilities
 */
export const BreathSettingsUtils = {
  /**
   * Validiert Settings
   */
  validate: BreathSettingsValidator.validateSettings,
  
  /**
   * Validiert einzelne Einstellung
   */
  validateSingle: BreathSettingsValidator.validateSingleSetting,
  
  /**
   * Default Settings
   */
  getDefaults: () => ({ ...DEFAULT_BREATH_SETTINGS }),
  
  /**
   * Verfügbare Methoden
   */
  getAvailableMethods: () => Object.keys(BREATHING_METHODS) as BreathingMethod[],
  
  /**
   * Method-Konfiguration
   */
  getMethodConfig: (method: BreathingMethod) => BREATHING_METHODS[method],
  
  /**
   * Constraints
   */
  getConstraints: () => ({ ...BREATHING_CONSTRAINTS }),
  
  /**
   * Cue-Intensitäten
   */
  getCueIntensities: (): CueIntensity[] => ['gentle', 'distinct'],
  
  /**
   * Background-Verhalten
   */
  getBackgroundBehaviors: () => ['pause', 'stop', 'continue'] as const
};
