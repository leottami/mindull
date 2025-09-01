/**
 * User-Profile Model
 * Zentrale Benutzerdaten ohne PII
 */

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
  
  // Settings
  reminderMorning: string; // HH:mm format
  reminderEvening: string; // HH:mm format
  realityCheckEnabled: boolean;
  realityCheckStart: string; // HH:mm format
  realityCheckEnd: string; // HH:mm format
  realityCheckCount: number; // 3-5 checks per day
  
  // Opt-ins
  analyticsOptIn: boolean;
  aiReflectionOptIn: boolean;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
}

/**
 * User-Profile für Erstellung (ohne Auto-Generated Felder)
 */
export interface CreateUserProfile {
  email: string;
  reminderMorning?: string;
  reminderEvening?: string;
  realityCheckEnabled?: boolean;
  realityCheckStart?: string;
  realityCheckEnd?: string;
  realityCheckCount?: number;
  analyticsOptIn?: boolean;
  aiReflectionOptIn?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * User-Profile für Updates (alle Felder optional)
 */
export interface UpdateUserProfile {
  email?: string;
  reminderMorning?: string;
  reminderEvening?: string;
  realityCheckEnabled?: boolean;
  realityCheckStart?: string;
  realityCheckEnd?: string;
  realityCheckCount?: number;
  analyticsOptIn?: boolean;
  aiReflectionOptIn?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Validierung für User-Profile
 */
export class ProfileValidator {
  /**
   * Validiert E-Mail-Format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
  
  /**
   * Validiert Zeit-Format (HH:mm)
   */
  static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) return false;
    
    const [hours, minutes] = time.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }
  
  /**
   * Validiert Reality-Check-Anzahl
   */
  static isValidRealityCheckCount(count: number): boolean {
    return Number.isInteger(count) && count >= 3 && count <= 5;
  }
  
  /**
   * Validiert kompletten User-Profile
   */
  static validateProfile(profile: UserProfile): string[] {
    const errors: string[] = [];
    
    if (!profile.id || typeof profile.id !== 'string') {
      errors.push('ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidEmail(profile.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    
    if (!this.isValidTime(profile.reminderMorning)) {
      errors.push('Ungültige Morgen-Erinnerungszeit');
    }
    
    if (!this.isValidTime(profile.reminderEvening)) {
      errors.push('Ungültige Abend-Erinnerungszeit');
    }
    
    if (profile.realityCheckEnabled) {
      if (!this.isValidTime(profile.realityCheckStart)) {
        errors.push('Ungültige Reality-Check-Startzeit');
      }
      
      if (!this.isValidTime(profile.realityCheckEnd)) {
        errors.push('Ungültige Reality-Check-Endzeit');
      }
      
      if (!this.isValidRealityCheckCount(profile.realityCheckCount)) {
        errors.push('Reality-Check-Anzahl muss zwischen 3 und 5 liegen');
      }
    }
    
    if (!['light', 'dark', 'system'].includes(profile.theme)) {
      errors.push('Ungültiges Theme');
    }
    
    if (typeof profile.analyticsOptIn !== 'boolean') {
      errors.push('Analytics-Opt-In muss boolean sein');
    }
    
    if (typeof profile.aiReflectionOptIn !== 'boolean') {
      errors.push('AI-Reflection-Opt-In muss boolean sein');
    }
    
    return errors;
  }
  
  /**
   * Validiert CreateUserProfile
   */
  static validateCreateProfile(profile: CreateUserProfile): string[] {
    const errors: string[] = [];
    
    if (!profile.email) {
      errors.push('E-Mail ist erforderlich');
    } else if (!this.isValidEmail(profile.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    
    if (profile.reminderMorning && !this.isValidTime(profile.reminderMorning)) {
      errors.push('Ungültige Morgen-Erinnerungszeit');
    }
    
    if (profile.reminderEvening && !this.isValidTime(profile.reminderEvening)) {
      errors.push('Ungültige Abend-Erinnerungszeit');
    }
    
    if (profile.realityCheckCount !== undefined && !this.isValidRealityCheckCount(profile.realityCheckCount)) {
      errors.push('Reality-Check-Anzahl muss zwischen 3 und 5 liegen');
    }
    
    if (profile.theme && !['light', 'dark', 'system'].includes(profile.theme)) {
      errors.push('Ungültiges Theme');
    }
    
    return errors;
  }
}

/**
 * Default-Werte für User-Profile
 */
export const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'updatedAt'> = {
  reminderMorning: '08:00',
  reminderEvening: '20:00',
  realityCheckEnabled: true,
  realityCheckStart: '10:00',
  realityCheckEnd: '20:00',
  realityCheckCount: 3,
  analyticsOptIn: false,
  aiReflectionOptIn: true,
  theme: 'system'
};

/**
 * Erstellt ein neues User-Profile mit Default-Werten
 */
export function createDefaultProfile(email: string): CreateUserProfile {
  return {
    email: email.trim(),
    ...DEFAULT_PROFILE
  };
}
