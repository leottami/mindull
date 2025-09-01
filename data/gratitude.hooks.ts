/**
 * React Query Hooks für Gratitude-Operationen
 * Mit Optimistic Upsert und Rollback-Funktionalität
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { GratitudeService, PaginationParams, GratitudeUpsertParams } from '../services/db/gratitude.service';
import { 
  GratitudeEntry, 
  CreateGratitudeEntry, 
  UpdateGratitudeEntry,
  DailyGratitude 
} from '../models/gratitude.model';
import { queryKeys, mutationKeys, invalidateListQueries, invalidateDetailQueries } from './queryKeys';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook für Gratitude-Eintrag nach Datum und Typ
 */
export function useGratitudeByDate(
  date: string,
  userId: string,
  morning: boolean,
  options?: UseQueryOptions<GratitudeEntry | null>
) {
  return useQuery({
    queryKey: queryKeys.gratitude.byDate(date, userId),
    queryFn: () => GratitudeService.getByDate(date, userId, morning),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    enabled: !!date && !!userId,
    ...options
  });
}

/**
 * Hook für vollständige tägliche Gratitude-Übersicht
 */
export function useGratitudeByDateFull(
  date: string,
  userId: string,
  options?: UseQueryOptions<DailyGratitude>
) {
  return useQuery({
    queryKey: queryKeys.gratitude.byDay(date, userId),
    queryFn: () => GratitudeService.getByDateFull(date, userId),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    enabled: !!date && !!userId,
    ...options
  });
}

/**
 * Hook für paginierte Gratitude-Liste
 */
export function useGratitudeList(
  userId: string,
  params: PaginationParams = {},
  options?: UseQueryOptions<any>
) {
  return useQuery({
    queryKey: queryKeys.gratitude.list(userId, params),
    queryFn: () => GratitudeService.list(userId, params),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 10 * 60 * 1000,   // 10 Minuten
    ...options
  });
}

/**
 * Hook für paginierte tägliche Gratitude-Übersichten
 */
export function useGratitudeListDaily(
  userId: string,
  params: PaginationParams = {},
  options?: UseQueryOptions<any>
) {
  return useQuery({
    queryKey: [...queryKeys.gratitude.list(userId, params), 'daily'],
    queryFn: () => GratitudeService.listDaily(userId, params),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 10 * 60 * 1000,   // 10 Minuten
    ...options
  });
}

/**
 * Hook für Gratitude-Statistiken
 */
export function useGratitudeStats(
  userId: string,
  options?: UseQueryOptions<{
    totalEntries: number;
    totalDays: number;
    completeDays: number;
    completionRate: number;
    averageWordsPerEntry: number;
    entriesThisMonth: number;
    currentStreak: number;
  }>
) {
  return useQuery({
    queryKey: queryKeys.gratitude.stats(userId),
    queryFn: () => GratitudeService.getStats(userId),
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
 * Hook für Gratitude-Upsert (Optimistic)
 */
export function useGratitudeUpsert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GratitudeUpsertParams) => GratitudeService.upsert(params),
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.gratitude.byDay(params.date, params.userId)
      });

      // Snapshot des vorherigen Wertes
      const previousDay = queryClient.getQueryData<DailyGratitude>(
        queryKeys.gratitude.byDay(params.date, params.userId)
      );

      // Optimistic Update
      const optimisticEntry: GratitudeEntry = {
        id: `temp-${Date.now()}`,
        userId: params.userId,
        date: params.date,
        morning: params.morning,
        text: params.text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const optimisticDay: DailyGratitude = {
        date: params.date,
        morning: params.morning ? optimisticEntry : previousDay?.morning,
        evening: !params.morning ? optimisticEntry : previousDay?.evening
      };

      // Update Cache
      queryClient.setQueryData(
        queryKeys.gratitude.byDay(params.date, params.userId),
        optimisticDay
      );

      // Update auch in Listen
      queryClient.setQueriesData(
        { queryKey: queryKeys.gratitude.lists() },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((entry: GratitudeEntry) => 
              entry.date === params.date && entry.morning === params.morning 
                ? optimisticEntry 
                : entry
            )
          };
        }
      );

      return { previousDay, optimisticEntry };
    },
    onError: (error, params, context) => {
      console.error('Fehler beim Gratitude-Upsert:', error);
      
      // Rollback bei Fehler
      if (context?.previousDay) {
        queryClient.setQueryData(
          queryKeys.gratitude.byDay(params.date, params.userId),
          context.previousDay
        );
      }
    },
    onSuccess: (updatedEntry, params) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'gratitude', params.userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.gratitude.stats(params.userId)
      });
      
      // Update Cache mit echten Daten
      queryClient.setQueryData(
        queryKeys.gratitude.byDay(params.date, params.userId),
        (old: DailyGratitude | undefined) => {
          if (!old) return old;
          return {
            ...old,
            morning: params.morning ? updatedEntry : old.morning,
            evening: !params.morning ? updatedEntry : old.evening
          };
        }
      );
    },
    onSettled: (data, error, params) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.gratitude.byDay(params.date, params.userId)
        });
      }
    }
  });
}

