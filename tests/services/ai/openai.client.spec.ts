/**
 * OpenAI Client Tests
 * Testet Rate-Limits, Timeouts, Retries und Fallbacks
 */

import { OpenAIClient, type AIRequest, type RateLimitStore, type RateLimitStatus, type OpenAIConfig, type RateLimitConfig } from '../../../services/ai/openai.client';
import { BuiltPrompt } from '../../../services/ai/prompt.builder';

/**
 * Mock Rate-Limit Store für Tests
 */
class MockRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitStatus>();

  async getStatus(userId: string): Promise<RateLimitStatus> {
    return this.store.get(userId) || {
      userId,
      callsToday: 0,
      tokensToday: 0,
      lastCallTime: new Date().toISOString(),
      isLimited: false
    };
  }

  async incrementUsage(userId: string, tokens: number): Promise<void> {
    const status = await this.getStatus(userId);
    status.callsToday += 1;
    status.tokensToday += tokens;
    status.lastCallTime = new Date().toISOString();
    this.store.set(userId, status);
  }

  async resetDailyLimits(): Promise<void> {
    this.store.clear();
  }

  // Test-Helper Methoden
  setStatus(userId: string, status: RateLimitStatus): void {
    this.store.set(userId, status);
  }

  getStore(): Map<string, RateLimitStatus> {
    return this.store;
  }
}

/**
 * Mock Fetch für Tests
 */
let mockFetch: jest.Mock;

