/**
 * Timer Engine für Atem-Übungen
 * Driftarme, präzise Timer-Implementierung mit sicherem App-Hintergrund-Handling
 */

import { Platform } from 'react-native';

// Timer types
type TimerId = ReturnType<typeof setInterval>;

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface TimerTick {
  timestamp: number; // Unix timestamp
  elapsedMs: number; // Seit Start verstrichene Zeit
  remainingMs: number; // Verbleibende Zeit
  progress: number; // 0.0 - 1.0
}

export interface TimerConfig {
  durationMs: number; // Gesamtdauer in Millisekunden
  tickIntervalMs?: number; // Tick-Intervall (Standard: 100ms)
  backgroundBehavior?: 'pause' | 'continue' | 'stop'; // Verhalten im Hintergrund
}

export interface TimerState {
  status: TimerStatus;
  startTime?: number; // Unix timestamp
  pauseTime?: number; // Unix timestamp
  totalPausedMs: number; // Gesamte Pause-Zeit
  elapsedMs: number; // Tatsächlich verstrichene Zeit
  remainingMs: number; // Verbleibende Zeit
  progress: number; // 0.0 - 1.0
}

export type TimerCallback = (tick: TimerTick) => void;
export type TimerStateCallback = (state: TimerState) => void;

/**
 * Driftarme Timer-Engine für präzise Zeitmessung
 */
export class TimerEngine {
  private config: TimerConfig;
  private state: TimerState;
  private intervalId?: TimerId;
  private tickCallbacks: TimerCallback[] = [];
  private stateCallbacks: TimerStateCallback[] = [];
  private appStateListener?: any;
  private lastTickTime: number = 0;

  constructor(config: TimerConfig) {
    this.config = {
      tickIntervalMs: 100,
      backgroundBehavior: 'pause',
      ...config
    };
    
    this.state = {
      status: 'idle',
      totalPausedMs: 0,
      elapsedMs: 0,
      remainingMs: config.durationMs,
      progress: 0
    };

    this.setupAppStateListener();
  }

  /**
   * Startet den Timer
   */
  start(): void {
    if (this.state.status === 'running') {
      return;
    }

    const now = Date.now();
    
    if (this.state.status === 'paused') {
      // Resume von Pause
      this.state.totalPausedMs += now - (this.state.pauseTime || now);
      this.state.pauseTime = undefined;
    } else {
      // Neuer Start
      this.state.startTime = now;
      this.state.totalPausedMs = 0;
      this.state.elapsedMs = 0;
      this.state.remainingMs = this.config.durationMs;
      this.state.progress = 0;
    }

    this.state.status = 'running';
    this.lastTickTime = now;
    
    this.startInterval();
    this.notifyStateChange();
  }

  /**
   * Pausiert den Timer
   */
  pause(): void {
    if (this.state.status !== 'running') {
      return;
    }

    this.state.status = 'paused';
    this.state.pauseTime = Date.now();
    
    this.stopInterval();
    this.notifyStateChange();
  }

  /**
   * Setzt den Timer fort
   */
  resume(): void {
    if (this.state.status !== 'paused') {
      return;
    }

    this.start();
  }

  /**
   * Stoppt den Timer
   */
  stop(): void {
    if (this.state.status === 'stopped') {
      return;
    }

    this.state.status = 'stopped';
    this.state.pauseTime = undefined;
    
    this.stopInterval();
    this.notifyStateChange();
  }

  /**
   * Setzt den Timer zurück
   */
  reset(): void {
    this.stop();
    
    this.state = {
      status: 'idle',
      totalPausedMs: 0,
      elapsedMs: 0,
      remainingMs: this.config.durationMs,
      progress: 0
    };
    
    this.notifyStateChange();
  }

