/**
 * Dream Entry Model (Phase 2)
 * Traumtagebuch für luzides Träumen
 */

export interface DreamEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  title: string;
  content: string;
  lucidity: boolean; // Luzider Traum?
  recall: number; // 1-5 Skala
  tags: string[];
  createdAt: string; // ISO-UTC timestamp
  updatedAt: string; // ISO-UTC timestamp
}

/**
 * Dream-Entry für Erstellung
 */
export interface CreateDreamEntry {
  userId: string;
  date: string; // YYYY-MM-DD format
  title: string;
  content: string;
  lucidity: boolean;
  recall: number;
  tags?: string[];
}

/**
 * Dream-Entry für Updates
 */
export interface UpdateDreamEntry {
  title?: string;
  content?: string;
  lucidity?: boolean;
  recall?: number;
  tags?: string[];
}

/**
 * Dream-Entry für API-Responses (ohne userId)
 */
export interface DreamEntryResponse {
  id: string;
  date: string;
  title: string;
  content: string;
  lucidity: boolean;
  recall: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Reality-Check Event
 */
export interface RealityCheckEvent {
  id: string;
  userId: string;
  timestamp: string; // ISO-UTC timestamp
  location?: string; // GPS oder manueller Ort
  trigger?: string; // Was hat den RC ausgelöst
  lucidityDetected: boolean; // Wurde Luzidität erkannt?
  notes?: string;
  createdAt: string;
}

/**
 * Validierung für Dream-Entries
 */
export class DreamValidator {
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
   * Validiert Titel-Länge
   */
  static isValidTitle(title: string): boolean {
    const trimmedTitle = title.trim();
    return trimmedTitle.length > 0 && trimmedTitle.length <= 200;
  }
  
  /**
   * Validiert Content-Länge
   */
  static isValidContent(content: string): boolean {
    const trimmedContent = content.trim();
    return trimmedContent.length > 0 && trimmedContent.length <= 5000; // Max 5k Zeichen
  }
  
