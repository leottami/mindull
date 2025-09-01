/**
 * Diary/Journal Entry Model
 * Tägliche Journal-Einträge mit Tags
 */

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  text: string;
  tags: string[];
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

/**
 * Diary-Entry für Erstellung
 */
export interface CreateDiaryEntry {
  userId: string;
  date: string; // YYYY-MM-DD format
  text: string;
  tags?: string[];
}

/**
 * Diary-Entry für Updates
 */
export interface UpdateDiaryEntry {
  text?: string;
  tags?: string[];
}

/**
 * Diary-Entry für API-Responses (ohne userId)
 */
export interface DiaryEntryResponse {
  id: string;
  date: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Validierung für Diary-Entries
 */
export class DiaryValidator {
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
    return trimmedText.length > 0 && trimmedText.length <= 10000; // Max 10k Zeichen
  }
  
  /**
   * Validiert Tags
   */
  static isValidTags(tags: string[]): boolean {
    if (!Array.isArray(tags)) return false;
    
    return tags.every(tag => {
      const trimmedTag = tag.trim();
      return trimmedTag.length > 0 && 
             trimmedTag.length <= 50 && 
             /^[a-zA-Z0-9äöüßÄÖÜ\s\-_]+$/.test(trimmedTag);
    });
  }
  
  /**
   * Validiert kompletten Diary-Entry
   */
  static validateEntry(entry: DiaryEntry): string[] {
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
    
    if (!this.isValidText(entry.text)) {
      errors.push('Text ist erforderlich und darf maximal 10.000 Zeichen haben');
    }
    
    if (!this.isValidTags(entry.tags)) {
      errors.push('Ungültige Tags (nur alphanumerische Zeichen, Leerzeichen, - und _ erlaubt)');
    }
    
    return errors;
  }
  
  /**
   * Validiert CreateDiaryEntry
   */
  static validateCreateEntry(entry: CreateDiaryEntry): string[] {
    const errors: string[] = [];
    
    if (!entry.userId || typeof entry.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidDate(entry.date)) {
      errors.push('Ungültiges Datum-Format (YYYY-MM-DD erforderlich)');
    }
    
    if (!this.isValidText(entry.text)) {
      errors.push('Text ist erforderlich und darf maximal 10.000 Zeichen haben');
    }
    
    if (entry.tags && !this.isValidTags(entry.tags)) {
      errors.push('Ungültige Tags (nur alphanumerische Zeichen, Leerzeichen, - und _ erlaubt)');
    }
    
    return errors;
  }
  
  /**
   * Validiert UpdateDiaryEntry
   */
  static validateUpdateEntry(entry: UpdateDiaryEntry): string[] {
    const errors: string[] = [];
    
    if (entry.text !== undefined && !this.isValidText(entry.text)) {
      errors.push('Text darf maximal 10.000 Zeichen haben');
    }
    
    if (entry.tags !== undefined && !this.isValidTags(entry.tags)) {
      errors.push('Ungültige Tags (nur alphanumerische Zeichen, Leerzeichen, - und _ erlaubt)');
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
}

/**
 * Normalisiert Tags (trimmen, deduplizieren, sortieren)
 */
export function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  
  return [...new Set(
    tags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.toLowerCase())
  )].sort();
}

/**
 * Erstellt einen neuen Diary-Entry mit normalisierten Daten
 */
export function createDiaryEntry(data: CreateDiaryEntry): CreateDiaryEntry {
  return {
    userId: data.userId,
    date: data.date,
    text: data.text.trim(),
    tags: normalizeTags(data.tags || [])
  };
}

/**
 * Konvertiert Diary-Entry zu Response-Format
 */
export function toDiaryEntryResponse(entry: DiaryEntry): DiaryEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    text: entry.text,
    tags: entry.tags,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}
