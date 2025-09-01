/**
 * React Query Hooks für Dreams (Phase 2)
 * FTS-Suche, Liste, Detail und Mutationen
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { DreamsService, PaginationParams, DreamSearchParams, PaginatedResponse } from '../services/db/dreams.service';
import { DreamEntry, CreateDreamEntry, UpdateDreamEntry } from '../models/dream.model';
import { queryKeys, mutationKeys, invalidateListQueries, invalidateDetailQueries } from './queryKeys';

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useDreamsList(
  userId: string,
  params: PaginationParams = {},
  options?: UseQueryOptions<PaginatedResponse<DreamEntry>>
) {
  return useQuery({
    queryKey: queryKeys.dreams.list(userId, params),
    queryFn: () => DreamsService.list(userId, params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId,
    ...options
  });
}

export function useDreamEntry(
  id: string,
  userId: string,
  options?: UseQueryOptions<DreamEntry | null>
) {
  return useQuery({
    queryKey: queryKeys.dreams.detail(id, userId),
    queryFn: () => DreamsService.getById(id, userId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!id && !!userId,
    ...options
  });
}

export function useDreamsSearch(
  params: DreamSearchParams,
  pagination: PaginationParams = {},
  options?: UseQueryOptions<PaginatedResponse<DreamEntry>>
) {
  return useQuery({
    queryKey: queryKeys.dreams.search(params),
    queryFn: () => DreamsService.search(params, pagination),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!params.userId && (!!params.query?.trim() || !!params.tags?.length || !!params.dateRange),
    ...options
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateDream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.dreams.create(),
    mutationFn: (entry: CreateDreamEntry) => DreamsService.create(entry),
    onSuccess: (newEntry, variables) => {
      invalidateListQueries(queryClient, 'dreams', variables.userId);
      queryClient.setQueryData(queryKeys.dreams.detail(newEntry.id, variables.userId), newEntry);
    },
    onError: (error) => {
      console.error('Fehler beim Erstellen des Dream-Eintrags:', error);
    }
  });
}

export function useUpdateDream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId, updates }: { id: string; userId: string; updates: UpdateDreamEntry }) =>
      DreamsService.update(id, userId, updates),
    onMutate: async ({ id, userId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dreams.detail(id, userId) });

      const previousEntry = queryClient.getQueryData<DreamEntry>(queryKeys.dreams.detail(id, userId));

      if (previousEntry) {
        const optimistic: DreamEntry = {
          ...previousEntry,
          ...updates,
          updatedAt: new Date().toISOString()
        } as DreamEntry;

        queryClient.setQueryData(queryKeys.dreams.detail(id, userId), optimistic);

        queryClient.setQueriesData(
          { queryKey: queryKeys.dreams.lists() },
          (old: PaginatedResponse<DreamEntry> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(e => (e.id === id ? optimistic : e))
            };
          }
        );
      }

      return { previousEntry };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Aktualisieren des Dream-Eintrags:', error);
      if (context?.previousEntry) {
        queryClient.setQueryData(queryKeys.dreams.detail(id, userId), context.previousEntry);
      }
    },
    onSuccess: (updated, { userId }) => {
      invalidateListQueries(queryClient, 'dreams', userId);
      queryClient.setQueryData(queryKeys.dreams.detail(updated.id, userId), updated);
    }
  });
}

export function useDeleteDream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => DreamsService.delete(id, userId),
    onMutate: async ({ id, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dreams.detail(id, userId) });

      const previousEntry = queryClient.getQueryData<DreamEntry>(queryKeys.dreams.detail(id, userId));

      queryClient.setQueriesData(
        { queryKey: queryKeys.dreams.lists() },
        (old: PaginatedResponse<DreamEntry> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(e => e.id !== id)
          };
        }
      );

      queryClient.removeQueries({ queryKey: queryKeys.dreams.detail(id, userId) });

      return { previousEntry };
    },
    onError: (error, { id, userId }, context) => {
      console.error('Fehler beim Löschen des Dream-Eintrags:', error);
      if (context?.previousEntry) {
        queryClient.setQueryData(queryKeys.dreams.detail(id, userId), context.previousEntry);
      }
    },
    onSuccess: (data, { userId }) => {
      invalidateListQueries(queryClient, 'dreams', userId);
    }
  });
}