  /**
   * Validiert Recall-Skala (1-5)
   */
  static isValidRecall(recall: number): boolean {
    return Number.isInteger(recall) && recall >= 1 && recall <= 5;
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
   * Validiert kompletten Dream-Entry
   */
  static validateEntry(entry: DreamEntry): string[] {
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
    
    if (!this.isValidTitle(entry.title)) {
      errors.push('Titel ist erforderlich und darf maximal 200 Zeichen haben');
    }
    
    if (!this.isValidContent(entry.content)) {
      errors.push('Content ist erforderlich und darf maximal 5.000 Zeichen haben');
    }
    
    if (typeof entry.lucidity !== 'boolean') {
      errors.push('Lucidity-Flag muss boolean sein');
    }
    
    if (!this.isValidRecall(entry.recall)) {
      errors.push('Recall muss zwischen 1 und 5 liegen');
    }
    
    if (!this.isValidTags(entry.tags)) {
      errors.push('Ungültige Tags (nur alphanumerische Zeichen, Leerzeichen, - und _ erlaubt)');
    }
    
    return errors;
  }
  
  /**
   * Validiert CreateDreamEntry
   */
  static validateCreateEntry(entry: CreateDreamEntry): string[] {
    const errors: string[] = [];
    
    if (!entry.userId || typeof entry.userId !== 'string') {
      errors.push('User-ID ist erforderlich und muss ein String sein');
    }
    
    if (!this.isValidDate(entry.date)) {
      errors.push('Ungültiges Datum-Format (YYYY-MM-DD erforderlich)');
    }
    
    if (!this.isValidTitle(entry.title)) {
      errors.push('Titel ist erforderlich und darf maximal 200 Zeichen haben');
    }
    
    if (!this.isValidContent(entry.content)) {
      errors.push('Content ist erforderlich und darf maximal 5.000 Zeichen haben');
    }
    
    if (typeof entry.lucidity !== 'boolean') {
      errors.push('Lucidity-Flag muss boolean sein');
    }
    
    if (!this.isValidRecall(entry.recall)) {
      errors.push('Recall muss zwischen 1 und 5 liegen');
    }
    
    if (entry.tags && !this.isValidTags(entry.tags)) {
      errors.push('Ungültige Tags (nur alphanumerische Zeichen, Leerzeichen, - und _ erlaubt)');
    }
    
    return errors;
  }
  
  /**
   * Validiert UpdateDreamEntry
   */
  static validateUpdateEntry(entry: UpdateDreamEntry): string[] {
    const errors: string[] = [];
    
    if (entry.title !== undefined && !this.isValidTitle(entry.title)) {
      errors.push('Titel darf maximal 200 Zeichen haben');
    }
    
    if (entry.content !== undefined && !this.isValidContent(entry.content)) {
      errors.push('Content darf maximal 5.000 Zeichen haben');
    }
    
    if (entry.recall !== undefined && !this.isValidRecall(entry.recall)) {
      errors.push('Recall muss zwischen 1 und 5 liegen');
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
   * Prüft ob ein Datum zu alt ist (älter als 2 Jahre)
   */
  static isTooOldDate(date: string): boolean {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const twoYearsAgoStr = twoYearsAgo.toISOString().slice(0, 10);
    return date < twoYearsAgoStr;
  }
}

/**
 * Recall-Skala-Beschreibungen
 */
export const RECALL_DESCRIPTIONS: Record<number, string> = {
  1: 'Sehr vage - nur Fragmente erinnerlich',
  2: 'Vage - grobe Handlung erinnerlich',
  3: 'Mittel - Handlung und Details erinnerlich',
  4: 'Gut - detaillierte Erinnerung',
  5: 'Sehr gut - vollständige, lebendige Erinnerung'
};

/**
 * Normalisiert Tags (trimmen, deduplizieren, sortieren)
 */
export function normalizeDreamTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  
  return [...new Set(
    tags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.toLowerCase())
  )].sort();
}

/**
 * Erstellt einen neuen Dream-Entry mit normalisierten Daten
 */
export function createDreamEntry(data: CreateDreamEntry): CreateDreamEntry {
  return {
    userId: data.userId,
    date: data.date,
    title: data.title.trim(),
    content: data.content.trim(),
    lucidity: data.lucidity,
    recall: data.recall,
    tags: normalizeDreamTags(data.tags || [])
  };
}

/**
 * Konvertiert Dream-Entry zu Response-Format
 */
export function toDreamEntryResponse(entry: DreamEntry): DreamEntryResponse {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    lucidity: entry.lucidity,
    recall: entry.recall,
    tags: entry.tags,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

/**
 * Gruppiert Dream-Entries nach Monaten
 */
export function groupDreamsByMonth(entries: DreamEntry[]): Map<string, DreamEntry[]> {
  const grouped = new Map<string, DreamEntry[]>();
  
  entries.forEach(entry => {
    const month = entry.date.slice(0, 7); // YYYY-MM
    if (!grouped.has(month)) {
      grouped.set(month, []);
    }
    grouped.get(month)!.push(entry);
  });
  
  return grouped;
}

/**
 * Berechnet Dream-Statistiken
 */
export function calculateDreamStats(entries: DreamEntry[]) {
  const lucidDreams = entries.filter(e => e.lucidity);
  const totalRecall = entries.reduce((sum, e) => sum + e.recall, 0);
  const tagCounts = new Map<string, number>();
  
  entries.forEach(entry => {
    entry.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  return {
    totalDreams: entries.length,
    lucidDreams: lucidDreams.length,
    lucidityRate: entries.length > 0 ? (lucidDreams.length / entries.length) * 100 : 0,
    averageRecall: entries.length > 0 ? Math.round((totalRecall / entries.length) * 10) / 10 : 0,
    topTags: Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
  };
}
