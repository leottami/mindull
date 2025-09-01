/**
 * Breath Controller
 * Verbindet Timer-Engine mit Atem-Methoden-Konfiguration
 */

import { 
  BreathingMethod, 
  BreathingPhase, 
  BreathingPhaseConfig,
  BREATHING_METHODS,
  calculateSessionDuration,
  BreathingMethodValidator
} from './methods.catalog';
import { 
  TimerEngine, 
  TimerConfig, 
  TimerTick, 
  TimerState,
  TimerUtils,
  createTimerEngine
} from './timer.engine';

export type BreathSessionStatus = 'idle' | 'preparing' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface BreathPhaseInfo {
  phase: BreathingPhase;
  phaseIndex: number; // 0-3 (inhale, hold, exhale, holdAfterExhale)
  cycleIndex: number; // Aktueller Zyklus (1-basiert)
  totalCycles: number;
  phaseDurationMs: number;
  phaseElapsedMs: number;
  phaseRemainingMs: number;
  phaseProgress: number; // 0.0 - 1.0
  isActive: boolean;
}

export interface BreathSessionInfo {
  status: BreathSessionStatus;
  method: BreathingMethod;
  phases: BreathingPhaseConfig;
  cycles: number;
  currentPhase: BreathingPhase;
  currentCycle: number;
  totalDurationMs: number;
  elapsedMs: number;
  remainingMs: number;
  progress: number; // 0.0 - 1.0
  phaseInfo: BreathPhaseInfo;
  interruptions: number;
  startTime?: number;
  endTime?: number;
}

export interface BreathControllerConfig {
  method: BreathingMethod;
  cycles?: number;
  customPhases?: BreathingPhaseConfig;
  audioEnabled?: boolean;
  hapticEnabled?: boolean;
  backgroundAudio?: boolean;
  tickIntervalMs?: number;
  backgroundBehavior?: 'pause' | 'continue' | 'stop';
}

export type BreathTickCallback = (tick: TimerTick, sessionInfo: BreathSessionInfo) => void;
export type BreathPhaseChangeCallback = (phaseInfo: BreathPhaseInfo, sessionInfo: BreathSessionInfo) => void;
export type BreathCompleteCallback = (sessionInfo: BreathSessionInfo) => void;
export type BreathStateChangeCallback = (sessionInfo: BreathSessionInfo) => void;

/**
 * Controller für Atem-Übungen
 */
export class BreathController {
  private config: BreathControllerConfig;
  private sessionInfo: BreathSessionInfo;
  private timer: TimerEngine;
  private tickCallbacks: BreathTickCallback[] = [];
  private phaseChangeCallbacks: BreathPhaseChangeCallback[] = [];
  private completeCallbacks: BreathCompleteCallback[] = [];
  private stateChangeCallbacks: BreathStateChangeCallback[] = [];
  private currentPhaseIndex: number = 0;
  private currentCycle: number = 1;
  private phaseStartTime: number = 0;
  private interruptions: number = 0;

  constructor(config: BreathControllerConfig) {
    this.config = {
      audioEnabled: true,
      hapticEnabled: true,
      backgroundAudio: false,
      tickIntervalMs: 100,
      backgroundBehavior: 'pause',
      ...config
    };

    // Validiere Konfiguration
    const errors = this.validateConfig();
    if (errors.length > 0) {
      throw new Error(`Ungültige Konfiguration: ${errors.join(', ')}`);
    }

    // Erstelle Session-Info
    this.sessionInfo = this.createSessionInfo();

    // Erstelle Timer
    const timerConfig: TimerConfig = {
      durationMs: this.sessionInfo.totalDurationMs,
      tickIntervalMs: this.config.tickIntervalMs,
      backgroundBehavior: this.config.backgroundBehavior
    };

    this.timer = createTimerEngine(timerConfig);
    this.setupTimerCallbacks();
  }

  /**
   * Startet die Atem-Session
   */
  start(): void {
    if (this.sessionInfo.status === 'active') {
      return;
    }

    this.sessionInfo.status = 'preparing';
    this.notifyStateChange();

    // Kurze Vorbereitungszeit (optional)
    setTimeout(() => {
      this.sessionInfo.status = 'active';
      this.sessionInfo.startTime = Date.now();
      this.phaseStartTime = Date.now();
      this.currentPhaseIndex = 0;
      this.currentCycle = 1;
      
      this.timer.start();
      this.notifyStateChange();
      this.notifyPhaseChange();
    }, 1000); // 1 Sekunde Vorbereitung
  }

  /**
   * Pausiert die Session
   */
  pause(): void {
    if (this.sessionInfo.status !== 'active') {
      return;
    }

    this.sessionInfo.status = 'paused';
    this.timer.pause();
    this.notifyStateChange();
  }

