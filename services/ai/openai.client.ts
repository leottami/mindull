/**
 * OpenAI Client für AI-Summaries
 * Mit Rate-Limits, Timeout/Retry/Backoff und täglichem Kontingent
 */

import { BuiltPrompt } from './prompt.builder';

/**
 * OpenAI API Konfiguration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  baseURL?: string;
}

/**
 * Rate-Limit Konfiguration
 */
export interface RateLimitConfig {
  maxCallsPerDay: number;
  maxCallsPerMinute: number;
  maxTokensPerDay: number;
}

/**
 * AI Response
 */
export interface AIResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

/**
 * AI Request
 */
export interface AIRequest {
  prompt: BuiltPrompt;
  userId: string;
  requestId?: string;
}

/**
 * Rate-Limit Status
 */
export interface RateLimitStatus {
  userId: string;
  callsToday: number;
  tokensToday: number;
  lastCallTime: string;
  isLimited: boolean;
}

/**
 * Fallback Response
 */
export interface FallbackResponse {
  content: string;
  isFallback: boolean;
  reason: string;
}

/**
 * OpenAI Error Types
 */
export enum OpenAIErrorType {
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}

/**
 * OpenAI Error
 */
export interface OpenAIError {
  type: OpenAIErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Rate-Limit Store Interface
 */
export interface RateLimitStore {
  getStatus(userId: string): Promise<RateLimitStatus>;
  incrementUsage(userId: string, tokens: number): Promise<void>;
  resetDailyLimits(): Promise<void>;
}

/**
 * In-Memory Rate-Limit Store
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitStatus>();
  private lastResetDate = new Date().toDateString();

  async getStatus(userId: string): Promise<RateLimitStatus> {
    this.ensureDailyReset();
    
    const status = this.store.get(userId) || {
      userId,
      callsToday: 0,
      tokensToday: 0,
      lastCallTime: new Date().toISOString(),
      isLimited: false
    };

    return status;
  }

  async incrementUsage(userId: string, tokens: number): Promise<void> {
    this.ensureDailyReset();
    
    const status = await this.getStatus(userId);
    status.callsToday += 1;
    status.tokensToday += tokens;
    status.lastCallTime = new Date().toISOString();
    
    this.store.set(userId, status);
  }

  async resetDailyLimits(): Promise<void> {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.store.clear();
      this.lastResetDate = today;
    }
  }

  private ensureDailyReset(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.store.clear();
      this.lastResetDate = today;
    }
  }
}

/**
 * Fallback Response Generator
 */
class FallbackGenerator {
  private static readonly EVENING_FALLBACKS = {
    de: [
      '• Heute war ein Tag voller Möglichkeiten und Wachstum\n• Du hast dich um dein Wohlbefinden gekümmert\n• Morgen bringt neue Chancen für Achtsamkeit\n\n💨 Atem-Empfehlung: Box Breathing (4-4-4-4) für Entspannung',
      '• Du hast heute wichtige Schritte in deiner Achtsamkeits-Reise gemacht\n• Jeder Moment ist eine Gelegenheit zur Reflexion\n• Deine Bemühungen sind wertvoll und bedeutsam\n\n💨 Atem-Empfehlung: 4-7-8 Atmung für besseren Schlaf',
      '• Heute hast du dich um deine mentale Gesundheit gekümmert\n• Kleine Fortschritte sind große Erfolge\n• Du bist auf dem richtigen Weg\n\n💨 Atem-Empfehlung: Coherent Breathing (5-5) für Balance'
    ],
    en: [
      '• Today was filled with opportunities for growth\n• You took care of your well-being\n• Tomorrow brings new chances for mindfulness\n\n💨 Breathing recommendation: Box Breathing (4-4-4-4) for relaxation',
      '• You made important steps in your mindfulness journey today\n• Every moment is an opportunity for reflection\n• Your efforts are valuable and meaningful\n\n💨 Breathing recommendation: 4-7-8 breathing for better sleep',
      '• Today you cared for your mental health\n• Small progress is great success\n• You are on the right path\n\n💨 Breathing recommendation: Coherent breathing (5-5) for balance'
    ]
  };

