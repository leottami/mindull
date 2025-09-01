/**
 * React Query Hooks für Diary-Operationen
 * Mit Optimistic Updates und Rollback-Funktionalität
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { DiaryService, PaginationParams, SearchParams, PaginatedResponse } from '../services/db/diary.service';
import { 
  DiaryEntry, 
  CreateDiaryEntry, 
  UpdateDiaryEntry,
  DiaryEntryResponse 
} from '../models/diary.model';
import { queryKeys, mutationKeys, invalidateListQueries, invalidateDetailQueries } from './queryKeys';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook für paginierte Diary-Liste
 */
export function useDiaryList(
  userId: string,
  params: PaginationParams = {},
  options?: UseQueryOptions<PaginatedResponse<DiaryEntry>>
) {
  return useQuery({
    queryKey: queryKeys.diary.list(userId, params),
    queryFn: () => DiaryService.list(userId, params),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 10 * 60 * 1000,   // 10 Minuten
    ...options
  });
}

/**
 * Hook für einzelnen Diary-Eintrag
 */
export function useDiaryEntry(
  id: string,
  userId: string,
  options?: UseQueryOptions<DiaryEntry | null>
) {
  return useQuery({
    queryKey: queryKeys.diary.detail(id, userId),
    queryFn: () => DiaryService.getById(id, userId),
    staleTime: 10 * 60 * 1000, // 10 Minuten
    gcTime: 30 * 60 * 1000,    // 30 Minuten
    enabled: !!id && !!userId,
    ...options
  });
}

/**
 * Hook für Diary-Eintrag nach Datum
 */
export function useDiaryByDate(
  date: string,
  userId: string,
  options?: UseQueryOptions<DiaryEntry | null>
) {
  return useQuery({
    queryKey: queryKeys.diary.byDate(date, userId),
    queryFn: () => DiaryService.getByDate(date, userId),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    enabled: !!date && !!userId,
    ...options
  });
}

/**
 * Hook für Diary-Suche
 */
export function useDiarySearch(
  params: SearchParams,
  pagination: PaginationParams = {},
  options?: UseQueryOptions<PaginatedResponse<DiaryEntry>>
) {
  return useQuery({
    queryKey: queryKeys.diary.search(params),
    queryFn: () => DiaryService.search(params, pagination),
    staleTime: 2 * 60 * 1000, // 2 Minuten
    gcTime: 5 * 60 * 1000,    // 5 Minuten
    enabled: !!params.userId,
    ...options
  });
}

/**
 * Hook für Diary-Tags
 */
export function useDiaryTags(
  userId: string,
  options?: UseQueryOptions<string[]>
) {
  return useQuery({
    queryKey: queryKeys.diary.tags(userId),
    queryFn: () => DiaryService.getTags(userId),
    staleTime: 30 * 60 * 1000, // 30 Minuten
    gcTime: 60 * 60 * 1000,    // 1 Stunde
    enabled: !!userId,
    ...options
  });
}

/**
 * Hook für Diary-Statistiken
 */
export function useDiaryStats(
  userId: string,
  options?: UseQueryOptions<{
    totalEntries: number;
    totalWords: number;
    averageWordsPerEntry: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
    entriesThisMonth: number;
  }>
) {
  return useQuery({
    queryKey: queryKeys.diary.stats(userId),
    queryFn: () => DiaryService.getStats(userId),
    staleTime: 15 * 60 * 1000, // 15 Minuten
    gcTime: 30 * 60 * 1000,    // 30 Minuten
    enabled: !!userId,
    ...options
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook für Diary-Eintrag erstellen
 */
export function useCreateDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.diary.create(),
    mutationFn: (entry: CreateDiaryEntry) => DiaryService.create(entry),
    onSuccess: (newEntry, variables) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'diary', variables.userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.diary.stats(variables.userId)
      });
      
      // Invalidiere Tags
      queryClient.invalidateQueries({
        queryKey: queryKeys.diary.tags(variables.userId)
      });
      
      // Setze neuen Eintrag in Cache
      queryClient.setQueryData(
        queryKeys.diary.detail(newEntry.id, variables.userId),
        newEntry
      );
      
      // Setze Eintrag nach Datum in Cache
      queryClient.setQueryData(
        queryKeys.diary.byDate(variables.date, variables.userId),
        newEntry
      );
    },
    onError: (error, variables) => {
      console.error('Fehler beim Erstellen des Diary-Eintrags:', error);
    }
  });
}

