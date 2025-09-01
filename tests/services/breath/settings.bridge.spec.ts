/**
 * Breath Settings Bridge Tests
 * Testet Settings-Bridge, Validierung und Integration
 */

import { 
  BreathSettingsBridge,
  BreathSettingsValidator,
  BreathSettingsUtils,
  DEFAULT_BREATH_SETTINGS,
  BreathSettings,
  SettingsValidationResult
} from '../../../services/breath/settings.bridge';
import { 
  BREATHING_METHODS,
  BREATHING_CONSTRAINTS 
} from '../../../services/breath/methods.catalog';
import { CueIntensity } from '../../../services/breath/cues';

describe('Breath Settings Bridge', () => {
  let settingsBridge: BreathSettingsBridge;

  beforeEach(() => {
    // Reset singleton instance
    (BreathSettingsBridge as any).instance = undefined;
    settingsBridge = BreathSettingsBridge.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BreathSettingsValidator', () => {
    describe('validateSettings', () => {
      it('sollte gültige Settings akzeptieren', () => {
        const validSettings: Partial<BreathSettings> = {
          audioEnabled: true,
          hapticEnabled: false,
          audioIntensity: 'gentle',
          defaultMethod: 'box',
          defaultCycles: 5
        };

        const result = BreathSettingsValidator.validateSettings(validSettings);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.correctedSettings).toBeUndefined();
      });

      it('sollte ungültige Audio-Intensität korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          audioIntensity: 'invalid' as CueIntensity
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('audioIntensity muss "gentle" oder "distinct" sein');
        expect(result.correctedSettings?.audioIntensity).toBe('gentle');
      });

      it('sollte ungültige Haptik-Intensität korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          hapticIntensity: 'invalid' as CueIntensity
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('hapticIntensity muss "gentle" oder "distinct" sein');
        expect(result.correctedSettings?.hapticIntensity).toBe('gentle');
      });

      it('sollte ungültige Default-Methode korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          defaultMethod: 'invalid' as any
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('defaultMethod "invalid" ist nicht verfügbar');
        expect(result.correctedSettings?.defaultMethod).toBe('box');
      });

      it('sollte ungültige Default-Zyklen korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          defaultMethod: 'box',
          defaultCycles: 100 // Über Maximum
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('defaultCycles darf maximal 20 sein');
        expect(result.correctedSettings?.defaultCycles).toBe(20);
      });

      it('sollte ungültige Custom-Phasen korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          customPhases: {
            inhaleSec: 25, // Über Maximum
            holdSec: 4,
            exhaleSec: 4,
            holdAfterExhaleSec: 4
          }
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('inhaleSec muss zwischen 1 und 20 Sekunden sein');
        expect(result.correctedSettings?.customPhases?.inhaleSec).toBe(20);
      });

      it('sollte ungültiges Background-Verhalten korrigieren', () => {
        const invalidSettings: Partial<BreathSettings> = {
          backgroundBehavior: 'invalid' as any
        };

        const result = BreathSettingsValidator.validateSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('backgroundBehavior muss "pause", "stop" oder "continue" sein');
        expect(result.correctedSettings?.backgroundBehavior).toBe('pause');
      });

      it('sollte Warnungen für problematische Kombinationen ausgeben', () => {
        const problematicSettings: Partial<BreathSettings> = {
          audioEnabled: false,
          hapticEnabled: false
        };

        const result = BreathSettingsValidator.validateSettings(problematicSettings);
        
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Audio und Haptik sind beide deaktiviert - keine Feedback-Signale');
      });

      it('sollte Warnung für Background-Verhalten mit deaktivierten Unterbrechungen ausgeben', () => {
        const problematicSettings: Partial<BreathSettings> = {
          backgroundBehavior: 'continue',
          allowInterruptions: false
        };

        const result = BreathSettingsValidator.validateSettings(problematicSettings);
        
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Hintergrund-Verhalten "continue" mit deaktivierten Unterbrechungen kann problematisch sein');
      });
    });

    describe('validateSingleSetting', () => {
      it('sollte einzelne gültige Einstellung akzeptieren', () => {
        const result = BreathSettingsValidator.validateSingleSetting('audioEnabled', true);
        
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.correctedValue).toBeUndefined();
      });

      it('sollte einzelne ungültige Einstellung korrigieren', () => {
        const result = BreathSettingsValidator.validateSingleSetting('audioIntensity', 'invalid' as CueIntensity);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('audioIntensity muss "gentle" oder "distinct" sein');
        expect(result.correctedValue).toBe('gentle');
      });
    });
  });

  describe('BreathSettingsBridge', () => {
    describe('Singleton Pattern', () => {
      it('sollte Singleton-Instanz zurückgeben', () => {
        const instance1 = BreathSettingsBridge.getInstance();
        const instance2 = BreathSettingsBridge.getInstance();
        
        expect(instance1).toBe(instance2);
      });
    });

    describe('Settings Management', () => {
      it('sollte Default-Settings laden', async () => {
        const settings = await settingsBridge.loadSettings();
        
        expect(settings).toEqual(DEFAULT_BREATH_SETTINGS);
      });

      it('sollte Settings speichern', async () => {
        const newSettings: Partial<BreathSettings> = {
          audioEnabled: false,
          defaultMethod: '478'
        };

        const success = await settingsBridge.saveSettings(newSettings);
        
        expect(success).toBe(true);
        
        const updatedSettings = settingsBridge.getSettings();
        expect(updatedSettings.audioEnabled).toBe(false);
        expect(updatedSettings.defaultMethod).toBe('478');
      });

      it('sollte einzelne Einstellung aktualisieren', async () => {
        const success = await settingsBridge.updateSetting('audioEnabled', false);
        
        expect(success).toBe(true);
        expect(settingsBridge.getSetting('audioEnabled')).toBe(false);
      });

      it('sollte ungültige Settings ablehnen', async () => {
        const invalidSettings: Partial<BreathSettings> = {
          audioIntensity: 'invalid' as CueIntensity
        };

        const success = await settingsBridge.saveSettings(invalidSettings);
        
        expect(success).toBe(false);
      });

      it('sollte Settings auf Standardwerte zurücksetzen', async () => {
        // Erst Settings ändern
        await settingsBridge.saveSettings({ audioEnabled: false });
        expect(settingsBridge.getSetting('audioEnabled')).toBe(false);

        // Zurücksetzen
        const success = await settingsBridge.resetToDefaults();
        
        expect(success).toBe(true);
        expect(settingsBridge.getSetting('audioEnabled')).toBe(true);
      });
    });

    describe('Settings Change Events', () => {
      it('sollte Settings-Änderungen tracken', async () => {
        const changeEvents: any[] = [];
        
        const unsubscribe = settingsBridge.onSettingsChange((event) => {
          changeEvents.push(event);
        });

        // Settings ändern
        await settingsBridge.updateSetting('audioEnabled', false);
        
        expect(changeEvents).toHaveLength(1);
        expect(changeEvents[0].type).toBe('audio');
        expect(changeEvents[0].key).toBe('audioEnabled');
        expect(changeEvents[0].oldValue).toBe(true);
        expect(changeEvents[0].newValue).toBe(false);

        unsubscribe();
      });

      it('sollte mehrere Listener unterstützen', async () => {
        const events1: any[] = [];
        const events2: any[] = [];
        
        const unsubscribe1 = settingsBridge.onSettingsChange((event) => {
          events1.push(event);
        });
        
        const unsubscribe2 = settingsBridge.onSettingsChange((event) => {
          events2.push(event);
        });

        // Settings ändern
        await settingsBridge.updateSetting('hapticEnabled', false);
        
        expect(events1).toHaveLength(1);
        expect(events2).toHaveLength(1);
        expect(events1[0]).toEqual(events2[0]);

        unsubscribe1();
        unsubscribe2();
      });

      it('sollte Listener korrekt entfernen', async () => {
        const events: any[] = [];
        
        const unsubscribe = settingsBridge.onSettingsChange((event) => {
          events.push(event);
        });

        // Erst Settings ändern
        await settingsBridge.updateSetting('defaultMethod', '478');
        expect(events).toHaveLength(1);

        // Listener entfernen
        unsubscribe();

        // Erneut Settings ändern
        await settingsBridge.updateSetting('defaultMethod', 'box');
        expect(events).toHaveLength(1); // Sollte nicht erhöht werden
      });
    });

    describe('Service Integration', () => {
      it('sollte CueSettings konvertieren', () => {
        const cueSettings = settingsBridge.getCueSettings();
        
        expect(cueSettings).toEqual({
          audioEnabled: DEFAULT_BREATH_SETTINGS.audioEnabled,
          hapticEnabled: DEFAULT_BREATH_SETTINGS.hapticEnabled,
          audioIntensity: DEFAULT_BREATH_SETTINGS.audioIntensity,
          hapticIntensity: DEFAULT_BREATH_SETTINGS.hapticIntensity
        });
      });

      it('sollte Controller-Config konvertieren', () => {
        const controllerConfig = settingsBridge.getControllerConfig();
        
        expect(controllerConfig).toEqual({
          method: DEFAULT_BREATH_SETTINGS.defaultMethod,
          cycles: DEFAULT_BREATH_SETTINGS.defaultCycles,
          customPhases: undefined, // Nicht custom
          audioEnabled: DEFAULT_BREATH_SETTINGS.audioEnabled,
          hapticEnabled: DEFAULT_BREATH_SETTINGS.hapticEnabled,
          backgroundBehavior: DEFAULT_BREATH_SETTINGS.backgroundBehavior
        });
      });

      it('sollte Custom-Phasen in Controller-Config einschließen', async () => {
        await settingsBridge.saveSettings({
          defaultMethod: 'custom',
          customPhases: {
            inhaleSec: 5,
            holdSec: 5,
            exhaleSec: 5,
            holdAfterExhaleSec: 5
          }
        });

        const controllerConfig = settingsBridge.getControllerConfig();
        
        expect(controllerConfig.method).toBe('custom');
        expect(controllerConfig.customPhases).toBeDefined();
        expect(controllerConfig.customPhases?.inhaleSec).toBe(5);
      });

      it('sollte Settings validieren und korrigieren', async () => {
        const invalidSettings: Partial<BreathSettings> = {
          audioIntensity: 'invalid' as CueIntensity,
          defaultCycles: 100
        };

        const result = await settingsBridge.validateAndCorrectSettings(invalidSettings);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.correctedSettings).toBeDefined();
        expect(result.correctedSettings?.audioIntensity).toBe('gentle');
        expect(result.correctedSettings?.defaultCycles).toBe(20);
      });
    });

    describe('Error Handling', () => {
      it('sollte Storage-Fehler behandeln', async () => {
        // Simuliere Storage-Fehler durch ungültige Settings
        const invalidSettings: Partial<BreathSettings> = {
          audioIntensity: 'invalid' as CueIntensity
        };

        const success = await settingsBridge.saveSettings(invalidSettings);
        
        expect(success).toBe(false);
      });

      it('sollte Listener-Fehler abfangen', async () => {
        const errorListener = jest.fn().mockImplementation(() => {
          throw new Error('Listener error');
        });

        settingsBridge.onSettingsChange(errorListener);

        // Settings ändern sollte nicht crashen
        const success = await settingsBridge.updateSetting('audioEnabled', false);
        
        expect(success).toBe(true);
        expect(errorListener).toHaveBeenCalled();
      });
    });
  });

  describe('BreathSettingsUtils', () => {
    describe('validate', () => {
      it('sollte Settings validieren', () => {
        const result = BreathSettingsUtils.validate({ audioEnabled: true });
        
        expect(result.isValid).toBe(true);
      });
    });

    describe('validateSingle', () => {
      it('sollte einzelne Einstellung validieren', () => {
        const result = BreathSettingsUtils.validateSingle('audioEnabled', true);
        
        expect(result.isValid).toBe(true);
      });
    });

    describe('getDefaults', () => {
      it('sollte Default-Settings zurückgeben', () => {
        const defaults = BreathSettingsUtils.getDefaults();
        
        expect(defaults).toEqual(DEFAULT_BREATH_SETTINGS);
      });
    });

    describe('getAvailableMethods', () => {
      it('sollte verfügbare Methoden zurückgeben', () => {
        const methods = BreathSettingsUtils.getAvailableMethods();
        
        expect(methods).toContain('box');
        expect(methods).toContain('478');
        expect(methods).toContain('coherent');
        expect(methods).toContain('equal');
        expect(methods).toContain('custom');
      });
    });

    describe('getMethodConfig', () => {
      it('sollte Method-Konfiguration zurückgeben', () => {
        const config = BreathSettingsUtils.getMethodConfig('box');
        
        expect(config).toEqual(BREATHING_METHODS.box);
      });
    });

    describe('getConstraints', () => {
      it('sollte Constraints zurückgeben', () => {
        const constraints = BreathSettingsUtils.getConstraints();
        
        expect(constraints).toEqual(BREATHING_CONSTRAINTS);
      });
    });

    describe('getCueIntensities', () => {
      it('sollte Cue-Intensitäten zurückgeben', () => {
        const intensities = BreathSettingsUtils.getCueIntensities();
        
        expect(intensities).toEqual(['gentle', 'distinct']);
      });
    });

    describe('getBackgroundBehaviors', () => {
      it('sollte Background-Verhalten zurückgeben', () => {
        const behaviors = BreathSettingsUtils.getBackgroundBehaviors();
        
        expect(behaviors).toEqual(['pause', 'stop', 'continue']);
      });
    });
  });

  describe('Integration Tests', () => {
    it('sollte vollständigen Settings-Workflow unterstützen', async () => {
      // 1. Settings laden
      const initialSettings = await settingsBridge.loadSettings();
      expect(initialSettings).toEqual(DEFAULT_BREATH_SETTINGS);

      // 2. Settings ändern
      const newSettings: Partial<BreathSettings> = {
        audioEnabled: false,
        hapticEnabled: true,
        audioIntensity: 'distinct',
        defaultMethod: '478',
        defaultCycles: 8,
        autoStart: true,
        backgroundBehavior: 'stop'
      };

      const success = await settingsBridge.saveSettings(newSettings);
      expect(success).toBe(true);

      // 3. Geänderte Settings prüfen
      const updatedSettings = settingsBridge.getSettings();
      expect(updatedSettings.audioEnabled).toBe(false);
      expect(updatedSettings.defaultMethod).toBe('478');
      expect(updatedSettings.defaultCycles).toBe(8);

      // 4. Service-Integration prüfen
      const cueSettings = settingsBridge.getCueSettings();
      expect(cueSettings.audioEnabled).toBe(false);
      expect(cueSettings.audioIntensity).toBe('distinct');

      const controllerConfig = settingsBridge.getControllerConfig();
      expect(controllerConfig.method).toBe('478');
      expect(controllerConfig.cycles).toBe(8);
      expect(controllerConfig.backgroundBehavior).toBe('stop');

      // 5. Zurücksetzen
      const resetSuccess = await settingsBridge.resetToDefaults();
      expect(resetSuccess).toBe(true);

      const resetSettings = settingsBridge.getSettings();
      expect(resetSettings).toEqual(DEFAULT_BREATH_SETTINGS);
    });

    it('sollte Validierung mit Korrektur unterstützen', async () => {
      // Ungültige Settings
      const invalidSettings: Partial<BreathSettings> = {
        audioIntensity: 'invalid' as CueIntensity,
        hapticIntensity: 'invalid' as CueIntensity,
        defaultMethod: 'invalid' as any,
        defaultCycles: 100,
        customPhases: {
          inhaleSec: 25,
          holdSec: 0,
          exhaleSec: 4,
          holdAfterExhaleSec: 4
        }
      };

      const result = await settingsBridge.validateAndCorrectSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.correctedSettings).toBeDefined();
      
      // Prüfe Korrekturen
      expect(result.correctedSettings?.audioIntensity).toBe('gentle');
      expect(result.correctedSettings?.hapticIntensity).toBe('gentle');
      expect(result.correctedSettings?.defaultMethod).toBe('box');
      expect(result.correctedSettings?.customPhases?.inhaleSec).toBe(20);
      expect(result.correctedSettings?.customPhases?.holdSec).toBe(1);
    });
  });
});