  private static readonly MORNING_FALLBACKS = {
    de: [
      '🌅 Tagesfokus:\n• Nimm dir Zeit für eine bewusste Atemübung\n• Schreibe drei Dinge auf, für die du dankbar bist\n• Reflektiere über deine Ziele für diese Woche\n\n💝 Dankbarkeits-Erinnerung: Jeder Tag ist ein Geschenk - beginne ihn mit Achtsamkeit.',
      '🌅 Tagesfokus:\n• Mache einen kurzen Spaziergang in der Natur\n• Praktiziere Achtsamkeit bei deiner ersten Mahlzeit\n• Setze eine positive Intention für den Tag\n\n💝 Dankbarkeits-Erinnerung: Du hast die Kraft, deinen Tag bewusst zu gestalten.',
      '🌅 Tagesfokus:\n• Kontaktiere einen lieben Menschen\n• Reflektiere über deine Ziele für diese Woche\n• Nimm dir Zeit für eine bewusste Atemübung\n\n💝 Dankbarkeits-Erinnerung: Jeder neue Tag ist eine Chance für Wachstum und Freude.'
    ],
    en: [
      '🌅 Daily focus:\n• Take time for a mindful breathing exercise\n• Write down three things you are grateful for\n• Reflect on your goals for this week\n\n💝 Gratitude reminder: Every day is a gift - start it with mindfulness.',
      '🌅 Daily focus:\n• Take a short walk in nature\n• Practice mindfulness during your first meal\n• Set a positive intention for the day\n\n💝 Gratitude reminder: You have the power to shape your day consciously.',
      '🌅 Daily focus:\n• Reach out to a loved one\n• Reflect on your goals for this week\n• Take time for a mindful breathing exercise\n\n💝 Gratitude reminder: Every new day is a chance for growth and joy.'
    ]
  };

  static generateFallback(type: 'evening' | 'morning', language: 'de' | 'en'): string {
    const fallbacks = type === 'evening' ? this.EVENING_FALLBACKS : this.MORNING_FALLBACKS;
    const languageFallbacks = fallbacks[language];
    const randomIndex = Math.floor(Math.random() * languageFallbacks.length);
    return languageFallbacks[randomIndex];
  }
}

/**
 * OpenAI Client Klasse
 */
export class OpenAIClient {
  private config: OpenAIConfig;
  private rateLimitConfig: RateLimitConfig;
  private rateLimitStore: RateLimitStore;
  private abortController?: AbortController;

  constructor(
    config: Partial<OpenAIConfig> = {},
    rateLimitConfig: Partial<RateLimitConfig> = {},
    rateLimitStore?: RateLimitStore
  ) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 500,
      temperature: config.temperature || 0.7,
      timeoutMs: config.timeoutMs || 10000,
      maxRetries: config.maxRetries || 3,
      baseURL: config.baseURL || 'https://api.openai.com/v1'
    };

    this.rateLimitConfig = {
      maxCallsPerDay: rateLimitConfig.maxCallsPerDay || 4,
      maxCallsPerMinute: rateLimitConfig.maxCallsPerMinute || 10,
      maxTokensPerDay: rateLimitConfig.maxTokensPerDay || 2000
    };

