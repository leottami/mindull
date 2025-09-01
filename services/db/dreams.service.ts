/**
 * Dreams Service (Phase 2 ready)
 * CRUD-Operationen und FTS-Suche über title+content+tags
 */

import { supabase } from './supabase.client';
import {
  DreamEntry,
  CreateDreamEntry,
  UpdateDreamEntry
} from '../../models/dream.model';
import {
  mapToDreamEntry,
  mapFromCreateDreamEntry,
  mapFromUpdateDreamEntry
} from './mappers';
import { mapSupabaseError, logDBError } from './errors';

/**
 * Pagination-Parameter
 */
export interface PaginationParams {
  cursor?: string; // ISO timestamp für cursor-based pagination (created_at)
  page?: number;   // 1-basiert für page-based pagination
  limit?: number;  // Anzahl Einträge pro Seite (max 100)
}

/**
 * Such-Parameter für Dreams (FTS + optionale Filter)
 */
export interface DreamSearchParams {
  userId: string;
  query?: string; // Volltextsuche
  dateRange?: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  tags?: string[]; // optionaler Tags-Filter
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

export class DreamsService {
  private static readonly TABLE_NAME = 'dream_entries';
  private static readonly MAX_LIMIT = 100;
  private static readonly DEFAULT_LIMIT = 20;

  /**
   * Erstellt einen neuen Dream-Entry
   */
  static async create(entry: CreateDreamEntry): Promise<DreamEntry> {
    try {
      const dbData = mapFromCreateDreamEntry(entry);

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert(dbData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || String(error.message || '').includes('duplicate')) {
          throw new Error('Traumeintrag für dieses Datum existiert bereits');
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToDreamEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt einen Dream-Entry nach ID
   */
  static async getById(id: string, userId: string): Promise<DreamEntry | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Nicht gefunden
        }
        const dbError = mapSupabaseError(error);
        logDBError(dbError);
        throw new Error(dbError.message);
      }

      return mapToDreamEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Holt Dream-Entries mit Pagination (neueste zuerst nach date, dann created_at)
   */
  static async list(
    userId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResponse<DreamEntry>> {
    try {
      const limit = Math.min(params.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Cursor-based pagination (created_at)
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

      const entries = data?.map(mapToDreamEntry) || [];

      const hasMore = entries.length === limit;
      const nextCursor = hasMore ? entries[entries.length - 1]?.createdAt : undefined;

      let pagination: PaginatedResponse<DreamEntry>['pagination'] = {
        hasMore,
        nextCursor
      };

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
   * Aktualisiert einen Dream-Entry
   */
  static async update(
    id: string,
    userId: string,
    updates: UpdateDreamEntry
  ): Promise<DreamEntry> {
    try {
      const dbUpdates = mapFromUpdateDreamEntry(updates);
      (dbUpdates as any).updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
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

      return mapToDreamEntry(data);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Löscht einen Dream-Entry (hard delete)
   */
  static async delete(id: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

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
   * FTS-Suche über fts (tsvector) + optionale Tags/Date-Filter
   */
  static async search(
    params: DreamSearchParams,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<DreamEntry>> {
    try {
      const limit = Math.min(pagination.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

      let query = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' })
        .eq('user_id', params.userId);

      // FTS über tsvector-Spalte `fts` (muss in DB existieren)
      if (params.query?.trim()) {
        query = query.textSearch('fts', params.query.trim(), {
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

      // Tags-Filter (optional)
      if (params.tags && params.tags.length > 0) {
        query = query.overlaps('tags', params.tags);
      }

      // Sortierung: Neueste zuerst
      query = query.order('date', { ascending: false })
                   .order('created_at', { ascending: false });

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

      const entries = data?.map(mapToDreamEntry) || [];

      const hasMore = entries.length === limit;
      const nextCursor = hasMore ? entries[entries.length - 1]?.createdAt : undefined;

      let paginationMeta: PaginatedResponse<DreamEntry>['pagination'] = {
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
}