  /**
   * Registriert einen Tick-Callback
   */
  onTick(callback: TimerCallback): () => void {
    this.tickCallbacks.push(callback);
    
    // Return unregister function
    return () => {
      const index = this.tickCallbacks.indexOf(callback);
      if (index > -1) {
        this.tickCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Registriert einen State-Change-Callback
   */
  onStateChange(callback: TimerStateCallback): () => void {
    this.stateCallbacks.push(callback);
    
    // Return unregister function
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Gibt den aktuellen Timer-Status zurück
   */
  getState(): TimerState {
    return { ...this.state };
  }

  /**
   * Gibt die Konfiguration zurück
   */
  getConfig(): TimerConfig {
    return { ...this.config };
  }

  /**
   * Startet das Timer-Interval
   */
  private startInterval(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.tickIntervalMs);
  }

  /**
   * Stoppt das Timer-Interval
   */
  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Timer-Tick-Handler
   */
  private tick(): void {
    if (this.state.status !== 'running') {
      return;
    }

    const now = Date.now();
    const startTime = this.state.startTime || now;
    
    // Berechne tatsächlich verstrichene Zeit (ohne Pausen)
    const totalElapsedMs = now - startTime - this.state.totalPausedMs;
    
    // Aktualisiere State
    this.state.elapsedMs = Math.min(totalElapsedMs, this.config.durationMs);
    this.state.remainingMs = Math.max(0, this.config.durationMs - this.state.elapsedMs);
    this.state.progress = Math.min(1.0, this.state.elapsedMs / this.config.durationMs);

    // Erstelle Tick-Event
    const tick: TimerTick = {
      timestamp: now,
      elapsedMs: this.state.elapsedMs,
      remainingMs: this.state.remainingMs,
      progress: this.state.progress
    };

    // Benachrichtige Callbacks
    this.notifyTickCallbacks(tick);
    this.notifyStateChange();

    // Prüfe ob Timer abgelaufen ist
    if (this.state.elapsedMs >= this.config.durationMs) {
      this.complete();
    }

    this.lastTickTime = now;
  }

  /**
   * Timer-Abschluss
   */
  private complete(): void {
    this.state.status = 'stopped';
    this.state.elapsedMs = this.config.durationMs;
    this.state.remainingMs = 0;
    this.state.progress = 1.0;
    
    this.stopInterval();
    this.notifyStateChange();
  }

  /**
   * Benachrichtigt Tick-Callbacks
   */
  private notifyTickCallbacks(tick: TimerTick): void {
    this.tickCallbacks.forEach(callback => {
      try {
        callback(tick);
      } catch (error) {
        console.error('Timer tick callback error:', error);
      }
    });
  }

  /**
   * Benachrichtigt State-Change-Callbacks
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Timer state callback error:', error);
      }
    });
  }

  /**
   * Setup App-State-Listener für Hintergrund-Handling
   */
  private setupAppStateListener(): void {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // React Native AppState würde hier verwendet werden
      // Für jetzt simulieren wir das Verhalten
      this.handleAppStateChange = this.handleAppStateChange.bind(this);
    }
  }

  /**
   * Behandelt App-State-Änderungen
   */
  private handleAppStateChange(appState: string): void {
    switch (this.config.backgroundBehavior) {
      case 'pause':
        if (appState === 'background' && this.state.status === 'running') {
          this.pause();
        } else if (appState === 'active' && this.state.status === 'paused') {
          // Automatisches Resume nur wenn durch Hintergrund pausiert
          // Hier könnte eine Logik implementiert werden
        }
        break;
      
      case 'stop':
        if (appState === 'background' && this.state.status === 'running') {
          this.stop();
        }
        break;
      
      case 'continue':
        // Timer läuft weiter im Hintergrund
        break;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopInterval();
    
    if (this.appStateListener) {
      // AppState.removeEventListener('change', this.appStateListener);
      this.appStateListener = undefined;
    }
    
    this.state.status = 'stopped';
    this.tickCallbacks = [];
    this.stateCallbacks = [];
  }
}

/**
 * Factory-Funktion für Timer-Engine
 */
export function createTimerEngine(config: TimerConfig): TimerEngine {
  return new TimerEngine(config);
}

/**
 * Utility-Funktionen für Timer
 */
export const TimerUtils = {
  /**
   * Konvertiert Sekunden zu Millisekunden
   */
  secondsToMs(seconds: number): number {
    return Math.round(seconds * 1000);
  },

  /**
   * Konvertiert Millisekunden zu Sekunden
   */
  msToSeconds(ms: number): number {
    return Math.round(ms / 1000);
  },

  /**
   * Formatiert Zeit als MM:SS
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Formatiert Zeit als MM:SS.S (mit Dezimalstellen)
   */
  formatTimePrecise(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  }
};
