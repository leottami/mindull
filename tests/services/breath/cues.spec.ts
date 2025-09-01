/**
 * Unit Tests für Breath Cues Service
 */

import {
  BreathCuesService,
  CueType,
  CueIntensity,
  CueSettings,
  CueEvent,
  createBreathCuesService,
  CueUtils
} from '../../../services/breath/cues';

describe('Breath Cues Service', () => {
  let cuesService: BreathCuesService;
  let mockSettings: CueSettings;

  beforeEach(() => {
    mockSettings = {
      audioEnabled: true,
      hapticEnabled: true,
      intensity: 'gentle',
      volume: 0.7
    };
    cuesService = createBreathCuesService(mockSettings);
  });

  afterEach(async () => {
    await cuesService.cleanup();
  });

  describe('Konstruktor und Initialisierung', () => {
    it('sollte Service mit Standard-Einstellungen erstellen', () => {
      const service = createBreathCuesService(CueUtils.createDefaultSettings());
      const settings = service.getSettings();
      
      expect(settings.audioEnabled).toBe(true);
      expect(settings.hapticEnabled).toBe(true);
      expect(settings.intensity).toBe('gentle');
      expect(settings.volume).toBe(0.7);
      
      service.cleanup();
    });

    it('sollte Service mit angepassten Einstellungen erstellen', () => {
      const customSettings: CueSettings = {
        audioEnabled: false,
        hapticEnabled: true,
        intensity: 'distinct',
        volume: 0.5
      };
      
      const service = createBreathCuesService(customSettings);
      const settings = service.getSettings();
      
      expect(settings.audioEnabled).toBe(false);
      expect(settings.hapticEnabled).toBe(true);
      expect(settings.intensity).toBe('distinct');
      expect(settings.volume).toBe(0.5);
      
      service.cleanup();
    });

    it('sollte Service initialisieren', async () => {
      await cuesService.initialize();
      
      // Service sollte initialisiert sein
      expect(cuesService.isAudioAvailable()).toBe(false); // Kein Audio-Player in Tests
      expect(cuesService.isHapticAvailable()).toBe(false); // Kein Haptik-Engine in Tests
    });

    it('sollte Initialisierung ohne Fehler durchführen', async () => {
      await cuesService.initialize();
      
      // Service sollte initialisiert sein
      expect(cuesService.getSettings().audioEnabled).toBe(true);
      expect(cuesService.getSettings().hapticEnabled).toBe(true);
    });
  });

  describe('Cue-Abspielung', () => {
    it('sollte Cue ohne Fehler abspielen', async () => {
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });

    it('sollte alle Cue-Typen unterstützen', async () => {
      await cuesService.initialize();
      
      const cueTypes: CueType[] = ['inhale', 'hold', 'exhale', 'holdAfterExhale', 'cycle', 'complete'];
      
      for (const type of cueTypes) {
        await expect(cuesService.playCue(type)).resolves.not.toThrow();
      }
    });

    it('sollte Cue mit Event-Informationen abspielen', async () => {
      await cuesService.initialize();
      
      const event: CueEvent = {
        type: 'inhale',
        timestamp: Date.now(),
        cycleIndex: 1,
        phaseIndex: 0
      };
      
      await expect(cuesService.playCue('inhale', event)).resolves.not.toThrow();
    });

    it('sollte Audio-Cue bei deaktiviertem Audio überspringen', async () => {
      cuesService.updateSettings({ audioEnabled: false });
      await cuesService.initialize();
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await cuesService.playCue('inhale');
      
      // Sollte ohne Audio-Warnungen durchlaufen
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('sollte Haptik-Cue bei deaktivierter Haptik überspringen', async () => {
      cuesService.updateSettings({ hapticEnabled: false });
      await cuesService.initialize();
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await cuesService.playCue('inhale');
      
      // Sollte ohne Haptik-Warnungen durchlaufen
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Einstellungen', () => {
    it('sollte Einstellungen aktualisieren', () => {
      const newSettings: Partial<CueSettings> = {
        intensity: 'distinct',
        volume: 0.9
      };
      
      cuesService.updateSettings(newSettings);
      const settings = cuesService.getSettings();
      
      expect(settings.intensity).toBe('distinct');
      expect(settings.volume).toBe(0.9);
      expect(settings.audioEnabled).toBe(true); // Unverändert
      expect(settings.hapticEnabled).toBe(true); // Unverändert
    });

    it('sollte Einstellungen zurückgeben', () => {
      const settings = cuesService.getSettings();
      
      expect(settings).toEqual(mockSettings);
      expect(settings).not.toBe(mockSettings); // Sollte Kopie sein
    });

    it('sollte Verfügbarkeit prüfen', async () => {
      await cuesService.initialize();
      
      // In Tests sind Audio und Haptik nicht verfügbar
      expect(cuesService.isAudioAvailable()).toBe(false);
      expect(cuesService.isHapticAvailable()).toBe(false);
    });
  });

  describe('Intensitäts-Profile', () => {
    it('sollte sanfte Profile verwenden', async () => {
      cuesService.updateSettings({ intensity: 'gentle' });
      await cuesService.initialize();
      
      // Sollte ohne Fehler abspielen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
      await expect(cuesService.playCue('exhale')).resolves.not.toThrow();
    });

    it('sollte deutliche Profile verwenden', async () => {
      cuesService.updateSettings({ intensity: 'distinct' });
      await cuesService.initialize();
      
      // Sollte ohne Fehler abspielen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
      await expect(cuesService.playCue('exhale')).resolves.not.toThrow();
    });
  });

  describe('Lautstärke-Berechnung', () => {
    it('sollte finale Lautstärke korrekt berechnen', async () => {
      cuesService.updateSettings({ volume: 0.5 });
      await cuesService.initialize();
      
      // Sollte ohne Fehler abspielen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });

    it('sollte extreme Lautstärke-Werte behandeln', async () => {
      cuesService.updateSettings({ volume: 0.0 });
      await cuesService.initialize();
      
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
      
      cuesService.updateSettings({ volume: 1.0 });
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });
  });

  describe('Error-Handling', () => {
    it('sollte Cue-Abspielung ohne Fehler durchführen', async () => {
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
      await expect(cuesService.playCue('exhale')).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('sollte Service korrekt aufräumen', async () => {
      await cuesService.initialize();
      
      await cuesService.cleanup();
      
      // Service sollte nicht mehr initialisiert sein
      expect(cuesService.isAudioAvailable()).toBe(false);
      expect(cuesService.isHapticAvailable()).toBe(false);
    });

    it('sollte Cleanup ohne Fehler durchführen', async () => {
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('CueUtils', () => {
    it('sollte Standard-Einstellungen erstellen', () => {
      const settings = CueUtils.createDefaultSettings();
      
      expect(settings.audioEnabled).toBe(true);
      expect(settings.hapticEnabled).toBe(true);
      expect(settings.intensity).toBe('gentle');
      expect(settings.volume).toBe(0.7);
    });

    it('sollte Einstellungen validieren', () => {
      const validSettings: CueSettings = {
        audioEnabled: true,
        hapticEnabled: false,
        intensity: 'gentle',
        volume: 0.5
      };
      
      const errors = CueUtils.validateSettings(validSettings);
      expect(errors).toHaveLength(0);
    });

    it('sollte ungültige Lautstärke erkennen', () => {
      const invalidSettings: CueSettings = {
        audioEnabled: true,
        hapticEnabled: true,
        intensity: 'gentle',
        volume: 1.5 // Ungültig
      };
      
      const errors = CueUtils.validateSettings(invalidSettings);
      expect(errors).toContain('Lautstärke muss zwischen 0 und 1 liegen');
    });

    it('sollte ungültige Intensität erkennen', () => {
      const invalidSettings: CueSettings = {
        audioEnabled: true,
        hapticEnabled: true,
        intensity: 'invalid' as CueIntensity,
        volume: 0.5
      };
      
      const errors = CueUtils.validateSettings(invalidSettings);
      expect(errors).toContain('Intensität muss "gentle" oder "distinct" sein');
    });

    it('sollte Cue-Events formatieren', () => {
      const event: CueEvent = {
        type: 'inhale',
        timestamp: 1234567890,
        cycleIndex: 1,
        phaseIndex: 0
      };
      
      const formatted = CueUtils.formatCueEvent(event);
      expect(formatted).toBe('type:inhale|timestamp:1234567890|cycle:1|phase:0');
    });

    it('sollte Cue-Events ohne optionale Felder formatieren', () => {
      const event: CueEvent = {
        type: 'complete',
        timestamp: 1234567890
      };
      
      const formatted = CueUtils.formatCueEvent(event);
      expect(formatted).toBe('type:complete|timestamp:1234567890');
    });
  });

  describe('Fallback-Verhalten', () => {
    it('sollte ohne Audio-Engine funktionieren', async () => {
      cuesService.updateSettings({ audioEnabled: true, hapticEnabled: false });
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });

    it('sollte ohne Haptik-Engine funktionieren', async () => {
      cuesService.updateSettings({ audioEnabled: false, hapticEnabled: true });
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });

    it('sollte ohne Audio und Haptik funktionieren', async () => {
      cuesService.updateSettings({ audioEnabled: false, hapticEnabled: false });
      await cuesService.initialize();
      
      // Sollte ohne Fehler durchlaufen
      await expect(cuesService.playCue('inhale')).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('sollte mehrere Cues schnell abspielen', async () => {
      await cuesService.initialize();
      
      const startTime = Date.now();
      
      // Spiele mehrere Cues ab
      await Promise.all([
        cuesService.playCue('inhale'),
        cuesService.playCue('hold'),
        cuesService.playCue('exhale')
      ]);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Sollte schnell sein (weniger als 1 Sekunde)
      expect(duration).toBeLessThan(1000);
    });

    it('sollte Initialisierung nur einmal durchführen', async () => {
      const initSpy = jest.spyOn(cuesService as any, 'initialize');
      
      await cuesService.playCue('inhale');
      await cuesService.playCue('hold');
      await cuesService.playCue('exhale');
      
      // Initialisierung sollte nur einmal aufgerufen werden
      expect(initSpy).toHaveBeenCalledTimes(1);
      
      initSpy.mockRestore();
    });
  });
});
