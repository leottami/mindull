/**
 * Apple SSO Flow Tests
 * Testet Nonce, id_token, Private-Relay, Konto-Verknüpfung und Kantenfälle
 */

import {
  AppleNonceManager,
  AppleTokenValidator,
  PrivateRelayHandler,
  AccountLinkingHandler,
  AppleSSOFlow,
  AppleSignInRequest,
  AppleSignInResponse,
  AppleNonceState,
  PrivateRelayInfo
} from '../../../services/auth/apple.flow';
import { AuthErrorCode } from '../../../services/auth/types';

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthService = {
  signInWithApple: jest.fn(),
  getUserByEmail: jest.fn(),
  linkAppleAccount: jest.fn(),
  unlinkAppleAccount: jest.fn()
};

jest.mock('../../../services/auth/auth.service', () => ({
  getAuthService: () => mockAuthService
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: 14
  }
}));

// Mock crypto.getRandomValues
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  }
});

// ============================================================================
// TEST HELPERS
// ============================================================================

const createMockAppleResponse = (
  overrides: Partial<AppleSignInRequest> = {}
): AppleSignInRequest => ({
  identityToken: 'mock_identity_token',
  authorizationCode: 'mock_auth_code',
  nonce: 'mock_nonce',
  email: 'test@privaterelay.appleid.com',
  fullName: {
    givenName: 'Test',
    familyName: 'User'
  },
  ...overrides
});

