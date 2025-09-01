/**
 * Auth-Service Domänen-Typen
 * User, Session, Error-Typen für sichere Authentifizierung
 */

export interface User {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly provider: 'email' | 'apple';
  readonly createdAt: string;
  readonly lastSignInAt?: string;
}

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number; // Unix timestamp
  readonly user: User;
}

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly loading: boolean;
  readonly error: AuthError | null;
}

/**
 * Auth-spezifische Fehlertypen
 * Keine PII in Fehlermeldungen gemäß .cursorrules
 */
export enum AuthErrorCode {
  // Network & API
  NETWORK_ERROR = 'AUTH_NETWORK_ERROR',
  API_TIMEOUT = 'AUTH_API_TIMEOUT',
  API_ERROR = 'AUTH_API_ERROR',
  
  // Authentication
  INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',
  USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'AUTH_USER_EXISTS',
  
  // Sessions & Tokens
  TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  REFRESH_FAILED = 'AUTH_REFRESH_FAILED',
  SESSION_INVALID = 'AUTH_SESSION_INVALID',
  
  // Apple SSO
  APPLE_CANCELLED = 'AUTH_APPLE_CANCELLED',
  APPLE_FAILED = 'AUTH_APPLE_FAILED',
  APPLE_INVALID_TOKEN = 'AUTH_APPLE_INVALID_TOKEN',
  
  // Security & Storage
  KEYCHAIN_ERROR = 'AUTH_KEYCHAIN_ERROR',
  SECURE_STORAGE_ERROR = 'AUTH_SECURE_STORAGE_ERROR',
  
  // Rate Limiting
  TOO_MANY_REQUESTS = 'AUTH_TOO_MANY_REQUESTS',
  ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  
  // Validation
  INVALID_EMAIL = 'AUTH_INVALID_EMAIL',
  WEAK_PASSWORD = 'AUTH_WEAK_PASSWORD',
  
  // Unknown
  UNKNOWN_ERROR = 'AUTH_UNKNOWN_ERROR'
}

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly timestamp: number;
  readonly retryable: boolean;
  readonly retryAfter?: number; // Sekunden bis zum nächsten Versuch
}

/**
 * Sign-up Request
 */
export interface SignUpRequest {
  readonly email: string;
  readonly password: string;
}

/**
 * Login Request
 */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

/**
 * Apple SSO Request
 */
export interface AppleSignInRequest {
  readonly identityToken: string;
  readonly authorizationCode: string;
  readonly nonce: string;
  readonly email?: string;
  readonly fullName?: {
    readonly givenName?: string;
    readonly familyName?: string;
  };
}

/**
 * Password Reset Request
 */
export interface PasswordResetRequest {
  readonly email: string;
}

/**
 * Token-Refresh-Response
 */
export interface TokenRefreshResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

/**
 * Auth-Events für Telemetrie (ohne PII)
 */
export enum AuthEvent {
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAIL = 'auth.login.fail',
  SIGNUP_SUCCESS = 'auth.signup.success',
  SIGNUP_FAIL = 'auth.signup.fail',
  APPLE_SUCCESS = 'auth.apple.success',
  APPLE_FAIL = 'auth.apple.fail',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH_SUCCESS = 'auth.token.refresh.success',
  TOKEN_REFRESH_FAIL = 'auth.token.refresh.fail',
  AUTO_LOGOUT = 'auth.auto_logout'
}

/**
 * Auth-Service Interface
 */
export interface IAuthService {
  signUp(request: SignUpRequest): Promise<User>;
  signIn(request: LoginRequest): Promise<Session>;
  signInWithApple(request: AppleSignInRequest): Promise<Session>;
  signOut(): Promise<void>;
  resetPassword(request: PasswordResetRequest): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  refreshSession(): Promise<Session>;
  getAuthState(): AuthState;
}

/**
 * Token Store Interface
 */
export interface ITokenStore {
  setTokens(accessToken: string, refreshToken: string, expiresAt: number): Promise<void>;
  getAccessToken(): string | null;
  getRefreshToken(): Promise<string | null>;
  clearTokens(): Promise<void>;
  isAccessTokenExpired(): boolean;
  shouldRefreshToken(): boolean; // Refresh ab T-5min
}
