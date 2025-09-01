/**
 * Atem-Methoden Katalog
 * Definiert alle verfügbaren Atemmethoden mit Parametern und Validierung
 */

export type BreathingMethod = 
  | 'box'           // 4-4-4-4 Box Breathing
  | '478'           // 4-7-8 Breathing
  | 'coherent'      // 5-5 Coherent Breathing
  | 'equal'         // Equal/5-5 Breathing
  | 'custom';       // Benutzerdefinierte Zeiten

export type BreathingPhase = 'inhale' | 'hold' | 'exhale' | 'holdAfterExhale';

/**
 * Atem-Phase-Konfiguration
 */
export interface BreathingPhaseConfig {
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
}

/**
 * Atem-Methode-Konfiguration
 */
export interface BreathingMethodConfig {
  id: BreathingMethod;
  nameKey: string; // i18n-Schlüssel für Anzeigename
  descriptionKey: string; // i18n-Schlüssel für Beschreibung
  phases: BreathingPhaseConfig;
  defaultCycles: number;
  minCycles: number;
  maxCycles: number;
  category: 'relaxation' | 'focus' | 'sleep' | 'energy' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationMin: number;
}

/**
 * Benutzerdefinierte Atem-Konfiguration
 */
export interface CustomBreathingConfig {
  phases: BreathingPhaseConfig;
  cycles: number;
  name?: string;
}

/**
 * Parametergrenzen für Atemmethoden
 */
export const BREATHING_CONSTRAINTS = {
  // Phase-Dauer-Grenzen (in Sekunden)
  phase: {
    min: 1,
    max: 20,
    default: 4
  },
  // Zyklen-Grenzen
  cycles: {
    min: 1,
    max: 50,
    default: 10
  },
  // Gesamtdauer-Grenzen (in Sekunden)
  session: {
    min: 30, // Mindestens 30 Sekunden
    max: 3600, // Maximal 1 Stunde
    default: 300 // 5 Minuten Standard
  }
} as const;

/**
 * Verfügbare Atemmethoden-Katalog
 */
export const BREATHING_METHODS: Record<BreathingMethod, BreathingMethodConfig> = {
  box: {
    id: 'box',
    nameKey: 'breath.methods.box.name',
    descriptionKey: 'breath.methods.box.description',
    phases: {
      inhaleSec: 4,
      holdSec: 4,
      exhaleSec: 4,
      holdAfterExhaleSec: 4
    },
    defaultCycles: 10,
    minCycles: 3,
    maxCycles: 20,
    category: 'relaxation',
    difficulty: 'beginner',
    estimatedDurationMin: 3
  },
  '478': {
    id: '478',
    nameKey: 'breath.methods.fourseveneight.name',
    descriptionKey: 'breath.methods.fourseveneight.description',
    phases: {
      inhaleSec: 4,
      holdSec: 7,
      exhaleSec: 8,
      holdAfterExhaleSec: 0
    },
    defaultCycles: 8,
    minCycles: 3,
    maxCycles: 15,
    category: 'sleep',
    difficulty: 'intermediate',
    estimatedDurationMin: 4
  },
  coherent: {
    id: 'coherent',
    nameKey: 'breath.methods.coherent.name',
    descriptionKey: 'breath.methods.coherent.description',
    phases: {
      inhaleSec: 5,
      holdSec: 0,
      exhaleSec: 5,
      holdAfterExhaleSec: 0
    },
    defaultCycles: 12,
    minCycles: 5,
    maxCycles: 25,
    category: 'focus',
    difficulty: 'beginner',
    estimatedDurationMin: 5
  },
  equal: {
    id: 'equal',
    nameKey: 'breath.methods.equal.name',
    descriptionKey: 'breath.methods.equal.description',
    phases: {
      inhaleSec: 5,
      holdSec: 0,
      exhaleSec: 5,
      holdAfterExhaleSec: 0
    },
    defaultCycles: 10,
    minCycles: 3,
    maxCycles: 20,
    category: 'focus',
    difficulty: 'beginner',
    estimatedDurationMin: 4
  },
  custom: {
    id: 'custom',
    nameKey: 'breath.methods.custom.name',
    descriptionKey: 'breath.methods.custom.description',
    phases: {
      inhaleSec: 4,
      holdSec: 4,
      exhaleSec: 4,
      holdAfterExhaleSec: 4
    },
    defaultCycles: 10,
    minCycles: 1,
    maxCycles: 50,
    category: 'custom',
    difficulty: 'advanced',
    estimatedDurationMin: 5
  }
} as const;

/**
 * Validierung für Atem-Methoden
 */
export class BreathingMethodValidator {
  /**
   * Validiert eine Atem-Methode
   */
  static isValidMethod(method: string): method is BreathingMethod {
    return Object.keys(BREATHING_METHODS).includes(method);
  }

  /**
   * Validiert Phase-Dauer
   */
  static isValidPhaseDuration(seconds: number): boolean {
    return Number.isInteger(seconds) && 
           seconds >= BREATHING_CONSTRAINTS.phase.min && 
           seconds <= BREATHING_CONSTRAINTS.phase.max;
  }

  /**
   * Validiert Anzahl Zyklen
   */
  static isValidCycles(cycles: number, method: BreathingMethod): boolean {
    const config = BREATHING_METHODS[method];
    return Number.isInteger(cycles) && 
           cycles >= config.minCycles && 
           cycles <= config.maxCycles;
  }