  /**
   * Setzt die Session fort
   */
  resume(): void {
    if (this.sessionInfo.status !== 'paused') {
      return;
    }

    this.sessionInfo.status = 'active';
    this.phaseStartTime = Date.now();
    this.timer.resume();
    this.notifyStateChange();
  }

  /**
   * Stoppt die Session
   */
  stop(): void {
    if (this.sessionInfo.status === 'cancelled') {
      return;
    }

    this.sessionInfo.status = 'cancelled';
    this.sessionInfo.endTime = Date.now();
    this.timer.stop();
    this.notifyStateChange();
  }

  /**
   * Registriert Tick-Callback
   */
  onTick(callback: BreathTickCallback): () => void {
    this.tickCallbacks.push(callback);
    
    return () => {
      const index = this.tickCallbacks.indexOf(callback);
      if (index > -1) {
        this.tickCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Registriert Phase-Change-Callback
   */
  onPhaseChange(callback: BreathPhaseChangeCallback): () => void {
    this.phaseChangeCallbacks.push(callback);
    
    return () => {
      const index = this.phaseChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.phaseChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Registriert Complete-Callback
   */
  onComplete(callback: BreathCompleteCallback): () => void {
    this.completeCallbacks.push(callback);
    
    return () => {
      const index = this.completeCallbacks.indexOf(callback);
      if (index > -1) {
        this.completeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Registriert State-Change-Callback
   */
  onStateChange(callback: BreathStateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);
    
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Gibt aktuelle Session-Info zurück
   */
  getSessionInfo(): BreathSessionInfo {
    return { ...this.sessionInfo };
  }

  /**
   * Gibt aktuelle Phase-Info zurück
   */
  getPhaseInfo(): BreathPhaseInfo {
    return { ...this.sessionInfo.phaseInfo };
  }

  /**
   * Gibt Timer-State zurück
   */
  getTimerState(): TimerState {
    return this.timer.getState();
  }

  /**
   * Validiert die Konfiguration
   */
  private validateConfig(): string[] {
    const errors: string[] = [];

    if (!BreathingMethodValidator.isValidMethod(this.config.method)) {
      errors.push('Ungültige Atem-Methode');
    }

    if (this.config.cycles !== undefined) {
      const methodErrors = BreathingMethodValidator.validateMethodConfig(
        this.config.method, 
        this.config.cycles
      );
      errors.push(...methodErrors);
    }

    if (this.config.customPhases && this.config.method !== 'custom') {
      errors.push('Custom-Phasen nur für Custom-Methode erlaubt');
    }

    return errors;
  }

  /**
   * Erstellt Session-Info
   */
  private createSessionInfo(): BreathSessionInfo {
    const methodConfig = BREATHING_METHODS[this.config.method];
    const phases = this.config.customPhases || methodConfig.phases;
    const cycles = this.config.cycles || methodConfig.defaultCycles;
    const totalDurationMs = TimerUtils.secondsToMs(calculateSessionDuration(phases, cycles));

    const phaseInfo: BreathPhaseInfo = {
      phase: 'inhale',
      phaseIndex: 0,
      cycleIndex: 1,
      totalCycles: cycles,
      phaseDurationMs: TimerUtils.secondsToMs(phases.inhaleSec),
      phaseElapsedMs: 0,
      phaseRemainingMs: TimerUtils.secondsToMs(phases.inhaleSec),
      phaseProgress: 0,
      isActive: false
    };

    return {
      status: 'idle',
      method: this.config.method,
      phases,
      cycles,
      currentPhase: 'inhale',
      currentCycle: 1,
      totalDurationMs,
      elapsedMs: 0,
      remainingMs: totalDurationMs,
      progress: 0,
      phaseInfo,
      interruptions: 0,
      startTime: undefined,
      endTime: undefined
    };
  }

  /**
   * Setup Timer-Callbacks
   */
  private setupTimerCallbacks(): void {
    this.timer.onTick((tick: TimerTick) => {
      this.handleTimerTick(tick);
    });

    this.timer.onStateChange((state: TimerState) => {
      this.handleTimerStateChange(state);
    });
  }

  /**
   * Behandelt Timer-Ticks
   */
  private handleTimerTick(tick: TimerTick): void {
    if (this.sessionInfo.status !== 'active') {
      return;
    }

    // Aktualisiere Session-Info
    this.sessionInfo.elapsedMs = tick.elapsedMs;
    this.sessionInfo.remainingMs = tick.remainingMs;
    this.sessionInfo.progress = tick.progress;

    // Aktualisiere Phase-Info
    this.updatePhaseInfo(tick);

    // Benachrichtige Tick-Callbacks
    this.notifyTickCallbacks(tick);

    // Prüfe Phase-Wechsel
    this.checkPhaseChange(tick);
  }

  /**
   * Behandelt Timer-State-Änderungen
   */
  private handleTimerStateChange(state: TimerState): void {
    if (state.status === 'stopped' && this.sessionInfo.status === 'active') {
      this.completeSession();
    }
  }

  /**
   * Aktualisiert Phase-Info
   */
  private updatePhaseInfo(tick: TimerTick): void {
    const phaseInfo = this.sessionInfo.phaseInfo;
    const now = Date.now();
    
    phaseInfo.phaseElapsedMs = now - this.phaseStartTime;
    phaseInfo.phaseRemainingMs = Math.max(0, phaseInfo.phaseDurationMs - phaseInfo.phaseElapsedMs);
    phaseInfo.phaseProgress = Math.min(1.0, phaseInfo.phaseElapsedMs / phaseInfo.phaseDurationMs);
    phaseInfo.isActive = this.sessionInfo.status === 'active';
  }

  /**
   * Prüft Phase-Wechsel
   */
  private checkPhaseChange(tick: TimerTick): void {
    const phaseInfo = this.sessionInfo.phaseInfo;
    
    if (phaseInfo.phaseElapsedMs >= phaseInfo.phaseDurationMs) {
      this.nextPhase();
    }
  }

  /**
   * Wechselt zur nächsten Phase
   */
  private nextPhase(): void {
    const phases: BreathingPhase[] = ['inhale', 'hold', 'exhale', 'holdAfterExhale'];
    const phaseDurations = [
      this.sessionInfo.phases.inhaleSec,
      this.sessionInfo.phases.holdSec,
      this.sessionInfo.phases.exhaleSec,
      this.sessionInfo.phases.holdAfterExhaleSec
    ];

    this.currentPhaseIndex++;
    
    // Prüfe ob Zyklus beendet
    if (this.currentPhaseIndex >= phases.length) {
      this.currentPhaseIndex = 0;
      this.currentCycle++;
      
      // Prüfe ob Session beendet
      if (this.currentCycle > this.sessionInfo.cycles) {
        this.completeSession();
        return;
      }
    }

    // Aktualisiere Phase-Info
    const newPhase = phases[this.currentPhaseIndex];
    const newPhaseDuration = phaseDurations[this.currentPhaseIndex];
    
    this.sessionInfo.currentPhase = newPhase;
    this.sessionInfo.currentCycle = this.currentCycle;
    
    this.sessionInfo.phaseInfo = {
      phase: newPhase,
      phaseIndex: this.currentPhaseIndex,
      cycleIndex: this.currentCycle,
      totalCycles: this.sessionInfo.cycles,
      phaseDurationMs: TimerUtils.secondsToMs(newPhaseDuration),
      phaseElapsedMs: 0,
      phaseRemainingMs: TimerUtils.secondsToMs(newPhaseDuration),
      phaseProgress: 0,
      isActive: true
    };

    this.phaseStartTime = Date.now();
    
    this.notifyPhaseChange();
  }

  /**
   * Beendet die Session
   */
  private completeSession(): void {
    this.sessionInfo.status = 'completed';
    this.sessionInfo.endTime = Date.now();
    this.sessionInfo.phaseInfo.isActive = false;
    
    this.notifyStateChange();
    this.notifyComplete();
  }

  /**
   * Benachrichtigt Tick-Callbacks
   */
  private notifyTickCallbacks(tick: TimerTick): void {
    const sessionInfo = this.getSessionInfo();
    this.tickCallbacks.forEach(callback => {
      try {
        callback(tick, sessionInfo);
      } catch (error) {
        console.error('Breath tick callback error:', error);
      }
    });
  }

  /**
   * Benachrichtigt Phase-Change-Callbacks
   */
  private notifyPhaseChange(): void {
    const sessionInfo = this.getSessionInfo();
    const phaseInfo = this.getPhaseInfo();
    
    this.phaseChangeCallbacks.forEach(callback => {
      try {
        callback(phaseInfo, sessionInfo);
      } catch (error) {
        console.error('Breath phase change callback error:', error);
      }
    });
  }

  /**
   * Benachrichtigt Complete-Callbacks
   */
  private notifyComplete(): void {
    const sessionInfo = this.getSessionInfo();
    
    this.completeCallbacks.forEach(callback => {
      try {
        callback(sessionInfo);
      } catch (error) {
        console.error('Breath complete callback error:', error);
      }
    });
  }

  /**
   * Benachrichtigt State-Change-Callbacks
   */
  private notifyStateChange(): void {
    const sessionInfo = this.getSessionInfo();
    
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(sessionInfo);
      } catch (error) {
        console.error('Breath state change callback error:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.timer.destroy();
    this.tickCallbacks = [];
    this.phaseChangeCallbacks = [];
    this.completeCallbacks = [];
    this.stateChangeCallbacks = [];
  }
}

/**
 * Factory-Funktion für Breath-Controller
 */
export function createBreathController(config: BreathControllerConfig): BreathController {
  return new BreathController(config);
}