/**
 * Hook für Diary-Eintrag aktualisieren
 */
export function useUpdateDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId, updates }: { 
      id: string; 
      userId: string; 
      updates: UpdateDiaryEntry 
    }) => DiaryService.update(id, userId, updates),
    onMutate: async ({ id, userId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.diary.detail(id, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousEntry = queryClient.getQueryData<DiaryEntry>(
        queryKeys.diary.detail(id, userId)
      );

      // Optimistic Update
      if (previousEntry) {
        const optimisticEntry: DiaryEntry = {
          ...previousEntry,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        queryClient.setQueryData(
          queryKeys.diary.detail(id, userId),
          optimisticEntry
        );

        // Update auch in Listen
        queryClient.setQueriesData(
          { queryKey: queryKeys.diary.lists() },
          (old: PaginatedResponse<DiaryEntry> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(entry => 
                entry.id === id ? optimisticEntry : entry
              )
            };
          }
        );
      }

      return { previousEntry };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Aktualisieren des Diary-Eintrags:', error);
      
      // Rollback bei Fehler
      if (context?.previousEntry) {
        queryClient.setQueryData(
          queryKeys.diary.detail(id, userId),
          context.previousEntry
        );
      }
    },
    onSuccess: (updatedEntry, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'diary', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.diary.stats(userId)
      });
      
      // Update Cache mit aktualisierten Daten
      queryClient.setQueryData(
        queryKeys.diary.detail(updatedEntry.id, userId),
        updatedEntry
      );
    },
    onSettled: (data, error, { id, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.diary.detail(id, userId)
        });
      }
    }
  });
}

/**
 * Hook für Diary-Eintrag löschen
 */
export function useDeleteDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => 
      DiaryService.delete(id, userId),
    onMutate: async ({ id, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.diary.detail(id, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousEntry = queryClient.getQueryData<DiaryEntry>(
        queryKeys.diary.detail(id, userId)
      );

      // Optimistic Update - entferne aus Listen
      queryClient.setQueriesData(
        { queryKey: queryKeys.diary.lists() },
        (old: PaginatedResponse<DiaryEntry> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(entry => entry.id !== id)
          };
        }
      );

      // Entferne aus Detail-Cache
      queryClient.removeQueries({
        queryKey: queryKeys.diary.detail(id, userId)
      });

      return { previousEntry };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Löschen des Diary-Eintrags:', error);
      
      // Rollback bei Fehler
      if (context?.previousEntry) {
        queryClient.setQueryData(
          queryKeys.diary.detail(id, userId),
          context.previousEntry
        );
      }
    },
    onSuccess: (data, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'diary', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.diary.stats(userId)
      });
      
      // Invalidiere Tags
      queryClient.invalidateQueries({
        queryKey: queryKeys.diary.tags(userId)
      });
    },
    onSettled: (data, error, { id, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.diary.detail(id, userId)
        });
      }
    }
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook für Infinite Scroll Diary-Liste
 */
export function useInfiniteDiaryList(
  userId: string,
  limit: number = 20
) {
  return useQuery({
    queryKey: queryKeys.diary.list(userId, { limit }),
    queryFn: ({ pageParam }: { pageParam?: string }) => 
      DiaryService.list(userId, { 
        cursor: pageParam, 
        limit 
      }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId
  });
}

/**
 * Hook für Diary-Einträge mit automatischer Aktualisierung
 */
export function useDiaryWithAutoRefresh(
  userId: string,
  params: PaginationParams = {},
  refreshInterval: number = 30000 // 30 Sekunden
) {
  return useQuery({
    queryKey: queryKeys.diary.list(userId, params),
    queryFn: () => DiaryService.list(userId, params),
    staleTime: 1 * 60 * 1000, // 1 Minute
    gcTime: 5 * 60 * 1000,    // 5 Minuten
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
    enabled: !!userId
  });
}

/**
 * Hook für Diary-Suche mit Debouncing
 */
export function useDebouncedDiarySearch(
  params: SearchParams,
  pagination: PaginationParams = {},
  debounceMs: number = 300
) {
  return useQuery({
    queryKey: queryKeys.diary.search(params),
    queryFn: () => DiaryService.search(params, pagination),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!params.userId && !!params.query?.trim(),
    refetchOnWindowFocus: false,
    retry: false
  });
}
