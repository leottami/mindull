/**
 * Auth-Policies - Passwort-Validation und Rate-Limiting
 * Clientseitige Sicherheitsrichtlinien gemäß AUTH.BRIEF
 */

import { AuthError, AuthErrorCode } from './types';

/**
 * Passwort-Policy Konfiguration
 */
export interface PasswordPolicy {
  readonly minLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumbers: boolean;
  readonly requireSpecialChars: boolean;
  readonly maxLength: number;
}

/**
 * Standard Passwort-Policy für mindull
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Benutzerfreundlichkeit
  maxLength: 128
};

/**
 * Rate-Limiting Konfiguration
 */
export interface RateLimitConfig {
  readonly maxAttempts: number;
  readonly windowMs: number; // Zeitfenster in Millisekunden
  readonly lockoutMs: number; // Sperrzeit in Millisekunden
  readonly backoffMultiplier: number; // Exponential backoff
}

/**
 * Standard Rate-Limit-Konfiguration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 Minuten
  lockoutMs: 15 * 60 * 1000, // 15 Minuten Sperre
  backoffMultiplier: 2
};

/**
 * Attempt-Tracking für Rate-Limiting
 */
interface AttemptRecord {
  readonly count: number;
  readonly firstAttempt: number;
  readonly lastAttempt: number;
  readonly lockedUntil?: number;
}

/**
 * Passwort-Validator
 */
export class PasswordValidator {
  constructor(private policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {}

  /**
   * Validiert ein Passwort gegen die Policy
   * @param password Das zu validierende Passwort
   * @returns AuthError wenn ungültig, null wenn gültig
   */
  validate(password: string): AuthError | null {
    // Längen-Validierung
    if (password.length < this.policy.minLength) {
      return this.createPasswordError(`Passwort muss mindestens ${this.policy.minLength} Zeichen lang sein`);
    }

    if (password.length > this.policy.maxLength) {
      return this.createPasswordError(`Passwort darf maximal ${this.policy.maxLength} Zeichen lang sein`);
    }

    // Großbuchstaben
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      return this.createPasswordError('Passwort muss mindestens einen Großbuchstaben enthalten');
    }

    // Kleinbuchstaben
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      return this.createPasswordError('Passwort muss mindestens einen Kleinbuchstaben enthalten');
    }

    // Zahlen
    if (this.policy.requireNumbers && !/\d/.test(password)) {
      return this.createPasswordError('Passwort muss mindestens eine Zahl enthalten');
    }

    // Sonderzeichen
    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return this.createPasswordError('Passwort muss mindestens ein Sonderzeichen enthalten');
    }

    return null; // Passwort ist gültig
  }

  /**
   * Berechnet die Passwort-Stärke (0-100)
   */
  calculateStrength(password: string): number {
    let score = 0;
    const maxScore = 100;

    // Länge (40% der Gesamtpunktzahl)
    const lengthScore = Math.min(40, (password.length / 12) * 40);
    score += lengthScore;

    // Zeichenvielfalt (60% der Gesamtpunktzahl)
    const variety = [
      /[a-z]/.test(password), // Kleinbuchstaben
      /[A-Z]/.test(password), // Großbuchstaben
      /\d/.test(password),    // Zahlen
      /[!@#$%^&*(),.?":{}|<>]/.test(password) // Sonderzeichen
    ];

    const varietyScore = (variety.filter(Boolean).length / 4) * 60;
    score += varietyScore;

    return Math.min(maxScore, Math.round(score));
  }

  private createPasswordError(message: string): AuthError {
    return {
      code: AuthErrorCode.WEAK_PASSWORD,
      message,
      timestamp: Date.now(),
      retryable: true
    };
  }
}

/**
 * E-Mail-Validator
 */
