/**
 * Breath Cues Service
 * Haptik- und Audio-Cues für Atem-Übungen mit konfigurierbaren Profilen
 */

import { Platform } from 'react-native';

export type CueType = 'inhale' | 'hold' | 'exhale' | 'holdAfterExhale' | 'cycle' | 'complete';

export type CueIntensity = 'gentle' | 'distinct';

export interface CueSettings {
  audioEnabled: boolean;
  hapticEnabled: boolean;
  intensity: CueIntensity;
  volume: number; // 0.0 - 1.0
}

export interface CueProfile {
  inhale: CueConfig;
  hold: CueConfig;
  exhale: CueConfig;
  holdAfterExhale: CueConfig;
  cycle: CueConfig;
  complete: CueConfig;
}

export interface CueConfig {
  hapticPattern?: number[]; // Millisekunden für Haptik-Pattern
  audioFile?: string;       // Audio-Datei-Name
  volume?: number;          // Relative Lautstärke (0.0 - 1.0)
}

export interface CueEvent {
  type: CueType;
  timestamp: number;
  cycleIndex?: number;
  phaseIndex?: number;
}

/**
 * Sanfte Cue-Profile für entspannte Atem-Übungen
 */
const GENTLE_CUE_PROFILE: CueProfile = {
  inhale: {
    hapticPattern: [100], // Kurzer, sanfter Impuls
    audioFile: 'inhale_gentle.mp3',
    volume: 0.6
  },
  hold: {
    hapticPattern: [50, 50], // Zwei kurze Impulse
    audioFile: 'hold_gentle.mp3',
    volume: 0.4
  },
  exhale: {
    hapticPattern: [150], // Längerer, sanfter Impuls
    audioFile: 'exhale_gentle.mp3',
    volume: 0.7
  },
  holdAfterExhale: {
    hapticPattern: [50], // Sehr kurzer Impuls
    audioFile: 'hold_after_exhale_gentle.mp3',
    volume: 0.3
  },
  cycle: {
    hapticPattern: [100, 100, 100], // Drei Impulse für Zyklus-Ende
    audioFile: 'cycle_gentle.mp3',
    volume: 0.5
  },
  complete: {
    hapticPattern: [200, 100, 200], // Spezielles Pattern für Abschluss
    audioFile: 'complete_gentle.mp3',
    volume: 0.8
  }
};

/**
 * Deutliche Cue-Profile für fokussierte Atem-Übungen
 */
const DISTINCT_CUE_PROFILE: CueProfile = {
  inhale: {
    hapticPattern: [200], // Längerer, deutlicher Impuls
    audioFile: 'inhale_distinct.mp3',
    volume: 0.8
  },
  hold: {
    hapticPattern: [100, 100, 100], // Drei deutliche Impulse
    audioFile: 'hold_distinct.mp3',
    volume: 0.6
  },
  exhale: {
    hapticPattern: [300], // Sehr langer, deutlicher Impuls
    audioFile: 'exhale_distinct.mp3',
    volume: 0.9
  },
  holdAfterExhale: {
    hapticPattern: [100, 100], // Zwei deutliche Impulse
    audioFile: 'hold_after_exhale_distinct.mp3',
    volume: 0.5
  },
  cycle: {
    hapticPattern: [150, 150, 150, 150], // Vier Impulse für Zyklus-Ende
    audioFile: 'cycle_distinct.mp3',
    volume: 0.7
  },
  complete: {
    hapticPattern: [300, 150, 300, 150, 300], // Komplexes Abschluss-Pattern
    audioFile: 'complete_distinct.mp3',
    volume: 1.0
  }
};

/**
 * Cue-Profile-Mapping
 */
const CUE_PROFILES: Record<CueIntensity, CueProfile> = {
  gentle: GENTLE_CUE_PROFILE,
  distinct: DISTINCT_CUE_PROFILE
};

/**
 * Breath Cues Service
 */
export class BreathCuesService {
  private settings: CueSettings;
  private audioPlayer?: any; // React Native Sound oder ähnlich
  private hapticEngine?: any; // React Native Haptics oder ähnlich
  private isInitialized = false;

  constructor(settings: CueSettings) {
    this.settings = {
      audioEnabled: true,
      hapticEnabled: true,
      intensity: 'gentle',
      volume: 0.7,
      ...settings
    };
  }

  /**
   * Initialisiert Audio- und Haptik-Engines
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Audio-Engine initialisieren (React Native Sound)
      if (this.settings.audioEnabled && Platform.OS !== 'web') {
        // this.audioPlayer = new Sound();
        // await this.audioPlayer.init();
      }

      // Haptik-Engine initialisieren (React Native Haptics)
      if (this.settings.hapticEnabled && Platform.OS !== 'web') {
        // this.hapticEngine = Haptics;
        // await this.hapticEngine.prepare();
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('Cues initialization failed:', error);
      // Fallback: Deaktiviere Audio/Haptik bei Fehlern
      this.settings.audioEnabled = false;
      this.settings.hapticEnabled = false;
    }
  }

  /**
   * Spielt Cue für bestimmte Phase ab
   */
  async playCue(type: CueType, event?: CueEvent): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const profile = CUE_PROFILES[this.settings.intensity];
    const config = profile[type];