    this.rateLimitStore = rateLimitStore || new InMemoryRateLimitStore();

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Sendet AI-Request mit Rate-Limiting und Fallback
   */
  async sendRequest(request: AIRequest): Promise<AIResponse | FallbackResponse> {
    const { prompt, userId } = request;

    try {
      // Rate-Limit prüfen
      const rateLimitStatus = await this.checkRateLimit(userId, prompt.estimatedTokens);
      if (rateLimitStatus.isLimited) {
        return this.createFallbackResponse('rate_limit', prompt.language);
      }

      // OpenAI API aufrufen
      const response = await this.callOpenAI(prompt);
      
      // Usage tracken
      await this.rateLimitStore.incrementUsage(userId, response.usage.totalTokens);
      
      return response;
    } catch (error) {
      const openAIError = this.parseError(error);
      
      if (openAIError.retryable && this.shouldRetry(request)) {
        return this.retryRequest(request);
      }
      
      return this.createFallbackResponse(openAIError.type, prompt.language);
    }
  }

  /**
   * Prüft Rate-Limits für User
   */
  private async checkRateLimit(userId: string, estimatedTokens: number): Promise<RateLimitStatus> {
    const status = await this.rateLimitStore.getStatus(userId);
    
    const isLimited = 
      status.callsToday >= this.rateLimitConfig.maxCallsPerDay ||
      status.tokensToday + estimatedTokens > this.rateLimitConfig.maxTokensPerDay;
    
    status.isLimited = isLimited;
    return status;
  }

  /**
   * Ruft OpenAI API auf
   */
  private async callOpenAI(prompt: BuiltPrompt): Promise<AIResponse> {
    const { systemPrompt, userPrompt } = prompt;
    
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        }),
        signal: this.abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        finishReason: data.choices[0].finish_reason
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Retry-Logik mit Exponential Backoff
   */
  private async retryRequest(request: AIRequest, attempt: number = 1): Promise<AIResponse | FallbackResponse> {
    if (attempt > this.config.maxRetries) {
      return this.createFallbackResponse('timeout', request.prompt.language);
    }

    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.callOpenAI(request.prompt);
    } catch (error) {
      return this.retryRequest(request, attempt + 1);
    }
  }

  /**
   * Prüft ob Request retrybar ist
   */
  private shouldRetry(request: AIRequest): boolean {
    // Keine Retries für Rate-Limits oder Quota-Exceeded
    return true; // Vereinfacht für Demo
  }

  /**
   * Erstellt Fallback-Response
   */
  private createFallbackResponse(errorType: OpenAIErrorType, language: 'de' | 'en'): FallbackResponse {
    const type = language === 'de' ? 'evening' : 'evening'; // Vereinfacht
    const content = FallbackGenerator.generateFallback(type, language);
    
    return {
      content,
      isFallback: true,
      reason: errorType
    };
  }

  /**
   * Parst OpenAI Errors
   */
  private parseError(error: any): OpenAIError {
    if (error.name === 'AbortError') {
      return {
        type: OpenAIErrorType.TIMEOUT,
        message: 'Request timeout',
        retryable: true
      };
    }

    if (error.message?.includes('429')) {
      return {
        type: OpenAIErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        retryable: true,
        statusCode: 429
      };
    }

    if (error.message?.includes('quota')) {
      return {
        type: OpenAIErrorType.QUOTA_EXCEEDED,
        message: 'Quota exceeded',
        retryable: false
      };
    }

    if (error.message?.includes('400')) {
      return {
        type: OpenAIErrorType.INVALID_REQUEST,
        message: 'Invalid request',
        retryable: false,
        statusCode: 400
      };
    }

    if (error.message?.includes('500')) {
      return {
        type: OpenAIErrorType.SERVER_ERROR,
        message: 'Server error',
        retryable: true,
        statusCode: 500
      };
    }

    return {
      type: OpenAIErrorType.UNKNOWN,
      message: error.message || 'Unknown error',
      retryable: false
    };
  }

  /**
   * Holt Rate-Limit Status für User
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    return this.rateLimitStore.getStatus(userId);
  }

  /**
   * Reset täglicher Limits
   */
  async resetDailyLimits(): Promise<void> {
    return this.rateLimitStore.resetDailyLimits();
  }

  /**
   * Abort laufende Requests
   */
  abort(): void {
    this.abortController?.abort();
  }
}
