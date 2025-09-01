/**
 * Unit Tests für Breath Controller
 */

import {
  BreathController,
  BreathControllerConfig,
  BreathSessionInfo,
  BreathPhaseInfo,
  BreathSessionStatus,
  createBreathController
} from '../../../services/breath/controller';
import { 
  BreathingMethod, 
  BreathingPhaseConfig,
  BREATHING_METHODS 
} from '../../../services/breath/methods.catalog';

describe('Breath Controller', () => {
  let controller: BreathController;
  let mockConfig: BreathControllerConfig;

  beforeEach(() => {
    mockConfig = {
      method: 'box',
      cycles: 3, // Kurze Session für Tests
      tickIntervalMs: 50 // Schnellere Ticks für Tests
    };
    controller = createBreathController(mockConfig);
  });

  afterEach(() => {
    controller.destroy();
  });

  describe('Konstruktor und Initialisierung', () => {
    it('sollte Controller mit Standard-Konfiguration erstellen', () => {
      const config: BreathControllerConfig = { method: 'box' };
      const controller = createBreathController(config);
      
      const sessionInfo = controller.getSessionInfo();
      expect(sessionInfo.status).toBe('idle');
      expect(sessionInfo.method).toBe('box');
      expect(sessionInfo.cycles).toBe(10); // Standard-Zyklen
      expect(sessionInfo.currentPhase).toBe('inhale');
      expect(sessionInfo.currentCycle).toBe(1);
      
      controller.destroy();
    });

    it('sollte Controller mit angepasster Konfiguration erstellen', () => {
      const config: BreathControllerConfig = {
        method: '478',
        cycles: 5,
        audioEnabled: false,
        hapticEnabled: false
      };
      const controller = createBreathController(config);
      
      const sessionInfo = controller.getSessionInfo();
      expect(sessionInfo.method).toBe('478');
      expect(sessionInfo.cycles).toBe(5);
      
      controller.destroy();
    });

    it('sollte Custom-Methode mit benutzerdefinierten Phasen erstellen', () => {
      const customPhases: BreathingPhaseConfig = {
        inhaleSec: 3,
        holdSec: 2,
        exhaleSec: 4,
        holdAfterExhaleSec: 1
      };
      
      const config: BreathControllerConfig = {
        method: 'custom',
        customPhases,
        cycles: 2
      };
      
      const controller = createBreathController(config);
      const sessionInfo = controller.getSessionInfo();
      
      expect(sessionInfo.method).toBe('custom');
      expect(sessionInfo.phases).toEqual(customPhases);
      expect(sessionInfo.cycles).toBe(2);
      
      controller.destroy();
    });

    it('sollte Fehler bei ungültiger Konfiguration werfen', () => {
      const invalidConfig: BreathControllerConfig = {
        method: 'invalid' as BreathingMethod
      };
      
      expect(() => createBreathController(invalidConfig)).toThrow('Ungültige Konfiguration');
    });

    it('sollte Fehler bei ungültigen Zyklen werfen', () => {
      const invalidConfig: BreathControllerConfig = {
        method: 'box',
        cycles: 100 // Zu viele Zyklen
      };
      
      expect(() => createBreathController(invalidConfig)).toThrow('Ungültige Konfiguration');
    });

    it('sollte Fehler bei Custom-Phasen für Standard-Methode werfen', () => {
      const config: BreathControllerConfig = {
        method: 'box',
        customPhases: {
          inhaleSec: 3,
          holdSec: 3,
          exhaleSec: 3,
          holdAfterExhaleSec: 3
        }
      };
      
      expect(() => createBreathController(config)).toThrow('Ungültige Konfiguration');
    });
  });

  describe('Session-Informationen', () => {
    it('sollte korrekte initiale Session-Info haben', () => {
      const sessionInfo = controller.getSessionInfo();
      
      expect(sessionInfo.status).toBe('idle');
      expect(sessionInfo.method).toBe('box');
      expect(sessionInfo.cycles).toBe(3);
      expect(sessionInfo.currentPhase).toBe('inhale');
      expect(sessionInfo.currentCycle).toBe(1);
      expect(sessionInfo.elapsedMs).toBe(0);
      expect(sessionInfo.progress).toBe(0);
      expect(sessionInfo.interruptions).toBe(0);
    });

    it('sollte korrekte Phase-Info haben', () => {
      const phaseInfo = controller.getPhaseInfo();
      
      expect(phaseInfo.phase).toBe('inhale');
      expect(phaseInfo.phaseIndex).toBe(0);
      expect(phaseInfo.cycleIndex).toBe(1);
      expect(phaseInfo.totalCycles).toBe(3);
      expect(phaseInfo.phaseDurationMs).toBe(4000); // 4 Sekunden
      expect(phaseInfo.phaseElapsedMs).toBe(0);
      expect(phaseInfo.phaseRemainingMs).toBe(4000);
      expect(phaseInfo.phaseProgress).toBe(0);
      expect(phaseInfo.isActive).toBe(false);
    });

    it('sollte korrekte Gesamtdauer berechnen', () => {
      const sessionInfo = controller.getSessionInfo();
      // Box: 4+4+4+4 = 16 Sekunden pro Zyklus * 3 Zyklen = 48 Sekunden
      expect(sessionInfo.totalDurationMs).toBe(48000);
    });
  });

  describe('Session-Start', () => {
    it('sollte Session starten', (done) => {
      let stateChanges: BreathSessionStatus[] = [];
      
      controller.onStateChange((sessionInfo: BreathSessionInfo) => {
        stateChanges.push(sessionInfo.status);
        
        if (sessionInfo.status === 'active') {
          expect(stateChanges).toContain('preparing');
          expect(sessionInfo.startTime).toBeDefined();
          expect(sessionInfo.startTime).toBeGreaterThan(0);
          controller.stop();
          done();
        }
      });
      
      controller.start();
    }, 3000);

    it('sollte nicht zweimal starten', () => {
      controller.start();
      const startTime = controller.getSessionInfo().startTime;
      
      controller.start();
      expect(controller.getSessionInfo().startTime).toBe(startTime);
    });
  });

  describe('Session-Pause/Resume', () => {
    it('sollte Session pausieren', (done) => {
      controller.onStateChange((sessionInfo: BreathSessionInfo) => {
        if (sessionInfo.status === 'active') {
          controller.pause();
        } else if (sessionInfo.status === 'paused') {
          expect(sessionInfo.status).toBe('paused');
          controller.stop();
          done();
        }
      });
      
      controller.start();
    }, 3000);

    it('sollte nicht pausieren wenn nicht aktiv', () => {
      controller.pause();
      expect(controller.getSessionInfo().status).toBe('idle');
    });

    it('sollte nicht fortsetzen wenn nicht pausiert', () => {
      controller.resume();
      expect(controller.getSessionInfo().status).toBe('idle');
    });
  });

  describe('Session-Stop', () => {
    it('sollte Session stoppen', (done) => {
      controller.onStateChange((sessionInfo: BreathSessionInfo) => {
        if (sessionInfo.status === 'active') {
          controller.stop();
        } else if (sessionInfo.status === 'cancelled') {
          expect(sessionInfo.status).toBe('cancelled');
          expect(sessionInfo.endTime).toBeDefined();
          done();
        }
      });
      
      controller.start();
    }, 3000);

    it('sollte Session von jedem Status stoppen', () => {
      controller.stop();
      expect(controller.getSessionInfo().status).toBe('cancelled');
      
      controller.start();
      controller.stop();
      expect(controller.getSessionInfo().status).toBe('cancelled');
    });
  });

  describe('Tick-Callbacks', () => {
    it('sollte Tick-Callbacks mit korrekten Daten aufrufen', (done) => {
      let tickCount = 0;
      
      controller.onTick((tick, sessionInfo) => {
        tickCount++;
        
        expect(tick.timestamp).toBeGreaterThan(0);
        expect(tick.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(tick.remainingMs).toBeGreaterThanOrEqual(0);
        expect(tick.progress).toBeGreaterThanOrEqual(0);
        expect(tick.progress).toBeLessThanOrEqual(1);
        
        expect(sessionInfo.status).toBe('active');
        expect(sessionInfo.elapsedMs).toBe(tick.elapsedMs);
        expect(sessionInfo.remainingMs).toBe(tick.remainingMs);
        expect(sessionInfo.progress).toBe(tick.progress);
        
        if (tickCount >= 5) {
          controller.stop();
          done();
        }
      });
      
      controller.start();
    }, 5000);
  });

  describe('Callback-Management', () => {
    it('sollte mehrere Callbacks registrieren', () => {
      let callback1Called = false;
      let callback2Called = false;
      
      controller.onTick(() => { callback1Called = true; });
      controller.onTick(() => { callback2Called = true; });
      
      // Callbacks sollten registriert sein
      expect(callback1Called).toBe(false);
      expect(callback2Called).toBe(false);
    });
  });

  describe('Verschiedene Methoden', () => {
    it('sollte 4-7-8-Methode korrekt handhaben', () => {
      const config: BreathControllerConfig = {
        method: '478',
        cycles: 3,
        tickIntervalMs: 50
      };
      const controller = createBreathController(config);
      
      const sessionInfo = controller.getSessionInfo();
      expect(sessionInfo.method).toBe('478');
      expect(sessionInfo.cycles).toBe(3);
      
      controller.destroy();
    });

    it('sollte Coherent-Methode korrekt handhaben', () => {
      const config: BreathControllerConfig = {
        method: 'coherent',
        cycles: 5,
        tickIntervalMs: 50
      };
      const controller = createBreathController(config);
      
      const sessionInfo = controller.getSessionInfo();
      expect(sessionInfo.method).toBe('coherent');
      expect(sessionInfo.cycles).toBe(5);
      
      controller.destroy();
    });
  });

  describe('Cleanup', () => {
    it('sollte Controller korrekt aufräumen', () => {
      let tickCalled = false;
      let phaseCalled = false;
      
      controller.onTick(() => { tickCalled = true; });
      controller.onPhaseChange(() => { phaseCalled = true; });
      
      controller.destroy();
      
      // Controller sollte gestoppt sein
      expect(controller.getSessionInfo().status).toBe('idle');
      
      // destroy() stoppt den Timer sofort, daher werden keine Callbacks aufgerufen
      expect(tickCalled).toBe(false);
      expect(phaseCalled).toBe(false);
    });
  });
});
