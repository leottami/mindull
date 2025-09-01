/**
 * Token Store - Access (Memory) + Refresh (Keychain) Strategie
 * Sichere Token-Verwaltung gemäß AUTH.BRIEF
 */

import { ITokenStore, AuthError, AuthErrorCode } from './types';

/**
 * Keychain-Interface für sichere Speicherung
 * Mock für Tests, echte Implementierung über react-native-keychain
 */
export interface ISecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

/**
 * Mock Secure Storage für Tests
 */
class MockSecureStorage implements ISecureStorage {
  private storage = new Map<string, string>();

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Token Store Implementation
 * Access Token: Nur im Speicher (nie persistent)
 * Refresh Token: Nur im iOS Keychain
 */
export class TokenStore implements ITokenStore {
  private static readonly REFRESH_TOKEN_KEY = 'mindull_refresh_token';
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 Minuten
  
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private secureStorage: ISecureStorage;

  constructor(secureStorage?: ISecureStorage) {
    // In Tests verwenden wir MockSecureStorage
    this.secureStorage = secureStorage || new MockSecureStorage();
  }

  /**
   * Speichert Access- und Refresh-Token
   * Access Token bleibt nur im Memory
   * Refresh Token wird sicher im Keychain gespeichert
   */
  async setTokens(accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
    try {
      // Access Token nur im Memory
      this.accessToken = accessToken;
      this.tokenExpiresAt = expiresAt;

      // Refresh Token sicher im Keychain
      await this.secureStorage.setItem(TokenStore.REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      throw this.createKeychainError('Failed to store tokens');
    }
  }

  /**
   * Gibt den Access Token zurück (aus Memory)
   * Null wenn nicht vorhanden oder abgelaufen
   */
  getAccessToken(): string | null {
    if (!this.accessToken || this.isAccessTokenExpired()) {
      return null;
    }
    return this.accessToken;
  }

  /**
   * Gibt den Refresh Token zurück (aus Keychain)
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.secureStorage.getItem(TokenStore.REFRESH_TOKEN_KEY);
    } catch (error) {
      throw this.createKeychainError('Failed to retrieve refresh token');
    }
  }

  /**
   * Löscht alle gespeicherten Tokens
   * Access Token aus Memory, Refresh Token aus Keychain
   */
  async clearTokens(): Promise<void> {
    try {
      // Memory leeren
      this.accessToken = null;
      this.tokenExpiresAt = null;

      // Keychain leeren
      await this.secureStorage.removeItem(TokenStore.REFRESH_TOKEN_KEY);
    } catch (error) {
      throw this.createKeychainError('Failed to clear tokens');
    }
  }

  /**
   * Prüft ob Access Token abgelaufen ist
   */
  isAccessTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return true;
    }
    return Date.now() >= this.tokenExpiresAt;
  }

  /**
   * Prüft ob Token-Refresh nötig ist (ab T-5min)
   * Gemäß AUTH.BRIEF: Auto-Refresh ab T-5 min
   */
  shouldRefreshToken(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    
    const refreshThreshold = this.tokenExpiresAt - TokenStore.REFRESH_BUFFER_MS;
    return Date.now() >= refreshThreshold;
  }

  /**
   * Gibt die verbleibende Token-Gültigkeitsdauer in Millisekunden zurück
   */
  getTokenTimeToExpiry(): number {
    if (!this.tokenExpiresAt) {
      return 0;
    }
    return Math.max(0, this.tokenExpiresAt - Date.now());
  }

  /**
   * Gibt die Zeit bis zum nächsten Refresh in Millisekunden zurück
   */
  getTimeToRefresh(): number {
    if (!this.tokenExpiresAt) {
      return 0;
    }
    
    const refreshTime = this.tokenExpiresAt - TokenStore.REFRESH_BUFFER_MS;
    return Math.max(0, refreshTime - Date.now());
  }

  /**
   * Prüft ob ein Refresh Token vorhanden ist
   */
  async hasRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      return refreshToken !== null;
    } catch {
      return false;
    }
  }

  /**
   * Erstellt einen Keychain-Fehler ohne PII
   */
  private createKeychainError(message: string): AuthError {
    return {
      code: AuthErrorCode.KEYCHAIN_ERROR,
      message,
      timestamp: Date.now(),
      retryable: true,
      retryAfter: 1
    };
  }
}

/**
 * Singleton-Instance für App-weite Nutzung
 */
let tokenStoreInstance: TokenStore | null = null;

export function getTokenStore(secureStorage?: ISecureStorage): TokenStore {
  if (!tokenStoreInstance) {
    tokenStoreInstance = new TokenStore(secureStorage);
  }
  return tokenStoreInstance;
}

/**
 * Für Tests: Reset der Singleton-Instance
 */
export function resetTokenStore(): void {
  tokenStoreInstance = null;
}

export { MockSecureStorage };