export class EmailValidator {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validiert eine E-Mail-Adresse
   */
  static validate(email: string): AuthError | null {
    if (!email || email.trim().length === 0) {
      return {
        code: AuthErrorCode.INVALID_EMAIL,
        message: 'E-Mail-Adresse ist erforderlich',
        timestamp: Date.now(),
        retryable: true
      };
    }

    if (!this.EMAIL_REGEX.test(email.trim())) {
      return {
        code: AuthErrorCode.INVALID_EMAIL,
        message: 'Ungültige E-Mail-Adresse',
        timestamp: Date.now(),
        retryable: true
      };
    }

    return null;
  }
}

/**
 * Rate-Limiter für Auth-Anfragen
 * Clientseitige Implementierung gemäß AUTH.BRIEF
 */
export class AuthRateLimiter {
  private attempts = new Map<string, AttemptRecord>();
  
  constructor(private config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {}

  /**
   * Prüft ob eine Anfrage erlaubt ist
   * @param identifier Eindeutige Kennung (z.B. E-Mail oder IP)
   * @returns AuthError wenn Rate-Limit überschritten, null wenn erlaubt
   */
  checkRateLimit(identifier: string): AuthError | null {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    // Erste Anfrage
    if (!record) {
      return null;
    }

    // Prüfe ob Account gesperrt ist
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        code: AuthErrorCode.ACCOUNT_LOCKED,
        message: 'Account ist temporär gesperrt',
        timestamp: now,
        retryable: true,
        retryAfter: remainingSeconds
      };
    }

    // Prüfe Zeitfenster
    const windowStart = now - this.config.windowMs;
    if (record.firstAttempt < windowStart) {
      // Zeitfenster ist abgelaufen, Reset
      this.attempts.delete(identifier);
      return null;
    }

    // Prüfe Anzahl Versuche
    if (record.count >= this.config.maxAttempts) {
      return {
        code: AuthErrorCode.TOO_MANY_REQUESTS,
        message: 'Zu viele Versuche',
        timestamp: now,
        retryable: true,
        retryAfter: Math.ceil(this.config.lockoutMs / 1000)
      };
    }

    return null;
  }

  /**
   * Registriert einen fehlgeschlagenen Versuch
   */
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const existing = this.attempts.get(identifier);

    if (!existing) {
      // Erster Versuch
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return;
    }

    const windowStart = now - this.config.windowMs;
    if (existing.firstAttempt < windowStart) {
      // Neues Zeitfenster
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return;
    }

    // Inkrement im aktuellen Zeitfenster
    const newCount = existing.count + 1;
    let lockedUntil: number | undefined;

    // Sperre bei Überschreitung
    if (newCount >= this.config.maxAttempts) {
      const backoffTime = this.config.lockoutMs * Math.pow(this.config.backoffMultiplier, newCount - this.config.maxAttempts);
      lockedUntil = now + backoffTime;
    }

    this.attempts.set(identifier, {
      count: newCount,
      firstAttempt: existing.firstAttempt,
      lastAttempt: now,
      lockedUntil
    });
  }

  /**
   * Registriert einen erfolgreichen Versuch (Reset)
   */
  recordSuccessfulAttempt(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Bereinigt abgelaufene Einträge
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    for (const [identifier, record] of this.attempts.entries()) {
      if (record.firstAttempt < cutoff && (!record.lockedUntil || now > record.lockedUntil)) {
        this.attempts.delete(identifier);
      }
    }
  }

  /**
   * Gibt die Anzahl der Versuche für einen Identifier zurück
   */
  getAttemptCount(identifier: string): number {
    return this.attempts.get(identifier)?.count || 0;
  }

  /**
   * Prüft ob ein Identifier gesperrt ist
   */
  isLocked(identifier: string): boolean {
    const record = this.attempts.get(identifier);
    if (!record?.lockedUntil) {
      return false;
    }
    return Date.now() < record.lockedUntil;
  }

  /**
   * Reset für Tests
   */
  reset(): void {
    this.attempts.clear();
  }
}

/**
 * Singleton-Instanzen für App-weite Nutzung
 */
export const passwordValidator = new PasswordValidator();
export const authRateLimiter = new AuthRateLimiter();
