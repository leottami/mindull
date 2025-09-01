/**
 * Gratitude Service
 * Upsert-Operationen für morgens/abends Dankbarkeits-Einträge
 */

import { supabase } from './supabase.client';
import { 
  GratitudeEntry, 
  CreateGratitudeEntry, 
  UpdateGratitudeEntry,
  GratitudeEntryResponse,
  DailyGratitude 
} from '../../models/gratitude.model';
import { 
  mapToGratitudeEntry, 
  mapFromCreateGratitudeEntry, 
  mapFromUpdateGratitudeEntry,
  mapToGratitudeEntryResponse,
  groupGratitudeByDay 
} from './mappers';
import { createDBError, DBErrorCode, mapSupabaseError, logDBError } from './errors';

/**
 * Upsert-Parameter für Gratitude-Einträge
 */
export interface GratitudeUpsertParams {
  userId: string;
  date: string; // YYYY-MM-DD
  morning: boolean;
  text: string;
}

/**
 * Pagination-Parameter
 */
export interface PaginationParams {
  cursor?: string; // ISO timestamp für cursor-based pagination
  page?: number;   // 1-basiert für page-based pagination
  limit?: number;  // Anzahl Einträge pro Seite (max 100)
}

/**
 * Paginierte Antwort
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
  };
}

/**
 * Gratitude Service Klasse
 */
export class GratitudeService {
  private static readonly TABLE_NAME = 'gratitude_entries';
  private static readonly MAX_LIMIT = 100;
  private static readonly DEFAULT_LIMIT = 20;

  /**
   * Holt einen Gratitude-Eintrag nach Datum und Typ (morgens/abends)
   */
  static async getByDate(
    date: string, 
    userId: string, 
    morning: boolean
  ): Promise<GratitudeEntry | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('morning', morning)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Nicht gefunden
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToGratitudeEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt beide Einträge (morgens + abends) für ein Datum
   */
  static async getByDateFull(
    date: string, 
    userId: string
  ): Promise<DailyGratitude> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .is('deleted_at', null)
        .order('morning', { ascending: false }); // Morgens zuerst

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const entries = data?.map(mapToGratitudeEntry) || [];
      const grouped = groupGratitudeByDay(entries);
      
      return grouped.find(day => day.date === date) || {
        date,
        morning: undefined,
        evening: undefined
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Upsert für Gratitude-Einträge (Insert oder Update)
   * Verwendet ON CONFLICT für atomische Upsert-Operation
   */
  static async upsert(params: GratitudeUpsertParams): Promise<GratitudeEntry> {
    try {
      const dbData = mapFromCreateGratitudeEntry({
        userId: params.userId,
        date: params.date,
        morning: params.morning,
        text: params.text
      });

      // Prüfe ob Eintrag bereits existiert
      const existing = await this.getByDate(params.date, params.userId, params.morning);
      
      if (existing) {
        // Update existierenden Eintrag
        const updateData = mapFromUpdateGratitudeEntry({
          text: params.text
        });
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from(this.TABLE_NAME)
          .update(updateData)
          .eq('id', existing.id)
          .eq('user_id', params.userId)
          .is('deleted_at', null)
          .select()
          .single();

        if (error) {
          const dbError = mapSupabaseError(error);
          logDBError(dbError);
          throw new Error(dbError.message);
        }

        return mapToGratitudeEntry(data);
      } else {
        // Erstelle neuen Eintrag
        const { data, error } = await supabase
          .from(this.TABLE_NAME)
          .insert(dbData)
          .select()
          .single();

        if (error) {
          const dbError = mapSupabaseError(error);
          logDBError(dbError);
          throw new Error(dbError.message);
        }

        return mapToGratitudeEntry(data);
      }
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        throw new Error('Eintrag für diesen Tag und Zeitpunkt existiert bereits');
      }
      throw error;
    }
  }

  /**
   * Atomischer Upsert mit ON CONFLICT (PostgreSQL-spezifisch)
   * Fallback für bessere Performance bei hoher Last
   */
  static async upsertAtomic(params: GratitudeUpsertParams): Promise<GratitudeEntry> {
    try {
      const dbData = mapFromCreateGratitudeEntry({
        userId: params.userId,
        date: params.date,
        morning: params.morning,
        text: params.text
      });
      dbData.updated_at = new Date().toISOString();

      // Verwende RPC für atomischen Upsert
      const { data, error } = await supabase.rpc('upsert_gratitude_entry', {
        p_user_id: params.userId,
        p_date: params.date,
        p_morning: params.morning,
        p_text: params.text,
        p_updated_at: dbData.updated_at
      });

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToGratitudeEntry(data);
    } catch (error: any) {
      // Fallback zu normalem Upsert bei RPC-Fehler
      return this.upsert(params);
    }
  }

