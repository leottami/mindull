/**
 * Diary Service
 * CRUD-Operationen für Journal-Einträge mit Pagination und Volltextsuche
 */

import { supabase } from './supabase.client';
import { 
  DiaryEntry, 
  CreateDiaryEntry, 
  UpdateDiaryEntry,
  DiaryEntryResponse 
} from '../../models/diary.model';
import { 
  mapToDiaryEntry, 
  mapFromCreateDiaryEntry, 
  mapFromUpdateDiaryEntry,
  mapToDiaryEntryResponse 
} from './mappers';
import { createDBError, DBErrorCode, mapSupabaseError, logDBError } from './errors';

/**
 * Pagination-Parameter
 */
export interface PaginationParams {
  cursor?: string; // ISO timestamp für cursor-based pagination
  page?: number;   // 1-basiert für page-based pagination
  limit?: number;  // Anzahl Einträge pro Seite (max 100)
}

/**
 * Such-Parameter
 */
export interface SearchParams {
  query?: string;           // Volltextsuche
  dateRange?: {             // Datumsbereich
    start: string;          // YYYY-MM-DD
    end: string;           // YYYY-MM-DD
  };
  tags?: string[];          // Tag-Filter
  userId: string;           // Benutzer-ID (erforderlich)
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
 * Diary Service Klasse
 */
export class DiaryService {
  private static readonly TABLE_NAME = 'diary_entries';
  private static readonly MAX_LIMIT = 100;
  private static readonly DEFAULT_LIMIT = 20;

  /**
   * Erstellt einen neuen Diary-Eintrag
   */
  static async create(entry: CreateDiaryEntry): Promise<DiaryEntry> {
    try {
      const dbData = mapFromCreateDiaryEntry(entry);
      
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

      return mapToDiaryEntry(data);
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        throw new Error('Eintrag für dieses Datum existiert bereits');
      }
      throw error;
    }
  }

  /**
   * Holt einen Diary-Eintrag nach ID
   */
  static async getById(id: string, userId: string): Promise<DiaryEntry | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
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

      return mapToDiaryEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt Diary-Einträge mit Pagination
   */
  static async list(
    userId: string, 
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<DiaryEntry>> {
    try {
      const limit = Math.min(params.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
      
      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
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

      const entries = data?.map(mapToDiaryEntry) || [];
      
      // Pagination-Metadaten
      const hasMore = entries.length === limit;
      const nextCursor = hasMore ? entries[entries.length - 1]?.createdAt : undefined;
      
      let pagination: PaginatedResponse<DiaryEntry>['pagination'] = {
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
   * Aktualisiert einen Diary-Eintrag
   */
  static async update(
    id: string, 
    userId: string, 
    updates: UpdateDiaryEntry
  ): Promise<DiaryEntry> {
    try {
      const dbUpdates = mapFromUpdateDiaryEntry(updates);
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

      return mapToDiaryEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Soft-Delete eines Diary-Eintrags
   */
  static async delete(id: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
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
   * Volltextsuche in Diary-Einträgen
   */
  static async search(
    params: SearchParams,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<DiaryEntry>> {
    try {
      const limit = Math.min(pagination.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
      
      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', params.userId)
        .is('deleted_at', null);

      // Volltextsuche
      if (params.query?.trim()) {
        query = query.textSearch('text', params.query.trim(), {
          type: 'websearch',
          config: 'german'
        });
      }

      // Datumsbereich
      if (params.dateRange) {
        query = query
          .gte('date', params.dateRange.start)
          .lte('date', params.dateRange.end);
      }

      // Tag-Filter
      if (params.tags && params.tags.length > 0) {
        query = query.overlaps('tags', params.tags);
      }

      // Sortierung nach Relevanz (bei Suche) oder Datum
      if (params.query?.trim()) {
        query = query.order('date', { ascending: false });
      } else {
        query = query.order('date', { ascending: false });
      }
      query = query.order('created_at', { ascending: false });

      // Pagination
      if (pagination.cursor) {
        query = query.lt('created_at', pagination.cursor);
      } else if (pagination.page && pagination.page > 1) {
        const offset = (pagination.page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      } else {
        query = query.limit(limit);
      }

      const { data, error, count } = await query;

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      const entries = data?.map(mapToDiaryEntry) || [];
      
      const hasMore = entries.length === limit;
      const nextCursor = hasMore ? entries[entries.length - 1]?.createdAt : undefined;
      
      let paginationMeta: PaginatedResponse<DiaryEntry>['pagination'] = {
        hasMore,
        nextCursor
      };

      if (pagination.page && count !== null) {
        const totalPages = Math.ceil(count / limit);
        paginationMeta = {
          ...paginationMeta,
          totalCount: count,
          currentPage: pagination.page,
          totalPages
        };
      }

      return {
        data: entries,
        pagination: paginationMeta
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt Einträge für ein spezifisches Datum
   */
  static async getByDate(date: string, userId: string): Promise<DiaryEntry | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToDiaryEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt alle Tags eines Benutzers
   */
  static async getTags(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('tags')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .not('tags', 'is', null);

      if (error) {
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      // Alle Tags sammeln und deduplizieren
      const allTags = new Set<string>();
      data?.forEach(row => {
        if (Array.isArray(row.tags)) {
          row.tags.forEach(tag => allTags.add(tag));
        }
      });

      return Array.from(allTags).sort();
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Statistiken für Diary-Einträge
   */
  static async getStats(userId: string): Promise<{
    totalEntries: number;
    totalWords: number;
    averageWordsPerEntry: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
    entriesThisMonth: number;
  }> {
    try {
      // Gesamte Einträge
      const { count: totalEntries, error: countError } = await supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (countError) {
        const dbError = mapSupabaseError(countError);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      // Alle Einträge für Statistiken
      const { data: entries, error: entriesError } = await supabase
        .from(this.TABLE_NAME)
        .select('text, tags, date')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (entriesError) {
        const dbError = mapSupabaseError(entriesError);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      // Wörter zählen
      const totalWords = entries?.reduce((sum, entry) => {
        return sum + (entry.text?.split(/\s+/).length || 0);
      }, 0) || 0;

      // Tags zählen
      const tagCounts = new Map<string, number>();
      entries?.forEach(entry => {
        if (Array.isArray(entry.tags)) {
          entry.tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      const mostUsedTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Einträge diesen Monat
      const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const entriesThisMonth = entries?.filter(entry => 
        entry.date?.startsWith(thisMonth)
      ).length || 0;

      return {
        totalEntries: totalEntries || 0,
        totalWords,
        averageWordsPerEntry: totalEntries ? Math.round(totalWords / totalEntries) : 0,
        mostUsedTags,
        entriesThisMonth
      };
    } catch (error: any) {
      throw error;
    }
  }
}
