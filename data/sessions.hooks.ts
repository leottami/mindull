/**
 * React Query Hooks für Breathing-Sessions
 * Mit Optimistic Updates und Offline-Queue-Unterstützung
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { 
  BreathingSessionsService, 
  SessionRangeParams, 
  PaginationParams, 
  PaginatedResponse,
  SessionStats 
} from '../services/db/sessions.service';
import { 
  BreathingSession, 
  CreateBreathingSession, 
  UpdateBreathingSession 
} from '../models/session.model';
import { queryKeys, mutationKeys, invalidateListQueries, invalidateDetailQueries } from './queryKeys';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook für paginierte Sessions-Liste mit Range-Filtering
 */
export function useSessionsList(
  userId: string,
  rangeParams: SessionRangeParams = {},
  pagination: PaginationParams = {},
  options?: UseQueryOptions<PaginatedResponse<BreathingSession>>
) {
  return useQuery({
    queryKey: queryKeys.sessions.list(userId, rangeParams, pagination),
    queryFn: () => BreathingSessionsService.list(userId, rangeParams, pagination),
    staleTime: 3 * 60 * 1000, // 3 Minuten
    gcTime: 10 * 60 * 1000,   // 10 Minuten
    enabled: !!userId,
    ...options
  });
}

/**
 * Hook für einzelne Session
 */
export function useSession(
  id: string,
  userId: string,
  options?: UseQueryOptions<BreathingSession | null>
) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(id, userId),
    queryFn: () => BreathingSessionsService.getById(id, userId),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    enabled: !!id && !!userId,
    ...options
  });
}

/**
 * Hook für Sessions nach Datum
 */
export function useSessionsByDate(
  date: string,
  userId: string,
  options?: UseQueryOptions<BreathingSession[]>
) {
  return useQuery({
    queryKey: queryKeys.sessions.byDate(date, userId),
    queryFn: () => BreathingSessionsService.getByDate(date, userId),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    enabled: !!date && !!userId,
    ...options
  });
}

/**
 * Hook für neueste Session
 */
export function useLatestSession(
  userId: string,
  options?: UseQueryOptions<BreathingSession | null>
) {
  return useQuery({
    queryKey: queryKeys.sessions.latest(userId),
    queryFn: () => BreathingSessionsService.getLatest(userId),
    staleTime: 2 * 60 * 1000, // 2 Minuten
    gcTime: 10 * 60 * 1000,   // 10 Minuten
    enabled: !!userId,
    ...options
  });
}

/**
 * Hook für Session-Statistiken
 */
export function useSessionStats(
  userId: string,
  rangeParams: SessionRangeParams = {},
  options?: UseQueryOptions<SessionStats>
) {
  return useQuery({
    queryKey: queryKeys.sessions.stats(userId, rangeParams),
    queryFn: () => BreathingSessionsService.getStats(userId, rangeParams),
    staleTime: 10 * 60 * 1000, // 10 Minuten
    gcTime: 30 * 60 * 1000,    // 30 Minuten
    enabled: !!userId,
    ...options
  });
}

/**
 * Hook für verwendete Atem-Methoden
 */
export function useSessionMethods(
  userId: string,
  options?: UseQueryOptions<string[]>
) {
  return useQuery({
    queryKey: queryKeys.sessions.methods(userId),
    queryFn: () => BreathingSessionsService.getMethods(userId),
    staleTime: 30 * 60 * 1000, // 30 Minuten
    gcTime: 60 * 60 * 1000,    // 1 Stunde
    enabled: !!userId,
    ...options
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook für Session erstellen
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.sessions.create(),
    mutationFn: (session: CreateBreathingSession) => BreathingSessionsService.create(session),
    onSuccess: (newSession, variables) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'sessions', variables.userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.stats(variables.userId)
      });
      
      // Invalidiere Methoden
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.methods(variables.userId)
      });
      
      // Setze neue Session in Cache
      queryClient.setQueryData(
        queryKeys.sessions.detail(newSession.id, variables.userId),
        newSession
      );
      
      // Update Latest Session
      queryClient.setQueryData(
        queryKeys.sessions.latest(variables.userId),
        newSession
      );
      
      // Update Sessions nach Datum
      const sessionDate = new Date(newSession.timestamp).toISOString().slice(0, 10);
      queryClient.setQueriesData(
        { queryKey: queryKeys.sessions.byDate(sessionDate, variables.userId) },
        (old: BreathingSession[] | undefined) => {
          if (!old) return [newSession];
          return [newSession, ...old];
        }
      );
    },
    onError: (error, variables) => {
      console.error('Fehler beim Erstellen der Session:', error);
    }
  });
}

