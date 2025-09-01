/**
 * Unit Tests für Atem-Methoden-Katalog
 */

import {
  BreathingMethod,
  BreathingPhase,
  BreathingPhaseConfig,
  BreathingMethodConfig,
  CustomBreathingConfig,
  BREATHING_CONSTRAINTS,
  BREATHING_METHODS,
  BreathingMethodValidator,
  calculateSessionDuration,
  calculateMethodDuration,
  createCustomConfig,
  getMethodsByCategory,
  getMethodsByDifficulty,
  QUICK_START_METHODS,
  BEGINNER_METHODS,
  ADVANCED_METHODS
} from '../../../services/breath/methods.catalog';

describe('Breathing Methods Catalog', () => {
  describe('BREATHING_CONSTRAINTS', () => {
    it('sollte gültige Phase-Grenzen definieren', () => {
      expect(BREATHING_CONSTRAINTS.phase.min).toBe(1);
      expect(BREATHING_CONSTRAINTS.phase.max).toBe(20);
      expect(BREATHING_CONSTRAINTS.phase.default).toBe(4);
    });

    it('sollte gültige Zyklen-Grenzen definieren', () => {
      expect(BREATHING_CONSTRAINTS.cycles.min).toBe(1);
      expect(BREATHING_CONSTRAINTS.cycles.max).toBe(50);
      expect(BREATHING_CONSTRAINTS.cycles.default).toBe(10);
    });

    it('sollte gültige Session-Grenzen definieren', () => {
      expect(BREATHING_CONSTRAINTS.session.min).toBe(30);
      expect(BREATHING_CONSTRAINTS.session.max).toBe(3600);
      expect(BREATHING_CONSTRAINTS.session.default).toBe(300);
    });
  });

  describe('BREATHING_METHODS', () => {
    it('sollte alle erwarteten Methoden enthalten', () => {
      const expectedMethods: BreathingMethod[] = ['box', '478', 'coherent', 'equal', 'custom'];
      const actualMethods = Object.keys(BREATHING_METHODS);
      expect(actualMethods.sort()).toEqual(expectedMethods.sort());
    });

    it('sollte gültige Box-Breathing-Konfiguration haben', () => {
      const box = BREATHING_METHODS.box;
      expect(box.id).toBe('box');
      expect(box.nameKey).toBe('breath.methods.box.name');
      expect(box.descriptionKey).toBe('breath.methods.box.description');
      expect(box.phases.inhaleSec).toBe(4);
      expect(box.phases.holdSec).toBe(4);
      expect(box.phases.exhaleSec).toBe(4);
      expect(box.phases.holdAfterExhaleSec).toBe(4);
      expect(box.defaultCycles).toBe(10);
      expect(box.category).toBe('relaxation');
      expect(box.difficulty).toBe('beginner');
    });

    it('sollte gültige 4-7-8-Konfiguration haben', () => {
      const method478 = BREATHING_METHODS['478'];
      expect(method478.id).toBe('478');
      expect(method478.phases.inhaleSec).toBe(4);
      expect(method478.phases.holdSec).toBe(7);
      expect(method478.phases.exhaleSec).toBe(8);
      expect(method478.phases.holdAfterExhaleSec).toBe(0);
      expect(method478.category).toBe('sleep');
      expect(method478.difficulty).toBe('intermediate');
    });

    it('sollte gültige Coherent-Breathing-Konfiguration haben', () => {
      const coherent = BREATHING_METHODS.coherent;
      expect(coherent.id).toBe('coherent');
      expect(coherent.phases.inhaleSec).toBe(5);
      expect(coherent.phases.holdSec).toBe(0);
      expect(coherent.phases.exhaleSec).toBe(5);
      expect(coherent.phases.holdAfterExhaleSec).toBe(0);
      expect(coherent.category).toBe('focus');
      expect(coherent.difficulty).toBe('beginner');
    });

    it('sollte gültige Equal-Breathing-Konfiguration haben', () => {
      const equal = BREATHING_METHODS.equal;
      expect(equal.id).toBe('equal');
      expect(equal.phases.inhaleSec).toBe(5);
      expect(equal.phases.holdSec).toBe(0);
      expect(equal.phases.exhaleSec).toBe(5);
      expect(equal.phases.holdAfterExhaleSec).toBe(0);
      expect(equal.category).toBe('focus');
      expect(equal.difficulty).toBe('beginner');
    });

    it('sollte gültige Custom-Konfiguration haben', () => {
      const custom = BREATHING_METHODS.custom;
      expect(custom.id).toBe('custom');
      expect(custom.category).toBe('custom');
      expect(custom.difficulty).toBe('advanced');
      expect(custom.minCycles).toBe(1);
      expect(custom.maxCycles).toBe(50);
    });

    it('sollte i18n-Schlüssel für alle Methoden haben', () => {
      Object.values(BREATHING_METHODS).forEach(method => {
        expect(method.nameKey).toMatch(/^breath\.methods\.[a-z0-9]+\.name$/);
        expect(method.descriptionKey).toMatch(/^breath\.methods\.[a-z0-9]+\.description$/);
      });
    });

    it('sollte gültige Zyklus-Grenzen für alle Methoden haben', () => {
      Object.values(BREATHING_METHODS).forEach(method => {
        expect(method.minCycles).toBeGreaterThan(0);
        expect(method.maxCycles).toBeGreaterThan(method.minCycles);
        expect(method.defaultCycles).toBeGreaterThanOrEqual(method.minCycles);
        expect(method.defaultCycles).toBeLessThanOrEqual(method.maxCycles);
      });
    });
  });

  describe('BreathingMethodValidator', () => {
    describe('isValidMethod', () => {
      it('sollte gültige Methoden akzeptieren', () => {
        expect(BreathingMethodValidator.isValidMethod('box')).toBe(true);
        expect(BreathingMethodValidator.isValidMethod('478')).toBe(true);
        expect(BreathingMethodValidator.isValidMethod('coherent')).toBe(true);
        expect(BreathingMethodValidator.isValidMethod('equal')).toBe(true);
        expect(BreathingMethodValidator.isValidMethod('custom')).toBe(true);
      });

      it('sollte ungültige Methoden ablehnen', () => {
        expect(BreathingMethodValidator.isValidMethod('invalid')).toBe(false);
        expect(BreathingMethodValidator.isValidMethod('')).toBe(false);
        expect(BreathingMethodValidator.isValidMethod('triangle')).toBe(false);
      });
    });

    describe('isValidPhaseDuration', () => {
      it('sollte gültige Phase-Dauern akzeptieren', () => {
        expect(BreathingMethodValidator.isValidPhaseDuration(1)).toBe(true);
        expect(BreathingMethodValidator.isValidPhaseDuration(10)).toBe(true);
        expect(BreathingMethodValidator.isValidPhaseDuration(20)).toBe(true);
      });

      it('sollte ungültige Phase-Dauern ablehnen', () => {
        expect(BreathingMethodValidator.isValidPhaseDuration(0)).toBe(false);
        expect(BreathingMethodValidator.isValidPhaseDuration(21)).toBe(false);
        expect(BreathingMethodValidator.isValidPhaseDuration(-1)).toBe(false);
        expect(BreathingMethodValidator.isValidPhaseDuration(1.5)).toBe(false);
      });
    });

    describe('isValidCycles', () => {
      it('sollte gültige Zyklen für Box-Breathing akzeptieren', () => {
        expect(BreathingMethodValidator.isValidCycles(3, 'box')).toBe(true);
        expect(BreathingMethodValidator.isValidCycles(10, 'box')).toBe(true);
        expect(BreathingMethodValidator.isValidCycles(20, 'box')).toBe(true);
      });

      it('sollte ungültige Zyklen für Box-Breathing ablehnen', () => {
        expect(BreathingMethodValidator.isValidCycles(2, 'box')).toBe(false);
        expect(BreathingMethodValidator.isValidCycles(21, 'box')).toBe(false);
        expect(BreathingMethodValidator.isValidCycles(0, 'box')).toBe(false);
      });

      it('sollte gültige Zyklen für Custom akzeptieren', () => {
        expect(BreathingMethodValidator.isValidCycles(1, 'custom')).toBe(true);
        expect(BreathingMethodValidator.isValidCycles(25, 'custom')).toBe(true);
        expect(BreathingMethodValidator.isValidCycles(50, 'custom')).toBe(true);
      });
    });

    describe('validateCustomConfig', () => {
      it('sollte gültige Custom-Konfiguration akzeptieren', () => {
        const validConfig: CustomBreathingConfig = {
          phases: {
            inhaleSec: 4,
            holdSec: 4,
            exhaleSec: 4,
            holdAfterExhaleSec: 4
          },
          cycles: 10
        };
        const errors = BreathingMethodValidator.validateCustomConfig(validConfig);
        expect(errors).toHaveLength(0);
      });

      it('sollte ungültige Phase-Dauern ablehnen', () => {
        const invalidConfig: CustomBreathingConfig = {
          phases: {
            inhaleSec: 0, // Zu kurz
            holdSec: 4,
            exhaleSec: 25, // Zu lang
            holdAfterExhaleSec: 4
          },
          cycles: 10
        };
        const errors = BreathingMethodValidator.validateCustomConfig(invalidConfig);
        expect(errors).toContain('Einatmung muss zwischen 1-20 Sekunden liegen');
        expect(errors).toContain('Ausatmung muss zwischen 1-20 Sekunden liegen');
      });

      it('sollte ungültige Zyklen ablehnen', () => {
        const invalidConfig: CustomBreathingConfig = {
          phases: {
            inhaleSec: 4,
            holdSec: 4,
            exhaleSec: 4,
            holdAfterExhaleSec: 4
          },
          cycles: 0 // Zu wenig
        };
        const errors = BreathingMethodValidator.validateCustomConfig(invalidConfig);
        expect(errors).toContain('Zyklen müssen zwischen 1-50 liegen');
      });

      it('sollte zu kurze Session-Dauer ablehnen', () => {
        const invalidConfig: CustomBreathingConfig = {
          phases: {
            inhaleSec: 1,
            holdSec: 1,
            exhaleSec: 1,
            holdAfterExhaleSec: 1
          },
          cycles: 5 // 4 Sekunden * 5 Zyklen = 20 Sekunden (zu kurz)
        };
        const errors = BreathingMethodValidator.validateCustomConfig(invalidConfig);
        expect(errors).toContain('Session muss mindestens 30 Sekunden dauern');
      });

      it('sollte zu lange Session-Dauer ablehnen', () => {
        const invalidConfig: CustomBreathingConfig = {
          phases: {
            inhaleSec: 10,
            holdSec: 10,
            exhaleSec: 10,
            holdAfterExhaleSec: 10
          },
          cycles: 100 // 40 Sekunden * 100 Zyklen = 4000 Sekunden (zu lang)
        };
        const errors = BreathingMethodValidator.validateCustomConfig(invalidConfig);
        expect(errors).toContain('Session darf maximal 3600 Sekunden dauern');
      });
    });

    describe('validateMethodConfig', () => {
      it('sollte gültige Methoden-Konfiguration akzeptieren', () => {
        const errors = BreathingMethodValidator.validateMethodConfig('box', 10);
        expect(errors).toHaveLength(0);
      });

      it('sollte ungültige Methode ablehnen', () => {
        const errors = BreathingMethodValidator.validateMethodConfig('invalid' as BreathingMethod);
        expect(errors).toContain('Ungültige Atem-Methode');
      });

      it('sollte ungültige Zyklen ablehnen', () => {
        const errors = BreathingMethodValidator.validateMethodConfig('box', 25);
        expect(errors).toContain('Zyklen müssen zwischen 3-20 liegen');
      });
    });
  });

  describe('calculateSessionDuration', () => {
    it('sollte korrekte Session-Dauer berechnen', () => {
      const phases: BreathingPhaseConfig = {
        inhaleSec: 4,
        holdSec: 4,
        exhaleSec: 4,
        holdAfterExhaleSec: 4
      };
      const duration = calculateSessionDuration(phases, 10);
      expect(duration).toBe(160); // 16 Sekunden * 10 Zyklen
    });

    it('sollte korrekte Dauer ohne Halte-Phasen berechnen', () => {
      const phases: BreathingPhaseConfig = {
        inhaleSec: 5,
        holdSec: 0,
        exhaleSec: 5,
        holdAfterExhaleSec: 0
      };
      const duration = calculateSessionDuration(phases, 12);
      expect(duration).toBe(120); // 10 Sekunden * 12 Zyklen
    });

    it('sollte korrekte Dauer für 4-7-8 berechnen', () => {
      const phases: BreathingPhaseConfig = {
        inhaleSec: 4,
        holdSec: 7,
        exhaleSec: 8,
        holdAfterExhaleSec: 0
      };
      const duration = calculateSessionDuration(phases, 8);
      expect(duration).toBe(152); // 19 Sekunden * 8 Zyklen
    });
  });

  describe('calculateMethodDuration', () => {
    it('sollte Standard-Dauer für Box-Breathing berechnen', () => {
      const duration = calculateMethodDuration('box');
      expect(duration).toBe(160); // 16 Sekunden * 10 Zyklen
    });

    it('sollte angepasste Dauer für Box-Breathing berechnen', () => {
      const duration = calculateMethodDuration('box', 5);
      expect(duration).toBe(80); // 16 Sekunden * 5 Zyklen
    });

    it('sollte Standard-Dauer für 4-7-8 berechnen', () => {
      const duration = calculateMethodDuration('478');
      expect(duration).toBe(152); // 19 Sekunden * 8 Zyklen
    });
  });

  describe('createCustomConfig', () => {
    it('sollte Standard-Konfiguration erstellen', () => {
      const config = createCustomConfig();
      expect(config.phases.inhaleSec).toBe(4);
      expect(config.phases.holdSec).toBe(4);
      expect(config.phases.exhaleSec).toBe(4);
      expect(config.phases.holdAfterExhaleSec).toBe(4);
      expect(config.cycles).toBe(10);
    });

    it('sollte angepasste Konfiguration erstellen', () => {
      const config = createCustomConfig(
        { inhaleSec: 6, exhaleSec: 8 },
        15
      );
      expect(config.phases.inhaleSec).toBe(6);
      expect(config.phases.holdSec).toBe(4); // Standard
      expect(config.phases.exhaleSec).toBe(8);
      expect(config.phases.holdAfterExhaleSec).toBe(4); // Standard
      expect(config.cycles).toBe(15);
    });
  });

  describe('getMethodsByCategory', () => {
    it('sollte Methoden nach Kategorie gruppieren', () => {
      const grouped = getMethodsByCategory();
      
      expect(grouped.relaxation).toContain('box');
      expect(grouped.sleep).toContain('478');
      expect(grouped.focus).toContain('coherent');
      expect(grouped.focus).toContain('equal');
      expect(grouped.custom).toContain('custom');
    });

    it('sollte alle Methoden in Kategorien enthalten', () => {
      const grouped = getMethodsByCategory();
      const allMethods = Object.values(grouped).flat();
      expect(allMethods).toHaveLength(5);
      expect(allMethods).toContain('box');
      expect(allMethods).toContain('478');
      expect(allMethods).toContain('coherent');
      expect(allMethods).toContain('equal');
      expect(allMethods).toContain('custom');
    });
  });

  describe('getMethodsByDifficulty', () => {
    it('sollte Anfänger-Methoden filtern', () => {
      const beginner = getMethodsByDifficulty('beginner');
      expect(beginner).toContain('box');
      expect(beginner).toContain('coherent');
      expect(beginner).toContain('equal');
      expect(beginner).not.toContain('478');
      expect(beginner).not.toContain('custom');
    });

    it('sollte Fortgeschrittene-Methoden filtern', () => {
      const advanced = getMethodsByDifficulty('advanced');
      expect(advanced).toContain('custom');
      expect(advanced).not.toContain('box');
      expect(advanced).not.toContain('coherent');
    });

    it('sollte Intermediate-Methoden filtern', () => {
      const intermediate = getMethodsByDifficulty('intermediate');
      expect(intermediate).toContain('478');
      expect(intermediate).not.toContain('box');
      expect(intermediate).not.toContain('custom');
    });
  });

  describe('Konstanten', () => {
    it('sollte Quick-Start-Methoden definieren', () => {
      expect(QUICK_START_METHODS).toContain('box');
      expect(QUICK_START_METHODS).toContain('coherent');
      expect(QUICK_START_METHODS).toContain('equal');
      expect(QUICK_START_METHODS).toHaveLength(3);
    });

    it('sollte Anfänger-Methoden definieren', () => {
      expect(BEGINNER_METHODS).toContain('box');
      expect(BEGINNER_METHODS).toContain('coherent');
      expect(BEGINNER_METHODS).toContain('equal');
      expect(BEGINNER_METHODS).toHaveLength(3);
    });

    it('sollte Fortgeschrittene-Methoden definieren', () => {
      expect(ADVANCED_METHODS).toContain('custom');
      expect(ADVANCED_METHODS).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit minimalen Werten funktionieren', () => {
      const config = createCustomConfig({
        inhaleSec: 1,
        holdSec: 0,
        exhaleSec: 1,
        holdAfterExhaleSec: 0
      }, 1);
      const duration = calculateSessionDuration(config.phases, config.cycles);
      expect(duration).toBe(2); // 2 Sekunden * 1 Zyklus
    });

    it('sollte mit maximalen Werten funktionieren', () => {
      const config = createCustomConfig({
        inhaleSec: 20,
        holdSec: 20,
        exhaleSec: 20,
        holdAfterExhaleSec: 20
      }, 45); // 80 Sekunden * 45 Zyklen = 3600 Sekunden (Maximum)
      const duration = calculateSessionDuration(config.phases, config.cycles);
      expect(duration).toBe(3600);
    });

    it('sollte Validierung mit maximalen Werten bestehen', () => {
      const config = createCustomConfig({
        inhaleSec: 20,
        holdSec: 20,
        exhaleSec: 20,
        holdAfterExhaleSec: 20
      }, 45);
      const errors = BreathingMethodValidator.validateCustomConfig(config);
      expect(errors).toHaveLength(0);
    });
  });
});