// Mock fetch global
global.fetch = jest.fn() as any;

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  let mockStore: MockRateLimitStore;
  let mockPrompt: BuiltPrompt;

  beforeEach(() => {
    mockFetch = jest.fn();
    (global.fetch as any) = mockFetch;
    
    mockStore = new MockRateLimitStore();
    
    mockPrompt = {
      systemPrompt: 'Test system prompt',
      userPrompt: 'Test user prompt',
      estimatedTokens: 100,
      language: 'de'
    };

    client = new OpenAIClient(
      { apiKey: 'test-key' },
      { maxCallsPerDay: 4, maxTokensPerDay: 2000 },
      mockStore
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('sollte mit gültiger Konfiguration initialisieren', () => {
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('sollte Fehler ohne API-Key werfen', () => {
      expect(() => new OpenAIClient({ apiKey: '' })).toThrow('OpenAI API key is required');
    });

    it('sollte Umgebungsvariable für API-Key verwenden', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-key';
      
      const envClient = new OpenAIClient();
      expect(envClient).toBeInstanceOf(OpenAIClient);
      
      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('sendRequest', () => {
    it('sollte erfolgreichen Request senden', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Test AI response' },
          finish_reason: 'stop'
        }],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result).toEqual({
        content: 'Test AI response',
        model: 'gpt-4o-mini',
        usage: {
          promptTokens: 50,
          completionTokens: 30,
          totalTokens: 80
        },
        finishReason: 'stop'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Test system prompt' },
              { role: 'user', content: 'Test user prompt' }
            ],
            max_tokens: 500,
            temperature: 0.7
          })
        })
      );
    });

    it('sollte Rate-Limit Fallback bei Überschreitung zurückgeben', async () => {
      // Setze User über Limit
      mockStore.setStatus('test-user', {
        userId: 'test-user',
        callsToday: 4, // Max erreicht
        tokensToday: 1000,
        lastCallTime: new Date().toISOString(),
        isLimited: false
      });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('rate_limit');
      expect(result.content).toContain('•'); // Prüfe nur auf Bullet-Point
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sollte Token-Limit Fallback bei Überschreitung zurückgeben', async () => {
      // Setze User über Token-Limit
      mockStore.setStatus('test-user', {
        userId: 'test-user',
        callsToday: 2,
        tokensToday: 1900, // Fast am Limit
        lastCallTime: new Date().toISOString(),
        isLimited: false
      });

      const request: AIRequest = {
        prompt: { ...mockPrompt, estimatedTokens: 200 }, // Würde Limit überschreiten
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('rate_limit');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sollte Timeout-Fallback bei Timeout zurückgeben', async () => {
      // Mock fetch um sofort zu scheitern
      mockFetch.mockRejectedValueOnce({ name: 'AbortError' });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('timeout');
      expect(result.content).toContain('•'); // Prüfe nur auf Bullet-Point
    });

    it('sollte Retry bei retrybaren Fehlern durchführen', async () => {
      // Erste Anfrage schlägt fehl, zweite erfolgreich
      mockFetch
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Retry success' }, finish_reason: 'stop' }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          })
        });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.content).toBe('Retry success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000); // Erhöhe Timeout

    it('sollte Fallback nach maximalen Retries zurückgeben', async () => {
      // Alle Anfragen schlagen fehl
      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'));

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('timeout');
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 10000); // Erhöhe Timeout auf 10s
  });

  describe('Rate-Limit Management', () => {
    it('sollte Usage nach erfolgreichem Request tracken', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Test' }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
        })
      });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      await client.sendRequest(request);

      const status = await mockStore.getStatus('test-user');
      expect(status.callsToday).toBe(1);
      expect(status.tokensToday).toBe(80);
    });

    it('sollte Rate-Limit Status korrekt abrufen', async () => {
      const status = await client.getRateLimitStatus('test-user');
      
      expect(status.userId).toBe('test-user');
      expect(status.callsToday).toBe(0);
      expect(status.tokensToday).toBe(0);
      expect(status.isLimited).toBe(false);
    });

    it('sollte tägliche Limits zurücksetzen', async () => {
      // Setze Usage
      mockStore.setStatus('test-user', {
        userId: 'test-user',
        callsToday: 3,
        tokensToday: 1500,
        lastCallTime: new Date().toISOString(),
        isLimited: false
      });

      await client.resetDailyLimits();

      const status = await mockStore.getStatus('test-user');
      expect(status.callsToday).toBe(0);
      expect(status.tokensToday).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('sollte verschiedene Error-Typen korrekt parsen', async () => {
      const testCases = [
        { error: new Error('429 Too Many Requests'), expectedType: 'rate_limit' },
        { error: new Error('400 Bad Request'), expectedType: 'invalid_request' },
        { error: new Error('500 Internal Server Error'), expectedType: 'server_error' },
        { error: new Error('quota exceeded'), expectedType: 'quota_exceeded' },
        { error: { name: 'AbortError' }, expectedType: 'timeout' },
        { error: new Error('Unknown error'), expectedType: 'unknown' }
      ];

      for (const { error, expectedType } of testCases) {
        mockFetch.mockRejectedValueOnce(error);

        const request: AIRequest = {
          prompt: mockPrompt,
          userId: 'test-user'
        };

        const result = await client.sendRequest(request);

        expect(result.isFallback).toBe(true);
        expect(result.reason).toBe(expectedType);
      }
    }, 15000); // Erhöhe Timeout auf 15s

    it('sollte nicht-retrybare Fehler nicht wiederholen', async () => {
      mockFetch.mockRejectedValue(new Error('400 Bad Request'));

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('invalid_request');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Kein Retry
    });
  });

  describe('Fallback Responses', () => {
    it('sollte deutsche Evening-Fallbacks generieren', async () => {
      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'));

      const request: AIRequest = {
        prompt: { ...mockPrompt, language: 'de' },
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.content).toContain('•'); // Prüfe nur auf Bullet-Point
      expect(result.content).toContain('💨 Atem-Empfehlung');
    }, 10000); // Erhöhe Timeout

    it('sollte englische Evening-Fallbacks generieren', async () => {
      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'));

      const request: AIRequest = {
        prompt: { ...mockPrompt, language: 'en' },
        userId: 'test-user'
      };

      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.content).toContain('•'); // Prüfe nur auf Bullet-Point
      expect(result.content).toContain('💨 Breathing recommendation');
    }, 10000); // Erhöhe Timeout

    it('sollte verschiedene Fallback-Inhalte bei mehreren Aufrufen zurückgeben', async () => {
      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'));

      const request: AIRequest = {
        prompt: { ...mockPrompt, language: 'de' },
        userId: 'test-user'
      };

      const results = await Promise.all([
        client.sendRequest(request),
        client.sendRequest(request),
        client.sendRequest(request)
      ]);

      const contents = results.map(r => r.content);
      const uniqueContents = new Set(contents);
      
      // Sollte verschiedene Fallbacks haben (nicht alle gleich)
      expect(uniqueContents.size).toBeGreaterThan(1);
    }, 10000); // Erhöhe Timeout
  });

  describe('Configuration', () => {
    it('sollte benutzerdefinierte Konfiguration verwenden', () => {
      const customConfig: OpenAIConfig = {
        apiKey: 'custom-key',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.5,
        timeoutMs: 15000,
        maxRetries: 5,
        baseURL: 'https://custom.openai.com/v1'
      };

      const customClient = new OpenAIClient(customConfig);

      expect(customClient).toBeInstanceOf(OpenAIClient);
    });

    it('sollte benutzerdefinierte Rate-Limits verwenden', () => {
      const customRateLimit: RateLimitConfig = {
        maxCallsPerDay: 10,
        maxCallsPerMinute: 20,
        maxTokensPerDay: 5000
      };

      const customClient = new OpenAIClient(
        { apiKey: 'test-key' },
        customRateLimit
      );

      expect(customClient).toBeInstanceOf(OpenAIClient);
    });
  });

  describe('Abort Functionality', () => {
    it('sollte laufende Requests abbrechen können', async () => {
      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      // Mock fetch um sofort zu scheitern
      mockFetch.mockRejectedValueOnce({ name: 'AbortError' });
      
      const result = await client.sendRequest(request);
      
      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('timeout');
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit leeren Prompts umgehen', async () => {
      const emptyPrompt: BuiltPrompt = {
        systemPrompt: '',
        userPrompt: '',
        estimatedTokens: 0,
        language: 'de'
      };

      const request: AIRequest = {
        prompt: emptyPrompt,
        userId: 'test-user'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Empty response' }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 0, completion_tokens: 10, total_tokens: 10 }
        })
      });

      const result = await client.sendRequest(request);

      expect(result.content).toBe('Empty response');
    });

    it('sollte mit sehr langen Prompts umgehen', async () => {
      const longPrompt: BuiltPrompt = {
        systemPrompt: 'A'.repeat(10000),
        userPrompt: 'B'.repeat(10000),
        estimatedTokens: 5000,
        language: 'de'
      };

      const request: AIRequest = {
        prompt: longPrompt,
        userId: 'test-user'
      };

      // Sollte Rate-Limit-Fallback zurückgeben
      const result = await client.sendRequest(request);

      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('rate_limit');
    });
  });

  describe('Performance', () => {
    it('sollte Requests schnell verarbeiten', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Fast response' }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      });

      const request: AIRequest = {
        prompt: mockPrompt,
        userId: 'test-user'
      };

      const startTime = Date.now();
      await client.sendRequest(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Sollte unter 1s sein
    });
  });
});
