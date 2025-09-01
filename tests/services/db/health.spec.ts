import {
  checkDBHealth,
  checkDBHealthWithAuth,
  HealthMonitor,
  HealthCheckResult
} from '../../../services/db/health';
import { supabase } from '../../../services/db/supabase.client';

// Mock Supabase-Client
jest.mock('../../../services/db/supabase.client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn()
    }
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('DB Health Checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });
  
  describe('checkDBHealth', () => {
    it('sollte online-Status bei erfolgreicher Verbindung zurückgeben', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' } // Erwarteter Fehler für nicht existierende Tabelle
          })
        })
      } as any);
      
      const result = await checkDBHealth();
      
      expect(result.online).toBe(true);
      expect(result.latency).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });
    
    it('sollte offline-Status bei Netzwerkfehler zurückgeben', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Network error'))
        })
      } as any);
      
      const result = await checkDBHealth();
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Health-Check fehlgeschlagen');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    it('sollte offline-Status bei navigator.offline zurückgeben', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const result = await checkDBHealth();
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Offline-Modus');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    it('sollte Timeout bei langsamer Antwort behandeln', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockImplementation(() => 
            new Promise(resolve => setTimeout(resolve, 100))
          )
        })
      } as any);
      
      const result = await checkDBHealth(50); // 50ms Timeout
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Health-Check fehlgeschlagen');
    });
    
    it('sollte Latenz korrekt messen', async () => {
      const startTime = Date.now();
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      } as any);
      
      const result = await checkDBHealth();
      
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.latency).toBeLessThan(1000); // Sollte unter 1s sein
    });
  });
  
  describe('checkDBHealthWithAuth', () => {
    it('sollte online-Status bei authentifiziertem Benutzer zurückgeben', async () => {
      const mockSession = {
        user: { id: 'test-user-id' },
        access_token: 'test-token'
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test-user-id' }],
              error: null
            })
          })
        })
      } as any);
      
      const result = await checkDBHealthWithAuth();
      
      expect(result.online).toBe(true);
      expect(result.latency).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    it('sollte offline-Status bei Auth-Fehler zurückgeben', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Auth error')
      });
      
      const result = await checkDBHealthWithAuth();
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Auth-Fehler');
    });
    
    it('sollte offline-Status bei fehlender Session zurückgeben', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      const result = await checkDBHealthWithAuth();
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Nicht authentifiziert');
    });
    
    it('sollte offline-Status bei DB-Fehler zurückgeben', async () => {
      const mockSession = {
        user: { id: 'test-user-id' },
        access_token: 'test-token'
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST301' }
            })
          })
        })
      } as any);
      
      const result = await checkDBHealthWithAuth();
      
      expect(result.online).toBe(false);
      expect(result.error).toBe('Auth-Health-Check fehlgeschlagen');
    });
  });
  
  describe('HealthMonitor', () => {
    let monitor: HealthMonitor;
    let mockCallback: jest.Mock;
    
    beforeEach(() => {
      monitor = new HealthMonitor();
      mockCallback = jest.fn();
      
      // Mock erfolgreichen Health-Check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      } as any);
    });
    
    afterEach(() => {
      monitor.stop();
    });
    
    it('sollte Monitoring starten und stoppen', () => {
      expect(monitor.isActive).toBe(false);
      
      monitor.start(100, mockCallback);
      expect(monitor.isActive).toBe(true);
      
      monitor.stop();
      expect(monitor.isActive).toBe(false);
    });
    
    it('sollte nicht mehrfach starten', () => {
      monitor.start(100, mockCallback);
      monitor.start(100, mockCallback);
      
      expect(monitor.isActive).toBe(true);
    });
    
    it('sollte Callback bei Health-Änderungen aufrufen', async () => {
      monitor.start(50, mockCallback);
      
      // Warte auf ersten Callback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0]).toMatchObject({
        online: expect.any(Boolean),
        timestamp: expect.any(Date)
      });
    });
    
    it('sollte ohne Callback funktionieren', async () => {
      monitor.start(50);
      
      // Sollte nicht crashen
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.isActive).toBe(true);
    });
    
    it('sollte nach Stop keine weiteren Callbacks aufrufen', async () => {
      monitor.start(50, mockCallback);
      
      // Warte auf ersten Callback
      await new Promise(resolve => setTimeout(resolve, 100));
      const callCount = mockCallback.mock.calls.length;
      
      monitor.stop();
      
      // Warte und prüfe dass keine weiteren Calls kommen
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCallback.mock.calls.length).toBe(callCount);
    });
  });
});