/**
 * Hook für Session aktualisieren
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId, updates }: { 
      id: string; 
      userId: string; 
      updates: UpdateBreathingSession 
    }) => BreathingSessionsService.update(id, userId, updates),
    onMutate: async ({ id, userId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.sessions.detail(id, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousSession = queryClient.getQueryData<BreathingSession>(
        queryKeys.sessions.detail(id, userId)
      );

      // Optimistic Update
      if (previousSession) {
        const optimisticSession: BreathingSession = {
          ...previousSession,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        queryClient.setQueryData(
          queryKeys.sessions.detail(id, userId),
          optimisticSession
        );

        // Update auch in Listen
        queryClient.setQueriesData(
          { queryKey: queryKeys.sessions.lists() },
          (old: PaginatedResponse<BreathingSession> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(session => 
                session.id === id ? optimisticSession : session
              )
            };
          }
        );
      }

      return { previousSession };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Aktualisieren der Session:', error);
      
      // Rollback bei Fehler
      if (context?.previousSession) {
        queryClient.setQueryData(
          queryKeys.sessions.detail(id, userId),
          context.previousSession
        );
      }
    },
    onSuccess: (updatedSession, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'sessions', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.stats(userId)
      });
      
      // Update Cache mit aktualisierten Daten
      queryClient.setQueryData(
        queryKeys.sessions.detail(updatedSession.id, userId),
        updatedSession
      );
    },
    onSettled: (data, error, { id, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.detail(id, userId)
        });
      }
    }
  });
}

/**
 * Hook für Session löschen
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => 
      BreathingSessionsService.delete(id, userId),
    onMutate: async ({ id, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.sessions.detail(id, userId)
      });

      // Snapshot des vorherigen Wertes
      const previousSession = queryClient.getQueryData<BreathingSession>(
        queryKeys.sessions.detail(id, userId)
      );

      // Optimistic Update - entferne aus Listen
      queryClient.setQueriesData(
        { queryKey: queryKeys.sessions.lists() },
        (old: PaginatedResponse<BreathingSession> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(session => session.id !== id)
          };
        }
      );

      // Entferne aus Detail-Cache
      queryClient.removeQueries({
        queryKey: queryKeys.sessions.detail(id, userId)
      });

      return { previousSession };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Löschen der Session:', error);
      
      // Rollback bei Fehler
      if (context?.previousSession) {
        queryClient.setQueryData(
          queryKeys.sessions.detail(id, userId),
          context.previousSession
        );
      }
    },
    onSuccess: (data, { userId }) => {
      // Invalidiere Listen
      invalidateListQueries(queryClient, 'sessions', userId);
      
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.stats(userId)
      });
    },
    onSettled: (data, error, { id, userId }) => {
      // Refetch bei Fehler
      if (error) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.detail(id, userId)
        });
      }
    }
  });
}

/**
 * Hook für Session als abgeschlossen markieren
 */
export function useMarkSessionCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => 
      BreathingSessionsService.markCompleted(id, userId),
    onSuccess: (updatedSession, { userId }) => {
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.stats(userId)
      });
      
      // Update Cache
      queryClient.setQueryData(
        queryKeys.sessions.detail(updatedSession.id, userId),
        updatedSession
      );
    },
    onError: (error, variables) => {
      console.error('Fehler beim Markieren der Session als abgeschlossen:', error);
    }
  });
}

/**
 * Hook für Session als unvollständig markieren
 */
export function useMarkSessionIncomplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => 
      BreathingSessionsService.markIncomplete(id, userId),
    onSuccess: (updatedSession, { userId }) => {
      // Invalidiere Statistiken
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.stats(userId)
      });
      
      // Update Cache
      queryClient.setQueryData(
        queryKeys.sessions.detail(updatedSession.id, userId),
        updatedSession
      );
    },
    onError: (error, variables) => {
      console.error('Fehler beim Markieren der Session als unvollständig:', error);
    }
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook für Infinite Scroll Sessions-Liste
 */
export function useInfiniteSessionsList(
  userId: string,
  rangeParams: SessionRangeParams = {},
  limit: number = 20
) {
  return useQuery({
    queryKey: queryKeys.sessions.list(userId, rangeParams, { limit }),
    queryFn: ({ pageParam }: { pageParam?: string }) => 
      BreathingSessionsService.list(userId, rangeParams, { 
        cursor: pageParam, 
        limit 
      }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId
  });
}

/**
 * Hook für Sessions mit automatischer Aktualisierung
 */
export function useSessionsWithAutoRefresh(
  userId: string,
  rangeParams: SessionRangeParams = {},
  pagination: PaginationParams = {},
  refreshInterval: number = 30000 // 30 Sekunden
) {
  return useQuery({
    queryKey: queryKeys.sessions.list(userId, rangeParams, pagination),
    queryFn: () => BreathingSessionsService.list(userId, rangeParams, pagination),
    staleTime: 1 * 60 * 1000, // 1 Minute
    gcTime: 5 * 60 * 1000,    // 5 Minuten
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
    enabled: !!userId
  });
}

/**
 * Hook für Sessions-Statistiken mit automatischer Aktualisierung
 */
export function useSessionStatsWithAutoRefresh(
  userId: string,
  rangeParams: SessionRangeParams = {},
  refreshInterval: number = 60000 // 1 Minute
) {
  return useQuery({
    queryKey: queryKeys.sessions.stats(userId, rangeParams),
    queryFn: () => BreathingSessionsService.getStats(userId, rangeParams),
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 15 * 60 * 1000,   // 15 Minuten
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
    enabled: !!userId
  });
}

/**
 * Hook für Sessions-Filter mit Debouncing
 */
export function useDebouncedSessionsList(
  userId: string,
  rangeParams: SessionRangeParams = {},
  pagination: PaginationParams = {},
  debounceMs: number = 300
) {
  return useQuery({
    queryKey: queryKeys.sessions.list(userId, rangeParams, pagination),
    queryFn: () => BreathingSessionsService.list(userId, rangeParams, pagination),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
    refetchOnWindowFocus: false,
    retry: false
  });
}