/**
 * Hook für atomischen Gratitude-Upsert
 */
export function useGratitudeUpsertAtomic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GratitudeUpsertParams) => GratitudeService.upsertAtomic(params),
    onSuccess: (updatedEntry, params) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'gratitude', params.userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.gratitude.stats(params.userId)
      });
      
      // Update Cache
      queryClient.setQueryData(
        queryKeys.gratitude.byDay(params.date, params.userId),
        (old: DailyGratitude | undefined) => {
          if (!old) return old;
          return {
            ...old,
            morning: params.morning ? updatedEntry : old.morning,
            evening: !params.morning ? updatedEntry : old.evening
          };
        }
      );
    },
    onError: (error, params) => {
      console.error('Fehler beim atomischen Gratitude-Upsert:', error);
    }
  });
}

/**
 * Hook für Gratitude-Eintrag aktualisieren
 */
export function useUpdateGratitude() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId, updates }: { 
      id: string; 
      userId: string; 
      updates: UpdateGratitudeEntry 
    }) => GratitudeService.update(id, userId, updates),
    onMutate: async ({ id, userId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.gratitude.details()
      });

      // Snapshot des vorherigen Wertes
      const previousEntry = queryClient.getQueryData<GratitudeEntry>(
        queryKeys.gratitude.detail(id, userId)
      );

      // Optimistic Update
      if (previousEntry) {
        const optimisticEntry: GratitudeEntry = {
          ...previousEntry,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        queryClient.setQueryData(
          queryKeys.gratitude.detail(id, userId),
          optimisticEntry
        );

        // Update auch in Listen
        queryClient.setQueriesData(
          { queryKey: queryKeys.gratitude.lists() },
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map((entry: GratitudeEntry) => 
                entry.id === id ? optimisticEntry : entry
              )
            };
          }
        );
      }

      return { previousEntry };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Aktualisieren des Gratitude-Eintrags:', error);
      
      // Rollback bei Fehler
      if (context?.previousEntry) {
        queryClient.setQueryData(
          queryKeys.gratitude.detail(id, userId),
          context.previousEntry
        );
      }
    },
    onSuccess: (updatedEntry, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'gratitude', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.gratitude.stats(userId)
      });
      
      // Update Cache mit aktualisierten Daten
      queryClient.setQueryData(
        queryKeys.gratitude.detail(updatedEntry.id, userId),
        updatedEntry
      );
    },
    onSettled: (data, error, { id, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.gratitude.detail(id, userId)
        });
      }
    }
  });
}

/**
 * Hook für Gratitude-Eintrag löschen (Soft-Delete)
 */
