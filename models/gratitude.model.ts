/**
 * Gratitude Entry Model
 * Morgens und abends Dankbarkeits-Einträge
 */

export interface GratitudeEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  morning: boolean; // true = morgens, false = abends
  text: string;
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

/**
 * Gratitude-Entry für Erstellung
 */
export interface CreateGratitudeEntry {
  userId: string;
  date: string; // YYYY-MM-DD format
  morning: boolean;
  text: string;
}

/**
 * Gratitude-Entry für Updates
 */
export interface UpdateGratitudeEntry {
  text?: string;
}

/**
 * Gratitude-Entry für API-Responses (ohne userId)
 */
export interface GratitudeEntryResponse {
  id: string;
  date: string;
  morning: boolean;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tägliche Gratitude-Übersicht (morgens + abends)
 */
export interface DailyGratitude {
  date: string;
  morning?: GratitudeEntryResponse;
  evening?: GratitudeEntryResponse;
}

/**
 * Validierung für Gratitude-Entries
 */
export class GratitudeValidator {
  /**
   * Validiert Datum-Format (YYYY-MM-DD)
   */
  static isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  }
  
  /**
   * Validiert Text-Länge
   */
  static isValidText(text: string): boolean {
    const trimmedText = text.trim();
    return trimmedText.length > 0 && trimmedText.length <= 1000; // Max 1k Zeichen für Gratitude
  }
  
  /**
   * Validiert kompletten Gratitude-Entry
   */
  static validateEntry(entry: GratitudeEntry): string[] {
    const errors: string[] = [];
    
    if (!entry.id || typeof entry.id !== 'string') {
      errors.push('ID ist erforderlich und muss ein String sein');
    }
    
    if (!entry.userId || typeof entry.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidDate(entry.date)) {
      errors.push('Ungültiges Datum-Format (YYYY-MM-DD erforderlich)');
    }
    
    if (typeof entry.morning !== 'boolean') {
      errors.push('Morning-Flag muss boolean sein');
    }
    
    if (!this.isValidText(entry.text)) {
      errors.push('Text ist erforderlich und darf maximal 1.000 Zeichen haben');
    }
    
    return errors;
  }
  
  /**
   * Validiert CreateGratitudeEntry
   */
  static validateCreateEntry(entry: CreateGratitudeEntry): string[] {
    const errors: string[] = [];
    
    if (!entry.userId || typeof entry.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidDate(entry.date)) {
      errors.push('Ungültiges Datum-Format (YYYY-MM-DD erforderlich)');
    }
    
    if (typeof entry.morning !== 'boolean') {
      errors.push('Morning-Flag muss boolean sein');
    }
    
    if (!this.isValidText(entry.text)) {
      errors.push('Text ist erforderlich und darf maximal 1.000 Zeichen haben');
    }
    
    return errors;
  }
  
  /**
   * Validiert UpdateGratitudeEntry
   */
  static validateUpdateEntry(entry: UpdateGratitudeEntry): string[] {
    const errors: string[] = [];
    
    if (entry.text !== undefined && !this.isValidText(entry.text)) {
      errors.push('Text darf maximal 1.000 Zeichen haben');
    }
    
    return errors;
  }
  
  /**
   * Prüft ob ein Datum in der Zukunft liegt
   */
  static isFutureDate(date: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return date > today;
  }
  
  /**
   * Prüft ob ein Datum zu alt ist (älter als 1 Jahr)
   */
  static isTooOldDate(date: string): boolean {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);
    return date < oneYearAgoStr;
  }
  
  /**
   * Prüft ob ein Entry für heute erstellt werden kann
   */
  static canCreateForToday(date: string, morning: boolean): boolean {
    const today = new Date().toISOString().slice(0, 10);
    
    if (date !== today) {
      return false; // Nur für heute erlaubt
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    
    if (morning) {
      // Morgens: 05:00 - 12:00
      return currentHour >= 5 && currentHour < 12;
    } else {
      // Abends: 18:00 - 23:59 oder 00:00 - 02:00
      return currentHour >= 18 || currentHour <= 2;
    }
  }
}

/**
 * Erstellt einen neuen Gratitude-Entry mit normalisierten Daten
 */
export function createGratitudeEntry(data: CreateGratitudeEntry): CreateGratitudeEntry {
  return {
    userId: data.userId,
    date: data.date,
    morning: data.morning,
    text: data.text.trim()
  };
}

/**
 * Konvertiert Gratitude-Entry zu Response-Format
 */
export function toGratitudeEntryResponse(entry: GratitudeEntry): GratitudeEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    morning: entry.morning,
    text: entry.text,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

/**
 * Gruppiert Gratitude-Entries nach Tagen
 */
export function groupGratitudeByDay(entries: GratitudeEntry[]): DailyGratitude[] {
  const grouped = new Map<string, DailyGratitude>();
  
  entries.forEach(entry => {
    const response = toGratitudeEntryResponse(entry);
    
    if (!grouped.has(entry.date)) {
      grouped.set(entry.date, {
        date: entry.date,
        morning: undefined,
        evening: undefined
      });
    }
    
    const daily = grouped.get(entry.date)!;
    
    if (entry.morning) {
      daily.morning = response;
    } else {
      daily.evening = response;
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Prüft ob ein Tag vollständig ist (morgens + abends)
 */
export function isCompleteDay(entries: GratitudeEntry[], date: string): boolean {
  const dayEntries = entries.filter(entry => entry.date === date);
  const hasMorning = dayEntries.some(entry => entry.morning);
  const hasEvening = dayEntries.some(entry => !entry.morning);
  
  return hasMorning && hasEvening;
}
