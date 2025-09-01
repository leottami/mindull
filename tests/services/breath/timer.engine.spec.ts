/**
 * Unit Tests für Timer Engine
 */

import {
  TimerEngine,
  TimerConfig,
  TimerTick,
  TimerState,
  TimerStatus,
  createTimerEngine,
  TimerUtils
} from '../../../services/breath/timer.engine';

describe('Timer Engine', () => {
  let timer: TimerEngine;
  let mockConfig: TimerConfig;

  beforeEach(() => {
    mockConfig = {
      durationMs: 5000, // 5 Sekunden
      tickIntervalMs: 100,
      backgroundBehavior: 'pause'
    };
    timer = createTimerEngine(mockConfig);
  });

  afterEach(() => {
    timer.destroy();
  });

  describe('Konstruktor und Initialisierung', () => {
    it('sollte Timer mit Standard-Konfiguration erstellen', () => {
      const config: TimerConfig = { durationMs: 3000 };
      const timer = createTimerEngine(config);
      
      expect(timer.getState().status).toBe('idle');
      expect(timer.getState().remainingMs).toBe(3000);
      expect(timer.getState().progress).toBe(0);
      
      timer.destroy();
    });

    it('sollte Timer mit vollständiger Konfiguration erstellen', () => {
      const config: TimerConfig = {
        durationMs: 10000,
        tickIntervalMs: 50,
        backgroundBehavior: 'stop'
      };
      const timer = createTimerEngine(config);
      
      expect(timer.getConfig().durationMs).toBe(10000);
      expect(timer.getConfig().tickIntervalMs).toBe(50);
      expect(timer.getConfig().backgroundBehavior).toBe('stop');
      
      timer.destroy();
    });
  });

  describe('Timer-Status und State', () => {
    it('sollte korrekten initialen Status haben', () => {
      const state = timer.getState();
      
      expect(state.status).toBe('idle');
      expect(state.elapsedMs).toBe(0);
      expect(state.remainingMs).toBe(5000);
      expect(state.progress).toBe(0);
      expect(state.totalPausedMs).toBe(0);
    });

    it('sollte Status nach Start korrekt setzen', () => {
      timer.start();
      const state = timer.getState();
      
      expect(state.status).toBe('running');
      expect(state.startTime).toBeDefined();
      expect(state.startTime).toBeGreaterThan(0);
    });

    it('sollte Status nach Pause korrekt setzen', () => {
      timer.start();
      timer.pause();
      const state = timer.getState();
      
      expect(state.status).toBe('paused');
      expect(state.pauseTime).toBeDefined();
    });

    it('sollte Status nach Stop korrekt setzen', () => {
      timer.start();
      timer.stop();
      const state = timer.getState();
      
      expect(state.status).toBe('stopped');
    });
  });

  describe('Timer-Start', () => {
    it('sollte Timer starten', () => {
      timer.start();
      expect(timer.getState().status).toBe('running');
    });

    it('sollte nicht zweimal starten', () => {
      timer.start();
      const startTime = timer.getState().startTime;
      
      timer.start();
      expect(timer.getState().startTime).toBe(startTime);
    });

    it('sollte von Pause fortsetzen', () => {
      timer.start();
      timer.pause();
      const pauseTime = timer.getState().pauseTime;
      
      timer.start();
      expect(timer.getState().status).toBe('running');
      expect(timer.getState().pauseTime).toBeUndefined();
    });
  });

  describe('Timer-Pause', () => {
    it('sollte laufenden Timer pausieren', () => {
      timer.start();
      timer.pause();
      expect(timer.getState().status).toBe('paused');
    });

    it('sollte nicht pausieren wenn nicht läuft', () => {
      timer.pause();
      expect(timer.getState().status).toBe('idle');
    });

    it('sollte nicht pausieren wenn bereits pausiert', () => {
      timer.start();
      timer.pause();
      const pauseTime = timer.getState().pauseTime;
      
      timer.pause();
      expect(timer.getState().pauseTime).toBe(pauseTime);
    });
  });

  describe('Timer-Resume', () => {
    it('sollte pausierten Timer fortsetzen', () => {
      timer.start();
      timer.pause();
      timer.resume();
      expect(timer.getState().status).toBe('running');
    });

    it('sollte nicht fortsetzen wenn nicht pausiert', () => {
      timer.resume();
      expect(timer.getState().status).toBe('idle');
    });
  });

  describe('Timer-Stop', () => {
    it('sollte Timer stoppen', () => {
      timer.start();
      timer.stop();
      expect(timer.getState().status).toBe('stopped');
    });

    it('sollte Timer von jedem Status stoppen', () => {
      timer.stop();
      expect(timer.getState().status).toBe('stopped');
      
      timer.start();
      timer.stop();
      expect(timer.getState().status).toBe('stopped');
      
      timer.start();
      timer.pause();
      timer.stop();
      expect(timer.getState().status).toBe('stopped');
    });
  });

  describe('Timer-Reset', () => {
    it('sollte Timer zurücksetzen', () => {
      timer.start();
      timer.pause();
      timer.reset();
      
      const state = timer.getState();
      expect(state.status).toBe('idle');
      expect(state.elapsedMs).toBe(0);
      expect(state.remainingMs).toBe(5000);
      expect(state.progress).toBe(0);
      expect(state.totalPausedMs).toBe(0);
    });
  });

  describe('Timer-Ticks', () => {
    it('sollte Tick-Callbacks aufrufen', (done) => {
      let tickCount = 0;
      
      timer.onTick((tick: TimerTick) => {
        tickCount++;
        expect(tick.timestamp).toBeGreaterThan(0);
        expect(tick.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(tick.remainingMs).toBeGreaterThanOrEqual(0);
        expect(tick.progress).toBeGreaterThanOrEqual(0);
        expect(tick.progress).toBeLessThanOrEqual(1);
        
        if (tickCount >= 3) {
          timer.stop();
          done();
        }
      });
      
      timer.start();
    }, 2000); // 2 Sekunden Timeout

    it('sollte State-Change-Callbacks aufrufen', (done) => {
      let stateChanges: TimerStatus[] = [];
      
      timer.onStateChange((state: TimerState) => {
        stateChanges.push(state.status);
        
        if (stateChanges.length >= 3) {
          expect(stateChanges).toContain('running');
          expect(stateChanges).toContain('paused');
          expect(stateChanges).toContain('stopped');
          done();
        }
      });
      
      timer.start();
      setTimeout(() => timer.pause(), 100);
      setTimeout(() => timer.stop(), 200);
    }, 1000);
  });

  describe('Timer-Berechnungen', () => {
    it('sollte korrekte Zeit-Berechnungen durchführen', (done) => {
      let lastTick: TimerTick | null = null;
      
      timer.onTick((tick: TimerTick) => {
        lastTick = tick;
        
        // Prüfe dass elapsedMs steigt
        if (lastTick && tick.elapsedMs < lastTick.elapsedMs) {
          done(new Error('elapsedMs sollte steigen'));
        }
        
        // Prüfe dass remainingMs sinkt
        if (lastTick && tick.remainingMs > lastTick.remainingMs) {
          done(new Error('remainingMs sollte sinken'));
        }
        
        // Prüfe dass progress steigt
        if (lastTick && tick.progress < lastTick.progress) {
          done(new Error('progress sollte steigen'));
        }
        
        if (tick.progress >= 0.5) {
          timer.stop();
          done();
        }
      });
      
      timer.start();
    }, 3000);

    it('sollte Pause-Zeit korrekt setzen', () => {
      timer.start();
      timer.pause();
      
      const state = timer.getState();
      expect(state.status).toBe('paused');
      expect(state.pauseTime).toBeDefined();
      
      timer.stop();
    });
  });

  describe('Timer-Abschluss', () => {
    it('sollte automatisch stoppen wenn Zeit abgelaufen', (done) => {
      let completed = false;
      
      timer.onStateChange((state: TimerState) => {
        if (state.status === 'stopped' && !completed) {
          completed = true;
          expect(state.elapsedMs).toBeGreaterThanOrEqual(5000);
          expect(state.remainingMs).toBe(0);
          expect(state.progress).toBe(1.0);
          done();
        }
      });
      
      timer.start();
    }, 7000); // 7 Sekunden für 5-Sekunden-Timer

    it('sollte nicht über die Zielzeit hinauslaufen', (done) => {
      let maxElapsed = 0;
      
      timer.onTick((tick: TimerTick) => {
        maxElapsed = Math.max(maxElapsed, tick.elapsedMs);
        
        if (tick.elapsedMs > 5100) { // 100ms Toleranz
          done(new Error('Timer läuft über Zielzeit hinaus'));
        }
      });
      
      timer.onStateChange((state: TimerState) => {
        if (state.status === 'stopped') {
          expect(maxElapsed).toBeLessThanOrEqual(5100);
          done();
        }
      });
      
      timer.start();
    }, 6000);
  });

  describe('Drift-Tests', () => {
    it('sollte minimalen Drift haben', (done) => {
      const startTime = Date.now();
      let tickCount = 0;
      let totalDrift = 0;
      
      timer.onTick((tick: TimerTick) => {
        tickCount++;
        const expectedTime = startTime + (tickCount * 100); // 100ms Intervall
        const actualTime = tick.timestamp;
        const drift = Math.abs(actualTime - expectedTime);
        totalDrift += drift;
        
        if (tickCount >= 10) {
          const averageDrift = totalDrift / tickCount;
          expect(averageDrift).toBeLessThan(50); // Max 50ms durchschnittlicher Drift
          timer.stop();
          done();
        }
      });
      
      timer.start();
    }, 3000);

    it('sollte konsistente Tick-Intervalle haben', (done) => {
      let lastTickTime = 0;
      let intervals: number[] = [];
      
      timer.onTick((tick: TimerTick) => {
        if (lastTickTime > 0) {
          const interval = tick.timestamp - lastTickTime;
          intervals.push(interval);
        }
        lastTickTime = tick.timestamp;
        
        if (intervals.length >= 5) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          expect(avgInterval).toBeGreaterThan(90); // Mindestens 90ms
          expect(avgInterval).toBeLessThan(110); // Maximal 110ms
          timer.stop();
          done();
        }
      });
      
      timer.start();
    }, 2000);
  });

  describe('Callback-Management', () => {
    it('sollte Callbacks korrekt registrieren und entfernen', (done) => {
      let tickCount = 0;
      let stateCount = 0;
      
      const unregisterTick = timer.onTick(() => {
        tickCount++;
      });
      
      const unregisterState = timer.onStateChange(() => {
        stateCount++;
      });
      
      timer.start();
      setTimeout(() => {
        timer.stop();
        
        expect(tickCount).toBeGreaterThan(0);
        expect(stateCount).toBeGreaterThan(0);
        
        // Entferne Callbacks
        unregisterTick();
        unregisterState();
        
        const tickCountBefore = tickCount;
        const stateCountBefore = stateCount;
        
        timer.start();
        setTimeout(() => {
          timer.stop();
          expect(tickCount).toBe(tickCountBefore);
          expect(stateCount).toBe(stateCountBefore);
          done();
        }, 100);
      }, 200);
    }, 1000);

    it('sollte mehrere Callbacks unterstützen', (done) => {
      let callback1Called = false;
      let callback2Called = false;
      
      timer.onTick(() => { callback1Called = true; });
      timer.onTick(() => { callback2Called = true; });
      
      timer.start();
      setTimeout(() => {
        timer.stop();
        expect(callback1Called).toBe(true);
        expect(callback2Called).toBe(true);
        done();
      }, 200);
    }, 1000);
  });

  describe('Error-Handling', () => {
    it('sollte Callback-Fehler abfangen', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      timer.onTick(() => {
        throw new Error('Test error');
      });
      
      timer.start();
      
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        timer.stop();
        done();
      }, 200);
    }, 1000);

    it('sollte State-Change-Callback-Fehler abfangen', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      timer.onStateChange(() => {
        throw new Error('Test error');
      });
      
      timer.start();
      
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        timer.stop();
        done();
      }, 200);
    }, 1000);
  });

  describe('Cleanup', () => {
    it('sollte Timer korrekt aufräumen', () => {
      let tickCalled = false;
      let stateCalled = false;
      
      timer.onTick(() => { tickCalled = true; });
      timer.onStateChange(() => { stateCalled = true; });
      
      timer.start();
      timer.destroy();
      
      // Timer sollte gestoppt sein
      expect(timer.getState().status).toBe('stopped');
      
      // destroy() stoppt den Timer sofort, daher werden keine Callbacks aufgerufen
      expect(tickCalled).toBe(false);
      // State-Change wird beim destroy() aufgerufen, daher true
      expect(stateCalled).toBe(true);
    });
  });

  describe('TimerUtils', () => {
    it('sollte Sekunden zu Millisekunden konvertieren', () => {
      expect(TimerUtils.secondsToMs(1)).toBe(1000);
      expect(TimerUtils.secondsToMs(5.5)).toBe(5500);
      expect(TimerUtils.secondsToMs(0)).toBe(0);
    });

    it('sollte Millisekunden zu Sekunden konvertieren', () => {
      expect(TimerUtils.msToSeconds(1000)).toBe(1);
      expect(TimerUtils.msToSeconds(5500)).toBe(6); // Gerundet
      expect(TimerUtils.msToSeconds(0)).toBe(0);
    });

    it('sollte Zeit als MM:SS formatieren', () => {
      expect(TimerUtils.formatTime(0)).toBe('00:00');
      expect(TimerUtils.formatTime(61)).toBe('01:01');
      expect(TimerUtils.formatTime(125)).toBe('02:05');
      expect(TimerUtils.formatTime(3600)).toBe('60:00');
    });

    it('sollte Zeit als MM:SS.S formatieren', () => {
      expect(TimerUtils.formatTimePrecise(0)).toBe('00:00.0');
      expect(TimerUtils.formatTimePrecise(61.5)).toBe('01:01.5');
      expect(TimerUtils.formatTimePrecise(125.7)).toBe('02:05.7');
    });
  });
});