export function useDeleteGratitude() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, userId, morning }: { 
      date: string; 
      userId: string; 
      morning: boolean 
    }) => GratitudeService.softDeleteByDate(date, userId, morning),
    onMutate: async ({ date, userId, morning }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.gratitude.byDay(date, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousDay = queryClient.getQueryData<DailyGratitude>(
        queryKeys.gratitude.byDay(date, userId)
      );

      // Optimistic Update - entferne Eintrag
      if (previousDay) {
        const optimisticDay: DailyGratitude = {
          ...previousDay,
          morning: morning ? undefined : previousDay.morning,
          evening: !morning ? undefined : previousDay.evening
        };

        queryClient.setQueryData(
          queryKeys.gratitude.byDay(date, userId),
          optimisticDay
        );
      }

      return { previousDay };
    },
    onError: (error, { date, userId }, context) => {
      console.error('Fehler beim Löschen des Gratitude-Eintrags:', error);
      
      // Rollback bei Fehler
      if (context?.previousDay) {
        queryClient.setQueryData(
          queryKeys.gratitude.byDay(date, userId),
          context.previousDay
        );
      }
    },
    onSuccess: (data, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'gratitude', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.gratitude.stats(userId)
      });
    },
    onSettled: (data, error, { date, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.gratitude.byDay(date, userId)
        });
      }
    }
  });
}

/**
 * Hook für vollständiges Löschen eines Tages
 */
export function useDeleteGratitudeDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, userId }: { 
      date: string; 
      userId: string 
    }) => GratitudeService.softDeleteByDateFull(date, userId),
    onMutate: async ({ date, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.gratitude.byDay(date, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousDay = queryClient.getQueryData<DailyGratitude>(
        queryKeys.gratitude.byDay(date, userId)
      );

      // Optimistic Update - entferne beide Einträge
      queryClient.setQueryData(
        queryKeys.gratitude.byDay(date, userId),
        {
          date,
          morning: undefined,
          evening: undefined
        }
      );

      return { previousDay };
    },
    onError: (error, { date, userId }, context) => {
      console.error('Fehler beim Löschen des Gratitude-Tages:', error);
      
      // Rollback bei Fehler
      if (context?.previousDay) {
        queryClient.setQueryData(
          queryKeys.gratitude.byDay(date, userId),
          context.previousDay
        );
      }
    },
    onSuccess: (data, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'gratitude', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.gratitude.stats(userId)
      });
    }
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook für Infinite Scroll Gratitude-Liste
 */
export function useInfiniteGratitudeList(
  userId: string,
  limit: number = 20
) {
  return useQuery({
    queryKey: queryKeys.gratitude.list(userId, { limit }),
    queryFn: ({ pageParam }: { pageParam?: string }) => 
      GratitudeService.list(userId, { 
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
 * Hook für Gratitude-Einträge mit automatischer Aktualisierung
 */
export function useGratitudeWithAutoRefresh(
  userId: string,
  params: PaginationParams = {},
  refreshInterval: number = 30000 // 30 Sekunden
) {
  return useQuery({
    queryKey: queryKeys.gratitude.list(userId, params),
    queryFn: () => GratitudeService.list(userId, params),
    staleTime: 1 * 60 * 1000, // 1 Minute
    gcTime: 5 * 60 * 1000,    // 5 Minuten
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
    enabled: !!userId
  });
}

/**
 * Hook für Offline-Retry von Gratitude-Upserts
 */
export function useGratitudeOfflineRetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GratitudeUpsertParams) => GratitudeService.upsert(params),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error, params) => {
      console.error('Offline-Retry fehlgeschlagen für Gratitude-Upsert:', error);
      
      // Speichere in Offline-Queue für späteren Retry
      const offlineQueue = queryClient.getQueryData(['offline-queue']) || [];
      queryClient.setQueryData(['offline-queue'], [
        ...offlineQueue,
        {
          type: 'gratitude-upsert',
          params,
          timestamp: new Date().toISOString()
        }
      ]);
    }
  });
}