  /**
   * Soft-Delete für einen spezifischen Tag und Zeitpunkt
   */
  static async softDeleteByDate(
    date: string, 
    userId: string, 
    morning: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', date)
        .eq('morning', morning)
        .is('deleted_at', null);

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Soft-Delete für beide Einträge eines Tages
   */
  static async softDeleteByDateFull(
    date: string, 
    userId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', date)
        .is('deleted_at', null);

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt paginierte Gratitude-Einträge
   */
  static async list(
    userId: string, 
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<GratitudeEntry>> {
    try {
      const limit = Math.min(params.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
      
      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('morning', { ascending: false })
        .order('created_at', { ascending: false });

      // Cursor-based pagination
      if (params.cursor) {
        query = query.lt('created_at', params.cursor);
      }
      // Page-based pagination
      else if (params.page && params.page > 1) {
        const offset = (params.page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }
      // Erste Seite
      else {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const entries = data?.map(mapToGratitudeEntry) || [];
      
      // Pagination-Metadaten
      const hasMore = entries.length === limit;
      const nextCursor = hasMore ? entries[entries.length - 1]?.createdAt : undefined;
      
      let pagination: PaginatedResponse<GratitudeEntry>['pagination'] = {
        hasMore,
        nextCursor
      };

      // Page-based Metadaten
      if (params.page && count !== null) {
        const totalPages = Math.ceil(count / limit);
        pagination = {
          ...pagination,
          totalCount: count,
          currentPage: params.page,
          totalPages
        };
      }

      return {
        data: entries,
        pagination
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt paginierte tägliche Gratitude-Übersichten
   */
  static async listDaily(
    userId: string, 
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<DailyGratitude>> {
    try {
      const entriesResponse = await this.list(userId, params);
      const grouped = groupGratitudeByDay(entriesResponse.data);
      
      return {
        data: grouped,
        pagination: entriesResponse.pagination
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Aktualisiert einen existierenden Gratitude-Eintrag
   */
  static async update(
    id: string, 
    userId: string, 
    updates: UpdateGratitudeEntry
  ): Promise<GratitudeEntry> {
    try {
      const dbUpdates = mapFromUpdateGratitudeEntry(updates);
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Eintrag nicht gefunden');
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToGratitudeEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Statistiken für Gratitude-Einträge
   */
  static async getStats(userId: string): Promise<{
    totalEntries: number;
    totalDays: number;
    completeDays: number;
    completionRate: number;
    averageWordsPerEntry: number;
    entriesThisMonth: number;
    currentStreak: number;
  }> {
    try {
      // Alle Einträge für Statistiken
      const { data: entries, error } = await supabase
        .from(this.TABLE_NAME)
        .select('text, date, morning')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const gratitudeEntries = entries?.map(mapToGratitudeEntry) || [];
      
      // Gruppiere nach Tagen
      const dailyEntries = new Map<string, GratitudeEntry[]>();
      gratitudeEntries.forEach(entry => {
        if (!dailyEntries.has(entry.date)) {
          dailyEntries.set(entry.date, []);
        }
        dailyEntries.get(entry.date)!.push(entry);
      });

      // Berechne Statistiken
      const totalEntries = gratitudeEntries.length;
      const totalDays = dailyEntries.size;
      const completeDays = Array.from(dailyEntries.values()).filter(
        dayEntries => dayEntries.length === 2
      ).length;
      const completionRate = totalDays > 0 ? (completeDays / totalDays) * 100 : 0;

      // Wörter zählen
      const totalWords = gratitudeEntries.reduce((sum, entry) => {
        return sum + (entry.text?.split(/\s+/).length || 0);
      }, 0);
      const averageWordsPerEntry = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;

      // Einträge diesen Monat
      const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const entriesThisMonth = gratitudeEntries.filter(entry => 
        entry.date?.startsWith(thisMonth)
      ).length;

      // Aktuelle Streak berechnen
      const sortedDates = Array.from(dailyEntries.keys()).sort().reverse();
      let currentStreak = 0;
      const today = new Date().toISOString().slice(0, 10);
      
      for (const date of sortedDates) {
        const dayEntries = dailyEntries.get(date)!;
        if (dayEntries.length >= 1) { // Mindestens ein Eintrag pro Tag
          currentStreak++;
        } else {
          break;
        }
      }

      return {
        totalEntries,
        totalDays,
        completeDays,
        completionRate,
        averageWordsPerEntry,
        entriesThisMonth,
        currentStreak
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Prüft ob ein Eintrag für heute erstellt werden kann
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