    if (!config) {
      return;
    }

    // Parallele Ausführung von Audio und Haptik
    const promises: Promise<void>[] = [];

    // Audio-Cue abspielen
    if (this.settings.audioEnabled && config.audioFile) {
      promises.push(this.playAudioCue(config));
    }

    // Haptik-Cue abspielen
    if (this.settings.hapticEnabled && config.hapticPattern) {
      promises.push(this.playHapticCue(config.hapticPattern));
    }

    // Warte auf beide Cues
    await Promise.allSettled(promises);
  }

  /**
   * Spielt Audio-Cue ab
   */
  private async playAudioCue(config: CueConfig): Promise<void> {
    if (!this.audioPlayer || !config.audioFile) {
      return;
    }

    try {
      // Berechne finale Lautstärke
      const finalVolume = (config.volume || 1.0) * this.settings.volume;
      
      // Audio abspielen
      // await this.audioPlayer.play(config.audioFile, finalVolume);
      
      // Logging ohne PII
      this.logCueEvent('audio', config.audioFile, finalVolume);
    } catch (error) {
      console.warn('Audio cue failed:', error);
      // Fallback: Deaktiviere Audio bei Fehlern
      this.settings.audioEnabled = false;
    }
  }

  /**
   * Spielt Haptik-Cue ab
   */
  private async playHapticCue(pattern: number[]): Promise<void> {
    if (!this.hapticEngine) {
      return;
    }

    try {
      // Haptik-Pattern abspielen
      for (let i = 0; i < pattern.length; i++) {
        const duration = pattern[i];
        
        // Haptik-Impuls auslösen
        // await this.hapticEngine.impact(duration);
        
        // Warte zwischen Impulsen
        if (i < pattern.length - 1) {
          await this.delay(50); // 50ms Pause zwischen Impulsen
        }
      }
      
      // Logging ohne PII
      this.logCueEvent('haptic', pattern.join(','), pattern.length);
    } catch (error) {
      console.warn('Haptic cue failed:', error);
      // Fallback: Deaktiviere Haptik bei Fehlern
      this.settings.hapticEnabled = false;
    }
  }

  /**
   * Verzögerung in Millisekunden
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Loggt Cue-Events ohne PII
   */
  private logCueEvent(type: 'audio' | 'haptic', details: string, value: number): void {
    // Nur anonymisierte Events loggen
    const event = {
      type: `breath_cue_${type}`,
      timestamp: Date.now(),
      details,
      value,
      intensity: this.settings.intensity,
      enabled: this.settings[`${type}Enabled`]
    };
    
    // Hier könnte Telemetrie-Integration erfolgen
    // telemetry.track(event);
  }

  /**
   * Aktualisiert Cue-Einstellungen
   */
  updateSettings(settings: Partial<CueSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
  }

  /**
   * Gibt aktuelle Einstellungen zurück
   */
  getSettings(): CueSettings {
    return { ...this.settings };
  }

  /**
   * Prüft ob Audio verfügbar ist
   */
  isAudioAvailable(): boolean {
    return this.settings.audioEnabled && this.audioPlayer !== undefined;
  }

  /**
   * Prüft ob Haptik verfügbar ist
   */
  isHapticAvailable(): boolean {
    return this.settings.hapticEnabled && this.hapticEngine !== undefined;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    try {
      if (this.audioPlayer) {
        // await this.audioPlayer.cleanup();
        this.audioPlayer = undefined;
      }

      if (this.hapticEngine) {
        // await this.hapticEngine.cleanup();
        this.hapticEngine = undefined;
      }

      this.isInitialized = false;
    } catch (error) {
      console.warn('Cues cleanup failed:', error);
    }
  }
}

/**
 * Factory-Funktion für Breath Cues Service
 */
export function createBreathCuesService(settings: CueSettings): BreathCuesService {
  return new BreathCuesService(settings);
}

/**
 * Utility-Funktionen für Cues
 */
export const CueUtils = {
  /**
   * Validiert Cue-Einstellungen
   */
  validateSettings(settings: CueSettings): string[] {
    const errors: string[] = [];

    if (settings.volume < 0 || settings.volume > 1) {
      errors.push('Lautstärke muss zwischen 0 und 1 liegen');
    }

    if (!['gentle', 'distinct'].includes(settings.intensity)) {
      errors.push('Intensität muss "gentle" oder "distinct" sein');
    }

    return errors;
  },

  /**
   * Erstellt Standard-Einstellungen
   */
  createDefaultSettings(): CueSettings {
    return {
      audioEnabled: true,
      hapticEnabled: true,
      intensity: 'gentle',
      volume: 0.7
    };
  },

  /**
   * Formatiert Cue-Event für Logging
   */
  formatCueEvent(event: CueEvent): string {
    const parts = [`type:${event.type}`, `timestamp:${event.timestamp}`];
    
    if (event.cycleIndex !== undefined) {
      parts.push(`cycle:${event.cycleIndex}`);
    }
    
    if (event.phaseIndex !== undefined) {
      parts.push(`phase:${event.phaseIndex}`);
    }
    
    return parts.join('|');
  }
};