  /**
   * Validiert benutzerdefinierte Atem-Konfiguration
   */
  static validateCustomConfig(config: CustomBreathingConfig): string[] {
    const errors: string[] = [];

    // Validiere Phasen
    if (!this.isValidPhaseDuration(config.phases.inhaleSec)) {
      errors.push(`Einatmung muss zwischen ${BREATHING_CONSTRAINTS.phase.min}-${BREATHING_CONSTRAINTS.phase.max} Sekunden liegen`);
    }

    if (!this.isValidPhaseDuration(config.phases.holdSec)) {
      errors.push(`Halten muss zwischen ${BREATHING_CONSTRAINTS.phase.min}-${BREATHING_CONSTRAINTS.phase.max} Sekunden liegen`);
    }

    if (!this.isValidPhaseDuration(config.phases.exhaleSec)) {
      errors.push(`Ausatmung muss zwischen ${BREATHING_CONSTRAINTS.phase.min}-${BREATHING_CONSTRAINTS.phase.max} Sekunden liegen`);
    }

    if (!this.isValidPhaseDuration(config.phases.holdAfterExhaleSec)) {
      errors.push(`Halten nach Ausatmung muss zwischen ${BREATHING_CONSTRAINTS.phase.min}-${BREATHING_CONSTRAINTS.phase.max} Sekunden liegen`);
    }

    // Validiere Zyklen
    if (!this.isValidCycles(config.cycles, 'custom')) {
      errors.push(`Zyklen müssen zwischen ${BREATHING_METHODS.custom.minCycles}-${BREATHING_METHODS.custom.maxCycles} liegen`);
    }

    // Validiere Gesamtdauer
    const totalDuration = calculateSessionDuration(config.phases, config.cycles);
    if (totalDuration < BREATHING_CONSTRAINTS.session.min) {
      errors.push(`Session muss mindestens ${BREATHING_CONSTRAINTS.session.min} Sekunden dauern`);
    }

    if (totalDuration > BREATHING_CONSTRAINTS.session.max) {
      errors.push(`Session darf maximal ${BREATHING_CONSTRAINTS.session.max} Sekunden dauern`);
    }

    return errors;
  }

  /**
   * Validiert Standard-Methoden-Konfiguration
   */
  static validateMethodConfig(method: BreathingMethod, cycles?: number): string[] {
    const errors: string[] = [];

    if (!this.isValidMethod(method)) {
      errors.push('Ungültige Atem-Methode');
      return errors;
    }

    if (cycles !== undefined && !this.isValidCycles(cycles, method)) {
      const config = BREATHING_METHODS[method];
      errors.push(`Zyklen müssen zwischen ${config.minCycles}-${config.maxCycles} liegen`);
    }

    return errors;
  }
}

/**
 * Berechnet die Gesamtdauer einer Atem-Session
 */
export function calculateSessionDuration(
  phases: BreathingPhaseConfig, 
  cycles: number
): number {
  const cycleDuration = phases.inhaleSec + phases.holdSec + phases.exhaleSec + phases.holdAfterExhaleSec;
  return cycleDuration * cycles;
}

/**
 * Berechnet die geschätzte Dauer einer Standard-Methode
 */
export function calculateMethodDuration(method: BreathingMethod, cycles?: number): number {
  const config = BREATHING_METHODS[method];
  const actualCycles = cycles ?? config.defaultCycles;
  return calculateSessionDuration(config.phases, actualCycles);
}

/**
 * Erstellt eine benutzerdefinierte Konfiguration mit Standardwerten
 */
export function createCustomConfig(
  phases: Partial<BreathingPhaseConfig> = {},
  cycles?: number
): CustomBreathingConfig {
  return {
    phases: {
      inhaleSec: phases.inhaleSec ?? BREATHING_CONSTRAINTS.phase.default,
      holdSec: phases.holdSec ?? BREATHING_CONSTRAINTS.phase.default,
      exhaleSec: phases.exhaleSec ?? BREATHING_CONSTRAINTS.phase.default,
      holdAfterExhaleSec: phases.holdAfterExhaleSec ?? BREATHING_CONSTRAINTS.phase.default
    },
    cycles: cycles ?? BREATHING_CONSTRAINTS.cycles.default
  };
}

/**
 * Gruppiert Methoden nach Kategorie
 */
export function getMethodsByCategory(): Record<string, BreathingMethod[]> {
  const grouped: Record<string, BreathingMethod[]> = {};
  
  Object.values(BREATHING_METHODS).forEach(method => {
    if (!grouped[method.category]) {
      grouped[method.category] = [];
    }
    grouped[method.category].push(method.id);
  });
  
  return grouped;
}

/**
 * Filtert Methoden nach Schwierigkeitsgrad
 */
export function getMethodsByDifficulty(difficulty: BreathingMethodConfig['difficulty']): BreathingMethod[] {
  return Object.values(BREATHING_METHODS)
    .filter(method => method.difficulty === difficulty)
    .map(method => method.id);
}

/**
 * Standard-Methoden für schnellen Start
 */
export const QUICK_START_METHODS: BreathingMethod[] = ['box', 'coherent', 'equal'];

/**
 * Methoden für Anfänger
 */
export const BEGINNER_METHODS: BreathingMethod[] = getMethodsByDifficulty('beginner');

/**
 * Methoden für Fortgeschrittene
 */
export const ADVANCED_METHODS: BreathingMethod[] = getMethodsByDifficulty('advanced');
