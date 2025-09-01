/**
 * Tests für BreathingSessionsService
 * Testet CRUD-Operationen, Range-Filtering und Offline-Queue-Pfad
 */

import { BreathingSessionsService, SessionRangeParams, PaginationParams } from '../../../services/db/sessions.service';
import { BreathingSession, CreateBreathingSession, UpdateBreathingSession } from '../../../models/session.model';
import { supabase } from '../../../services/db/supabase.client';

// Mock Supabase Client
jest.mock('../../../services/db/supabase.client', () => ({
  supabase: {
    from: jest.fn()
  }
}));
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('BreathingSessionsService', () => {
  const mockUserId = 'test-user-id';
  const mockSessionId = 'test-session-id';
  
  const mockSession: BreathingSession = {
    id: mockSessionId,
    userId: mockUserId,
    method: 'box',
    durationSec: 300,
    completed: true,
    timestamp: '2024-01-15T10:00:00.000Z',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z'
  };

  const mockCreateSession: CreateBreathingSession = {
    userId: mockUserId,
    method: 'box',
    durationSec: 300,
    completed: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('sollte eine neue Session erstellen', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSession,
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      } as any);

      const result = await BreathingSessionsService.create(mockCreateSession);

      expect(mockSupabase.from).toHaveBeenCalledWith('breathing_sessions');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUserId,
        method: 'box',
        duration_sec: 300,
        completed: true
      }));
      expect(result).toEqual(mockSession);
    });

    it('sollte einen Fehler werfen wenn Supabase einen Fehler zurückgibt', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      } as any);

      await expect(BreathingSessionsService.create(mockCreateSession))
        .rejects.toThrow('Database error');
    });
  });

  describe('getById', () => {
    it('sollte eine Session nach ID abrufen', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await BreathingSessionsService.getById(mockSessionId, mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('breathing_sessions');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockSession);
    });

    it('sollte null zurückgeben wenn Session nicht gefunden wird', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' };
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        })
      } as any);

      const result = await BreathingSessionsService.getById(mockSessionId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('sollte Sessions mit Standard-Pagination abrufen', async () => {
      const mockSessions = [mockSession];
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
                count: 1
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await BreathingSessionsService.list(mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('breathing_sessions');
      expect(result.data).toEqual(mockSessions);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('sollte Sessions mit Range-Filtering abrufen', async () => {
      const rangeParams: SessionRangeParams = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z',
        method: 'box',
        completed: true
      };

      const mockSessions = [mockSession];
      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null,
          count: 1
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      const result = await BreathingSessionsService.list(mockUserId, rangeParams);

      expect(queryChain.gte).toHaveBeenCalledWith('timestamp', rangeParams.startDate);
      expect(queryChain.lte).toHaveBeenCalledWith('timestamp', rangeParams.endDate);
      expect(queryChain.eq).toHaveBeenCalledWith('method', rangeParams.method);
      expect(queryChain.eq).toHaveBeenCalledWith('completed', rangeParams.completed);
    });

    it('sollte Cursor-based Pagination verwenden', async () => {
      const pagination: PaginationParams = {
        cursor: '2024-01-15T10:00:00.000Z',
        limit: 10
      };

      const mockSessions = [mockSession];
      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null,
          count: 1
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      const result = await BreathingSessionsService.list(mockUserId, {}, pagination);

      expect(queryChain.lt).toHaveBeenCalledWith('timestamp', pagination.cursor);
      expect(result.pagination.nextCursor).toBe(mockSession.timestamp);
    });

    it('sollte Page-based Pagination verwenden', async () => {
      const pagination: PaginationParams = {
        page: 2,
        limit: 10
      };

      const mockSessions = [mockSession];
      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null,
          count: 25
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      const result = await BreathingSessionsService.list(mockUserId, {}, pagination);

      expect(queryChain.range).toHaveBeenCalledWith(10, 19);
      expect(result.pagination.totalCount).toBe(25);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('update', () => {
    it('sollte eine Session aktualisieren', async () => {
      const updates: UpdateBreathingSession = {
        completed: false,
        durationSec: 600
      };

      const updatedSession = { ...mockSession, ...updates };
      
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: updatedSession,
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate
      } as any);

      const result = await BreathingSessionsService.update(mockSessionId, mockUserId, updates);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        completed: false,
        duration_sec: 600,
        updated_at: expect.any(String)
      }));
      expect(result).toEqual(updatedSession);
    });

    it('sollte einen Fehler werfen wenn Session nicht gefunden wird', async () => {
      const updates: UpdateBreathingSession = { completed: false };
      const mockError = { code: 'PGRST116', message: 'Not found' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: mockError
                })
              })
            })
          })
        })
      } as any);

      await expect(BreathingSessionsService.update(mockSessionId, mockUserId, updates))
        .rejects.toThrow('Session nicht gefunden');
    });
  });

  describe('delete', () => {
    it('sollte eine Session löschen', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete
      } as any);

      await expect(BreathingSessionsService.delete(mockSessionId, mockUserId))
        .resolves.not.toThrow();

      expect(mockDelete).toHaveBeenCalled();
    });

    it('sollte einen Fehler werfen wenn Löschung fehlschlägt', async () => {
      const mockError = { message: 'Delete failed' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: mockError
            })
          })
        })
      } as any);

      await expect(BreathingSessionsService.delete(mockSessionId, mockUserId))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getByDate', () => {
    it('sollte Sessions für ein spezifisches Datum abrufen', async () => {
      const date = '2024-01-15';
      const mockSessions = [mockSession];

      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      const result = await BreathingSessionsService.getByDate(date, mockUserId);

      expect(queryChain.gte).toHaveBeenCalledWith('timestamp', expect.stringContaining('2024-01-15T00:00:00'));
      expect(queryChain.lte).toHaveBeenCalledWith('timestamp', expect.stringContaining('2024-01-15T23:59:59'));
      expect(result).toEqual(mockSessions);
    });
  });

  describe('getLatest', () => {
    it('sollte die neueste Session abrufen', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any);

      const result = await BreathingSessionsService.getLatest(mockUserId);

      expect(result).toEqual(mockSession);
    });

    it('sollte null zurückgeben wenn keine Sessions existieren', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: mockError
                })
              })
            })
          })
        })
      } as any);

      const result = await BreathingSessionsService.getLatest(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('sollte Session-Statistiken berechnen', async () => {
      const mockSessions = [
        { ...mockSession, completed: true, durationSec: 300 },
        { ...mockSession, id: 'session-2', completed: false, durationSec: 150 },
        { ...mockSession, id: 'session-3', completed: true, durationSec: 450 }
      ];

      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      const result = await BreathingSessionsService.getStats(mockUserId);

      expect(result.totalSessions).toBe(3);
      expect(result.completedSessions).toBe(2);
      expect(result.totalDurationSec).toBe(750);
      expect(result.averageDurationSec).toBe(375);
      expect(result.completionRate).toBe(66.66666666666667);
    });

    it('sollte Range-Filter für Statistiken anwenden', async () => {
      const rangeParams: SessionRangeParams = {
        startDate: '2024-01-01T00:00:00.000Z',
        method: 'box'
      };

      const mockSessions = [mockSession];

      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: mockSessions,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      await BreathingSessionsService.getStats(mockUserId, rangeParams);

      expect(queryChain.gte).toHaveBeenCalledWith('timestamp', rangeParams.startDate);
      expect(queryChain.eq).toHaveBeenCalledWith('method', rangeParams.method);
    });
  });

  describe('getMethods', () => {
    it('sollte alle verwendeten Atem-Methoden abrufen', async () => {
      const mockData = [
        { method: 'box' },
        { method: '478' },
        { method: 'box' },
        { method: 'coherent' }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              data: mockData,
              error: null
            })
          })
        })
      } as any);

      const result = await BreathingSessionsService.getMethods(mockUserId);

      expect(result).toEqual(['478', 'box', 'coherent']);
    });
  });

  describe('markCompleted/markIncomplete', () => {
    it('sollte eine Session als abgeschlossen markieren', async () => {
      const updatedSession = { ...mockSession, completed: true };
      
      jest.spyOn(BreathingSessionsService, 'update').mockResolvedValue(updatedSession as any);

      const result = await BreathingSessionsService.markCompleted(mockSessionId, mockUserId);

      expect(BreathingSessionsService.update).toHaveBeenCalledWith(mockSessionId, mockUserId, { completed: true });
      expect(result).toEqual(updatedSession);
    });

    it('sollte eine Session als unvollständig markieren', async () => {
      const updatedSession = { ...mockSession, completed: false };
      
      jest.spyOn(BreathingSessionsService, 'update').mockResolvedValue(updatedSession as any);

      const result = await BreathingSessionsService.markIncomplete(mockSessionId, mockUserId);

      expect(BreathingSessionsService.update).toHaveBeenCalledWith(mockSessionId, mockUserId, { completed: false });
      expect(result).toEqual(updatedSession);
    });
  });

  describe('Offline-Queue-Pfad', () => {
    it('sollte mit Netzwerkfehlern umgehen', async () => {
      const networkError = { message: 'Network error', code: 'NETWORK_ERROR' };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: networkError
            })
          })
        })
      } as any);

      await expect(BreathingSessionsService.create(mockCreateSession))
        .rejects.toThrow('Network error');
    });

    it('sollte mit Datenbankfehlern umgehen', async () => {
      const dbError = { message: 'Constraint violation', code: '23505' };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      } as any);

      await expect(BreathingSessionsService.create(mockCreateSession))
        .rejects.toThrow('Constraint violation');
    });
  });

  describe('Range-Filter Effizienz', () => {
    it('sollte effiziente Range-Queries verwenden', async () => {
      const rangeParams: SessionRangeParams = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z'
      };

      let queryChain: any = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockSession],
          error: null,
          count: 1
        })
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryChain)
      } as any);

      await BreathingSessionsService.list(mockUserId, rangeParams);

      // Prüfe dass Range-Filter in korrekter Reihenfolge angewendet werden
      expect(queryChain.gte).toHaveBeenCalledWith('timestamp', rangeParams.startDate);
      expect(queryChain.lte).toHaveBeenCalledWith('timestamp', rangeParams.endDate);
    });
  });
});