const createMockJWT = (payload: any): string => {
  const header = { alg: 'RS256', kid: 'test_key' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.signature`;
};

// ============================================================================
// APPLE NONCE MANAGER TESTS
// ============================================================================

describe('AppleNonceManager', () => {
  let nonceManager: AppleNonceManager;

  beforeEach(() => {
    nonceManager = AppleNonceManager.getInstance();
    nonceManager.reset();
  });

  describe('Nonce Generation', () => {
    it('sollte kryptographisch sichere Nonces generieren', () => {
      const nonce1 = nonceManager.generateNonce('signin');
      const nonce2 = nonceManager.generateNonce('signin');

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('sollte Nonces mit Purpose speichern', () => {
      const signinNonce = nonceManager.generateNonce('signin');
      const signupNonce = nonceManager.generateNonce('signup');
      const linkNonce = nonceManager.generateNonce('link');

      expect(signinNonce).toBeDefined();
      expect(signupNonce).toBeDefined();
      expect(linkNonce).toBeDefined();
    });

    it('sollte Nonces mit Timestamp speichern', () => {
      const nonce = nonceManager.generateNonce('signin');
      const stats = nonceManager.getStats();

      expect(stats.activeNonces).toBe(1);
    });
  });

  describe('Nonce Validation', () => {
    it('sollte gültige Nonces akzeptieren', () => {
      const nonce = nonceManager.generateNonce('signin');
      const isValid = nonceManager.validateNonce(nonce, 'signin');

      expect(isValid).toBe(true);
    });

    it('sollte unbekannte Nonces ablehnen', () => {
      const isValid = nonceManager.validateNonce('unknown_nonce', 'signin');

      expect(isValid).toBe(false);
    });

    it('sollte Nonces mit falschem Purpose ablehnen', () => {
      const nonce = nonceManager.generateNonce('signin');
      const isValid = nonceManager.validateNonce(nonce, 'signup');

      expect(isValid).toBe(false);
    });

    it('sollte abgelaufene Nonces ablehnen', () => {
      const nonce = nonceManager.generateNonce('signin');
      
      // Simuliere Zeitablauf
      jest.advanceTimersByTime(11 * 60 * 1000); // 11 Minuten
      
      const isValid = nonceManager.validateNonce(nonce, 'signin');
      expect(isValid).toBe(false);
    });

    it('sollte zu alte Nonces ablehnen', () => {
      const nonce = nonceManager.generateNonce('signin');
      
      // Simuliere 6 Minuten Verzögerung
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      const isValid = nonceManager.validateNonce(nonce, 'signin');
      expect(isValid).toBe(false);
    });

    it('sollte Nonces nach Validierung löschen', () => {
      const nonce = nonceManager.generateNonce('signin');
      
      // Erste Validierung
      const isValid1 = nonceManager.validateNonce(nonce, 'signin');
      expect(isValid1).toBe(true);
      
      // Zweite Validierung sollte fehlschlagen
      const isValid2 = nonceManager.validateNonce(nonce, 'signin');
      expect(isValid2).toBe(false);
    });
  });

  describe('Nonce Cleanup', () => {
    it('sollte abgelaufene Nonces automatisch bereinigen', () => {
      const nonce1 = nonceManager.generateNonce('signin');
      const nonce2 = nonceManager.generateNonce('signin');
      
      expect(nonceManager.getStats().activeNonces).toBe(2);
      
      // Simuliere Zeitablauf für ersten Nonce
      jest.advanceTimersByTime(11 * 60 * 1000);
      
      // Generiere neuen Nonce (triggers cleanup)
      const nonce3 = nonceManager.generateNonce('signin');
      
      expect(nonceManager.getStats().activeNonces).toBe(2); // nonce2 und nonce3
    });
  });

  describe('Statistics', () => {
    it('sollte korrekte Statistiken zurückgeben', () => {
      expect(nonceManager.getStats().activeNonces).toBe(0);
      
      nonceManager.generateNonce('signin');
      nonceManager.generateNonce('signup');
      
      const stats = nonceManager.getStats();
      expect(stats.activeNonces).toBe(2);
      expect(stats.totalGenerated).toBe(2);
    });
  });
});

// ============================================================================
// APPLE TOKEN VALIDATOR TESTS
// ============================================================================

describe('AppleTokenValidator', () => {
  let tokenValidator: AppleTokenValidator;

  beforeEach(() => {
    tokenValidator = AppleTokenValidator.getInstance();
  });

  describe('JWT Format Validation', () => {
    it('sollte gültige JWT-Formate akzeptieren', async () => {
      const validJWT = 'header.payload.signature';
      const result = await tokenValidator.validateIdToken(validJWT, 'test_nonce');
      
      expect(result.valid).toBe(false); // Weil Payload ungültig ist
      expect(result.error).toBe('Invalid JWT payload');
    });

    it('sollte ungültige JWT-Formate ablehnen', async () => {
      const invalidJWT = 'invalid_jwt_format';
      const result = await tokenValidator.validateIdToken(invalidJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JWT format');
    });
  });

  describe('JWT Claims Validation', () => {
    it('sollte gültige Claims akzeptieren', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.mindull.app',
        exp: now + 3600,
        iat: now,
        nonce: 'test_nonce',
        sub: 'apple_user_123'
      };
      
      const validJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(validJWT, 'test_nonce');
      
      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it('sollte ungültigen Issuer ablehnen', async () => {
      const payload = {
        iss: 'https://invalid.issuer.com',
        aud: 'com.mindull.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: 'test_nonce',
        sub: 'apple_user_123'
      };
      
      const invalidJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(invalidJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid issuer');
    });

    it('sollte ungültige Audience ablehnen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.wrong.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: 'test_nonce',
        sub: 'apple_user_123'
      };
      
      const invalidJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(invalidJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid audience');
    });

    it('sollte abgelaufene Tokens ablehnen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.mindull.app',
        exp: Math.floor(Date.now() / 1000) - 3600, // Abgelaufen
        iat: Math.floor(Date.now() / 1000) - 7200,
        nonce: 'test_nonce',
        sub: 'apple_user_123'
      };
      
      const expiredJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(expiredJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('sollte Tokens aus der Zukunft ablehnen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.mindull.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) + 1800, // In der Zukunft
        nonce: 'test_nonce',
        sub: 'apple_user_123'
      };
      
      const futureJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(futureJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token issued in future');
    });

    it('sollte ungültigen Nonce ablehnen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.mindull.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: 'wrong_nonce',
        sub: 'apple_user_123'
      };
      
      const invalidNonceJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(invalidNonceJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid nonce');
    });

    it('sollte fehlendes Subject ablehnen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com',
        aud: 'com.mindull.app',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: 'test_nonce'
        // sub fehlt
      };
      
      const missingSubjectJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(missingSubjectJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing subject');
    });
  });

  describe('Error Handling', () => {
    it('sollte mit ungültigen JWT-Payloads umgehen', async () => {
      const invalidJWT = 'header.invalid_payload.signature';
      const result = await tokenValidator.validateIdToken(invalidJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JWT payload');
    });

    it('sollte mit fehlenden Claims umgehen', async () => {
      const payload = {
        iss: 'https://appleid.apple.com'
        // Andere Claims fehlen
      };
      
      const incompleteJWT = createMockJWT(payload);
      const result = await tokenValidator.validateIdToken(incompleteJWT, 'test_nonce');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid audience');
    });
  });
});

// ============================================================================
// PRIVATE RELAY HANDLER TESTS
// ============================================================================

describe('PrivateRelayHandler', () => {
  describe('Private Relay Detection', () => {
    it('sollte Private Relay E-Mail-Adressen erkennen', () => {
      const privateRelayEmails = [
        'user@privaterelay.appleid.com',
        'test@privaterelay.apple.com',
        'user.123@privaterelay.appleid.com'
      ];

      privateRelayEmails.forEach(email => {
        expect(PrivateRelayHandler.isPrivateRelay(email)).toBe(true);
      });
    });

    it('sollte normale E-Mail-Adressen nicht als Private Relay erkennen', () => {
      const normalEmails = [
        'user@gmail.com',
        'test@example.com',
        'user@company.com'
      ];

      normalEmails.forEach(email => {
        expect(PrivateRelayHandler.isPrivateRelay(email)).toBe(false);
      });
    });

    it('sollte mit leeren E-Mail-Adressen umgehen', () => {
      expect(PrivateRelayHandler.isPrivateRelay('')).toBe(false);
      expect(PrivateRelayHandler.isPrivateRelay(null as any)).toBe(false);
      expect(PrivateRelayHandler.isPrivateRelay(undefined as any)).toBe(false);
    });
  });

  describe('Relay Info Extraction', () => {
    it('sollte Private Relay Informationen extrahieren', () => {
      const email = 'user.123@privaterelay.appleid.com';
      const relayInfo = PrivateRelayHandler.extractRelayInfo(email);

      expect(relayInfo.isPrivateRelay).toBe(true);
      expect(relayInfo.relayDomain).toBe('privaterelay.appleid.com');
      expect(relayInfo.originalEmail).toBe('user.123');
    });

    it('sollte normale E-Mail-Adressen korrekt behandeln', () => {
      const email = 'user@gmail.com';
      const relayInfo = PrivateRelayHandler.extractRelayInfo(email);

      expect(relayInfo.isPrivateRelay).toBe(false);
      expect(relayInfo.relayDomain).toBe('');
      expect(relayInfo.originalEmail).toBeUndefined();
    });

    it('sollte mit komplexen E-Mail-Adressen umgehen', () => {
      const email = 'user+tag.123@privaterelay.apple.com';
      const relayInfo = PrivateRelayHandler.extractRelayInfo(email);

      expect(relayInfo.isPrivateRelay).toBe(true);
      expect(relayInfo.relayDomain).toBe('privaterelay.apple.com');
      expect(relayInfo.originalEmail).toBe('user+tag.123');
    });
  });

  describe('Test Relay Email Generation', () => {
    it('sollte Test Private Relay E-Mails generieren', () => {
      const testEmail = PrivateRelayHandler.generateTestRelayEmail();
      
      expect(PrivateRelayHandler.isPrivateRelay(testEmail)).toBe(true);
      expect(testEmail).toMatch(/^user\.[a-z0-9]+@privaterelay\.appleid\.com$/);
    });

    it('sollte Test E-Mails mit Original-E-Mail generieren', () => {
      const originalEmail = 'john.doe@gmail.com';
      const testEmail = PrivateRelayHandler.generateTestRelayEmail(originalEmail);
      
      expect(PrivateRelayHandler.isPrivateRelay(testEmail)).toBe(true);
      expect(testEmail).toMatch(/^john\.doe\.[a-z0-9]+@privaterelay\.appleid\.com$/);
    });
  });

  describe('Relay Email Validation', () => {
    it('sollte gültige Private Relay E-Mails validieren', () => {
      const validEmails = [
        'user@privaterelay.appleid.com',
        'test@privaterelay.apple.com',
        'user.123@privaterelay.appleid.com'
      ];

      validEmails.forEach(email => {
        expect(PrivateRelayHandler.validateRelayEmail(email)).toBe(true);
      });
    });

    it('sollte ungültige E-Mail-Formate ablehnen', () => {
      const invalidEmails = [
        'invalid-email',
        '@privaterelay.appleid.com',
        'user@',
        'user@invalid-domain.com'
      ];

      invalidEmails.forEach(email => {
        expect(PrivateRelayHandler.validateRelayEmail(email)).toBe(false);
      });
    });
  });
});

// ============================================================================
// ACCOUNT LINKING HANDLER TESTS
// ============================================================================

describe('AccountLinkingHandler', () => {
  let accountLinking: AccountLinkingHandler;

  beforeEach(() => {
    accountLinking = new AccountLinkingHandler();
    jest.clearAllMocks();
  });

  describe('Account Linking Possibility', () => {
    it('sollte Account-Linking für verschiedene E-Mails erlauben', async () => {
      const existingUser = { id: '123', email: 'existing@example.com' };
      mockAuthService.getUserByEmail
        .mockResolvedValueOnce(existingUser) // existingEmail
        .mockResolvedValueOnce(null); // appleEmail

      const result = await accountLinking.canLinkAccount(
        'apple@privaterelay.appleid.com',
        'existing@example.com'
      );

      expect(result.canLink).toBe(true);
      expect(result.existingUser).toEqual(existingUser);
    });

    it('sollte Account-Linking für identische E-Mails ablehnen', async () => {
      const result = await accountLinking.canLinkAccount(
        'same@example.com',
        'same@example.com'
      );

      expect(result.canLink).toBe(false);
      expect(result.reason).toBe('Emails are identical');
    });

    it('sollte Account-Linking ablehnen wenn bestehender User nicht existiert', async () => {
      mockAuthService.getUserByEmail.mockResolvedValue(null);

      const result = await accountLinking.canLinkAccount(
        'apple@privaterelay.appleid.com',
        'nonexistent@example.com'
      );

      expect(result.canLink).toBe(false);
      expect(result.reason).toBe('Existing user not found');
    });

    it('sollte Account-Linking ablehnen wenn User bereits Apple SSO hat', async () => {
      const existingUser = { 
        id: '123', 
        email: 'existing@example.com',
        appleId: 'apple_123'
      };
      mockAuthService.getUserByEmail
        .mockResolvedValueOnce(existingUser) // existingEmail
        .mockResolvedValueOnce(null); // appleEmail

      const result = await accountLinking.canLinkAccount(
        'apple@privaterelay.appleid.com',
        'existing@example.com'
      );

      expect(result.canLink).toBe(false);
      expect(result.reason).toBe('User already has Apple SSO linked');
    });

    it('sollte Account-Linking ablehnen wenn Apple E-Mail bereits verwendet wird', async () => {
      const existingUser = { id: '123', email: 'existing@example.com' };
      const appleUser = { id: '456', email: 'apple@privaterelay.appleid.com' };
      
      mockAuthService.getUserByEmail
        .mockResolvedValueOnce(existingUser) // existingEmail
        .mockResolvedValueOnce(appleUser); // appleEmail

      const result = await accountLinking.canLinkAccount(
        'apple@privaterelay.appleid.com',
        'existing@example.com'
      );

      expect(result.canLink).toBe(false);
      expect(result.reason).toBe('Apple email already in use');
    });
  });

  describe('Account Linking Execution', () => {
    it('sollte erfolgreiches Account-Linking durchführen', async () => {
      const existingUser = { id: '123', email: 'existing@example.com' };
      const linkedUser = { 
        id: '123', 
        email: 'existing@example.com',
        appleId: 'apple_123',
        appleEmail: 'apple@privaterelay.appleid.com'
      };

      mockAuthService.getUserByEmail
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      
      mockAuthService.linkAppleAccount.mockResolvedValue({
        user: linkedUser
      });

      const result = await accountLinking.linkAccount(
        'apple_123',
        'apple@privaterelay.appleid.com',
        'existing@example.com',
        'auth_code_123'
      );

      expect(result.success).toBe(true);
      expect(result.user).toEqual(linkedUser);
    });

    it('sollte Account-Linking-Fehler behandeln', async () => {
      mockAuthService.getUserByEmail
        .mockResolvedValueOnce({ id: '123', email: 'existing@example.com' })
        .mockResolvedValueOnce(null);
      
      mockAuthService.linkAppleAccount.mockRejectedValue(
        new Error('Linking failed')
      );

      const result = await accountLinking.linkAccount(
        'apple_123',
        'apple@privaterelay.appleid.com',
        'existing@example.com',
        'auth_code_123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Account Unlinking', () => {
    it('sollte erfolgreiches Account-Unlinking durchführen', async () => {
      mockAuthService.unlinkAppleAccount.mockResolvedValue(undefined);

      const result = await accountLinking.unlinkAccount('user_123');

      expect(result.success).toBe(true);
      expect(mockAuthService.unlinkAppleAccount).toHaveBeenCalledWith('user_123');
    });

    it('sollte Unlinking-Fehler behandeln', async () => {
      mockAuthService.unlinkAppleAccount.mockRejectedValue(
        new Error('Unlinking failed')
      );

      const result = await accountLinking.unlinkAccount('user_123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// APPLE SSO FLOW TESTS
// ============================================================================

describe('AppleSSOFlow', () => {
  let flow: AppleSSOFlow;

  beforeEach(() => {
    flow = new AppleSSOFlow();
    jest.clearAllMocks();
  });

  describe('Sign-In Flow', () => {
    it('sollte erfolgreichen Sign-In durchführen', async () => {
      const mockResponse = createMockAppleResponse();
      const mockUser = {
        id: '123',
        email: 'test@privaterelay.appleid.com',
        emailVerified: true
      };

      mockAuthService.signInWithApple.mockResolvedValue({
        user: mockUser,
        isNewUser: true
      });

      const result = await flow.handleSignInResponse(mockResponse, 'signin');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: '123',
        email: 'test@privaterelay.appleid.com',
        emailVerified: true,
        isNewUser: true,
        linkedToExistingAccount: false
      });
    });

    it('sollte ungültigen Nonce ablehnen', async () => {
      const mockResponse = createMockAppleResponse({ nonce: 'invalid_nonce' });

      const result = await flow.handleSignInResponse(mockResponse, 'signin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AuthErrorCode.APPLE_INVALID_NONCE);
    });

    it('sollte ungültigen Token ablehnen', async () => {
      const mockResponse = createMockAppleResponse({
        identityToken: 'invalid_token'
      });

      const result = await flow.handleSignInResponse(mockResponse, 'signin');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AuthErrorCode.APPLE_INVALID_TOKEN);
    });

    it('sollte Auth-Service-Fehler behandeln', async () => {
      const mockResponse = createMockAppleResponse();
      
      mockAuthService.signInWithApple.mockRejectedValue(
        new Error('Auth service error')
      );

      const result = await flow.handleSignInResponse(mockResponse, 'signin');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Account Linking Flow', () => {
    it('sollte Account-Linking erfolgreich durchführen', async () => {
      const mockResponse = createMockAppleResponse({
        email: 'apple@privaterelay.appleid.com'
      });

      const existingUser = { id: '123', email: 'existing@example.com' };
      const linkedUser = { 
        id: '123', 
        email: 'existing@example.com',
        appleId: 'apple_123'
      };

      mockAuthService.getUserByEmail
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      
      mockAuthService.linkAppleAccount.mockResolvedValue({
        user: linkedUser
      });

      const result = await flow.handleSignInResponse(mockResponse, 'link');

      expect(result.success).toBe(true);
      expect(result.user?.linkedToExistingAccount).toBe(true);
    });

    it('sollte Account-Linking ohne E-Mail ablehnen', async () => {
      const mockResponse = createMockAppleResponse({
        email: undefined
      });

      const result = await flow.handleSignInResponse(mockResponse, 'link');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AuthErrorCode.APPLE_EMAIL_REQUIRED);
    });
  });

  describe('Error Handling', () => {
    it('sollte Apple Sign-In Abbruch behandeln', () => {
      const error = flow.handleCancellation();

      expect(error.code).toBe(AuthErrorCode.APPLE_CANCELLED);
      expect(error.message).toBe('Apple Sign-In was cancelled by user');
    });

    it('sollte allgemeine Apple-Fehler behandeln', () => {
      const mockError = new Error('Apple API error');
      const error = flow.handleError(mockError);

      expect(error).toBeDefined();
      expect(error.code).toBe(AuthErrorCode.APPLE_FAILED);
    });
  });

  describe('Availability Check', () => {
    it('sollte Verfügbarkeit auf iOS 13+ bestätigen', () => {
      const isAvailable = flow.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('sollte Verfügbarkeit auf älteren iOS-Versionen ablehnen', () => {
      // Mock ältere iOS-Version
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
          Version: 12
        }
      }));

      const isAvailable = flow.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('sollte Verfügbarkeit auf Android ablehnen', () => {
      // Mock Android
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          Version: 30
        }
      }));

      const isAvailable = flow.isAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('sollte Flow-Statistiken zurückgeben', () => {
      const stats = flow.getStats();

      expect(stats.isAvailable).toBe(true);
      expect(stats.nonceStats).toBeDefined();
      expect(stats.nonceStats.activeNonces).toBe(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Apple SSO Integration', () => {
  let flow: AppleSSOFlow;

  beforeEach(() => {
    flow = new AppleSSOFlow();
    jest.clearAllMocks();
  });

  it('sollte vollständigen Apple Sign-In Flow simulieren', async () => {
    // 1. Sign-In starten
    const { nonce, config } = await flow.startSignIn('signin');
    
    expect(nonce).toBeDefined();
    expect(config.clientId).toBe('com.mindull.app');

    // 2. Apple Response simulieren
    const mockResponse = createMockAppleResponse({ nonce });
    const mockUser = {
      id: '123',
      email: 'test@privaterelay.appleid.com',
      emailVerified: true
    };

    mockAuthService.signInWithApple.mockResolvedValue({
      user: mockUser,
      isNewUser: true
    });

    // 3. Response verarbeiten
    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(true);
    expect(result.user?.isNewUser).toBe(true);
  });

  it('sollte Private Relay E-Mail korrekt behandeln', async () => {
    const mockResponse = createMockAppleResponse({
      email: 'user.abc123@privaterelay.appleid.com'
    });

    const mockUser = {
      id: '123',
      email: 'user.abc123@privaterelay.appleid.com',
      emailVerified: true
    };

    mockAuthService.signInWithApple.mockResolvedValue({
      user: mockUser,
      isNewUser: true
    });

    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(true);
    expect(PrivateRelayHandler.isPrivateRelay(result.user!.email)).toBe(true);
  });

  it('sollte Account-Linking mit Private Relay durchführen', async () => {
    const mockResponse = createMockAppleResponse({
      email: 'existing.abc123@privaterelay.appleid.com'
    });

    const existingUser = { id: '123', email: 'existing@example.com' };
    const linkedUser = { 
      id: '123', 
      email: 'existing@example.com',
      appleId: 'apple_123'
    };

    mockAuthService.getUserByEmail
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(null);
    
    mockAuthService.linkAppleAccount.mockResolvedValue({
      user: linkedUser
    });

    const result = await flow.handleSignInResponse(mockResponse, 'link');

    expect(result.success).toBe(true);
    expect(result.user?.linkedToExistingAccount).toBe(true);
  });
});

// ============================================================================
// EDGE CASES & ERROR SCENARIOS
// ============================================================================

describe('Apple SSO Edge Cases', () => {
  let flow: AppleSSOFlow;

  beforeEach(() => {
    flow = new AppleSSOFlow();
    jest.clearAllMocks();
  });

  it('sollte mit fehlenden Token-Feldern umgehen', async () => {
    const mockResponse = createMockAppleResponse({
      identityToken: undefined,
      authorizationCode: undefined
    });

    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(AuthErrorCode.APPLE_INVALID_TOKEN);
  });

  it('sollte mit sehr langen E-Mail-Adressen umgehen', async () => {
    const longEmail = 'a'.repeat(100) + '@privaterelay.appleid.com';
    const mockResponse = createMockAppleResponse({ email: longEmail });

    const mockUser = { id: '123', email: longEmail, emailVerified: true };
    mockAuthService.signInWithApple.mockResolvedValue({
      user: mockUser,
      isNewUser: true
    });

    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(true);
    expect(result.user?.email).toBe(longEmail);
  });

  it('sollte mit Sonderzeichen in E-Mail-Adressen umgehen', async () => {
    const specialEmail = 'user+tag.123@privaterelay.appleid.com';
    const mockResponse = createMockAppleResponse({ email: specialEmail });

    const mockUser = { id: '123', email: specialEmail, emailVerified: true };
    mockAuthService.signInWithApple.mockResolvedValue({
      user: mockUser,
      isNewUser: true
    });

    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(true);
    expect(PrivateRelayHandler.isPrivateRelay(result.user!.email)).toBe(true);
  });

  it('sollte mit mehrfachen gleichzeitigen Sign-In-Versuchen umgehen', async () => {
    const nonce1 = flow['nonceManager'].generateNonce('signin');
    const nonce2 = flow['nonceManager'].generateNonce('signin');

    expect(nonce1).not.toBe(nonce2);

    const mockResponse1 = createMockAppleResponse({ nonce: nonce1 });
    const mockResponse2 = createMockAppleResponse({ nonce: nonce2 });

    const mockUser = { id: '123', email: 'test@example.com', emailVerified: true };
    mockAuthService.signInWithApple.mockResolvedValue({
      user: mockUser,
      isNewUser: true
    });

    const result1 = await flow.handleSignInResponse(mockResponse1, 'signin');
    const result2 = await flow.handleSignInResponse(mockResponse2, 'signin');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it('sollte mit Netzwerkfehlern umgehen', async () => {
    const mockResponse = createMockAppleResponse();
    
    mockAuthService.signInWithApple.mockRejectedValue(
      new Error('Network request failed')
    );

    const result = await flow.handleSignInResponse(mockResponse, 'signin');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
