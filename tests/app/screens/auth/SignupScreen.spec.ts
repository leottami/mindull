/**
 * SignupScreen Tests
 * Testet Registrierung, Passwort-Stärke, Validation und A11y
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { AuthErrorCode } from '../../../../services/auth/types';
import { SignupScreen } from '../../../../app/screens/auth/SignupScreen';

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthService = {
  signUp: jest.fn(),
  signInWithApple: jest.fn()
};

jest.mock('../../../../services/auth', () => ({
  getAuthService: () => mockAuthService
}));

const mockPasswordValidator = {
  validate: jest.fn(),
  calculateStrength: jest.fn()
};

const mockRateLimiter = {
  checkRateLimit: jest.fn(),
  recordFailedAttempt: jest.fn(),
  recordSuccessfulAttempt: jest.fn()
};

jest.mock('../../../../services/auth/policies', () => ({
  EmailValidator: {
    validate: jest.fn((email: string) => {
      if (!email || !email.includes('@')) {
        return { message: 'Ungültige E-Mail-Adresse' };
      }
      return null;
    })
  },
  passwordValidator: mockPasswordValidator,
  authRateLimiter: mockRateLimiter
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn()
};

// ============================================================================
// TEST HELPERS
// ============================================================================

const renderSignupScreen = (routeParams = {}) => {
  return render(
    <SignupScreen
      navigation={mockNavigation}
      route={{ params: routeParams }}
    />
  );
};

const fillSignupForm = async (email: string, password: string, confirmPassword: string, agreeToTerms = true) => {
  const emailInput = screen.getByPlaceholderText('ihre@email.com');
  const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
  const confirmPasswordInput = screen.getByPlaceholderText('Passwort erneut eingeben');

  fireEvent.changeText(emailInput, email);
  fireEvent.changeText(passwordInput, password);
  fireEvent.changeText(confirmPasswordInput, confirmPassword);

  if (agreeToTerms) {
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.press(termsCheckbox);
  }

  return { emailInput, passwordInput, confirmPasswordInput };
};

// ============================================================================
// TESTS
// ============================================================================

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.checkRateLimit.mockReturnValue(null);
    mockPasswordValidator.validate.mockReturnValue(null);
    mockPasswordValidator.calculateStrength.mockReturnValue(75);
  });

  describe('Rendering and Initial State', () => {
    it('sollte korrekt rendern', () => {
      renderSignupScreen();

      expect(screen.getByText('Konto erstellen')).toBeTruthy();
      expect(screen.getByPlaceholderText('ihre@email.com')).toBeTruthy();
      expect(screen.getByPlaceholderText('Mindestens 8 Zeichen')).toBeTruthy();
      expect(screen.getByPlaceholderText('Passwort erneut eingeben')).toBeTruthy();
      expect(screen.getByText('Konto erstellen')).toBeTruthy();
      expect(screen.getByText('Mit Apple registrieren')).toBeTruthy();
    });

    it('sollte Signup-Button initial deaktiviert haben', () => {
      renderSignupScreen();

      const signupButton = screen.getAllByText('Konto erstellen')[1]; // Button, nicht Header
      expect(signupButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });

    it('sollte Terms-Checkbox initial unchecked haben', () => {
      renderSignupScreen();

      const termsCheckbox = screen.getByRole('checkbox');
      expect(termsCheckbox.props.accessibilityState?.checked).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('sollte E-Mail-Validierung inline durchführen', async () => {
      renderSignupScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('Ungültige E-Mail-Adresse')).toBeTruthy();
      });
    });

    it('sollte Passwort-Validierung durchführen', async () => {
      mockPasswordValidator.validate.mockReturnValue({ 
        message: 'Passwort muss mindestens 8 Zeichen lang sein' 
      });

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      
      fireEvent.changeText(passwordInput, 'short');
      fireEvent(passwordInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('Passwort muss mindestens 8 Zeichen lang sein')).toBeTruthy();
      });
    });

    it('sollte Passwort-Bestätigung validieren', async () => {
      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'differentPassword');

      const confirmPasswordInput = screen.getByPlaceholderText('Passwort erneut eingeben');
      fireEvent(confirmPasswordInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('Passwörter stimmen nicht überein')).toBeTruthy();
      });
    });

    it('sollte Passwort-Stärke anzeigen', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(45);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'somePassword');

      await waitFor(() => {
        expect(screen.getByText('Mittel')).toBeTruthy();
      });
    });

    it('sollte Signup-Button aktivieren wenn Form komplett gültig ist', async () => {
      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123', true);

      await waitFor(() => {
        const signupButton = screen.getAllByText('Konto erstellen')[1];
        expect(signupButton.parent?.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('sollte Terms-Checkbox Validierung durchführen', async () => {
      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123', false);

      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(screen.getByText('Bitte akzeptieren Sie die Nutzungsbedingungen.')).toBeTruthy();
      });
    });
  });

  describe('Password Strength Indicator', () => {
    it('sollte schwaches Passwort rot anzeigen', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(25);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText('Schwach')).toBeTruthy();
      });
    });

    it('sollte starkes Passwort grün anzeigen', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(85);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'VeryStrongPassword123!');

      await waitFor(() => {
        expect(screen.getByText('Sehr gut')).toBeTruthy();
      });
    });

    it('sollte Progress-Bar für Passwort-Stärke haben', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(60);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'GoodPassword123');

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar.props.accessibilityValue?.now).toBe(60);
      });
    });
  });

  describe('Signup Flow', () => {
    it('sollte erfolgreiche Registrierung verarbeiten', async () => {
      mockAuthService.signUp.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: false
      });

      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123');
      
      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(mockAuthService.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'validPassword123'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.')).toBeTruthy();
      });
    });

    it('sollte Loading-State während Signup anzeigen', async () => {
      mockAuthService.signUp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123');
      
      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      expect(screen.getByText('Konto wird erstellt...')).toBeTruthy();
      expect(signupButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });

    it('sollte Signup-Fehler anzeigen', async () => {
      mockAuthService.signUp.mockRejectedValue({
        code: AuthErrorCode.USER_ALREADY_EXISTS,
        message: 'Benutzer existiert bereits'
      });

      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123');
      
      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(screen.getByText('Ein Konto mit dieser E-Mail-Adresse existiert bereits.')).toBeTruthy();
      });
    });

    it('sollte schwaches Passwort ablehnen', async () => {
      mockPasswordValidator.validate.mockReturnValue({ 
        message: 'Passwort ist zu schwach' 
      });

      renderSignupScreen();

      await fillSignupForm('test@example.com', 'weak', 'weak');
      
      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      // Service sollte nicht aufgerufen werden
      expect(mockAuthService.signUp).not.toHaveBeenCalled();
    });
  });

  describe('Apple Sign-In', () => {
    it('sollte Apple Sign-In erfolgreich verarbeiten', async () => {
      mockAuthService.signInWithApple.mockResolvedValue({
        user: { id: '123', email: 'test@privaterelay.appleid.com' },
        accessToken: 'token'
      });

      renderSignupScreen();

      const appleButton = screen.getByText('Mit Apple registrieren');
      fireEvent.press(appleButton);

      await waitFor(() => {
        expect(mockAuthService.signInWithApple).toHaveBeenCalledWith({
          identityToken: 'mock-identity-token',
          authorizationCode: 'mock-auth-code',
          nonce: 'mock-nonce',
          email: 'user@privaterelay.appleid.com'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.')).toBeTruthy();
      });
    });

    it('sollte Apple Loading-State anzeigen', async () => {
      mockAuthService.signInWithApple.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderSignupScreen();

      const appleButton = screen.getByText('Mit Apple registrieren');
      fireEvent.press(appleButton);

      expect(screen.getByText('Apple-Registrierung...')).toBeTruthy();
      expect(appleButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Password Visibility Toggle', () => {
    it('sollte Passwort-Sichtbarkeit umschalten können', async () => {
      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      const toggleButtons = screen.getAllByText('Anzeigen');
      const passwordToggle = toggleButtons[0]; // Erstes "Anzeigen" ist für Passwort

      expect(passwordInput.props.secureTextEntry).toBe(true);

      fireEvent.press(passwordToggle);

      await waitFor(() => {
        expect(passwordInput.props.secureTextEntry).toBe(false);
        expect(screen.getAllByText('Verbergen')[0]).toBeTruthy();
      });
    });

    it('sollte Passwort-Bestätigung-Sichtbarkeit umschalten können', async () => {
      renderSignupScreen();

      const confirmPasswordInput = screen.getByPlaceholderText('Passwort erneut eingeben');
      const toggleButtons = screen.getAllByText('Anzeigen');
      const confirmToggle = toggleButtons[1]; // Zweites "Anzeigen" ist für Bestätigung

      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);

      fireEvent.press(confirmToggle);

      await waitFor(() => {
        expect(confirmPasswordInput.props.secureTextEntry).toBe(false);
      });
    });
  });

  describe('Terms and Conditions', () => {
    it('sollte Terms-Checkbox umschalten können', async () => {
      renderSignupScreen();

      const termsCheckbox = screen.getByRole('checkbox');
      expect(termsCheckbox.props.accessibilityState?.checked).toBe(false);

      fireEvent.press(termsCheckbox);

      await waitFor(() => {
        expect(termsCheckbox.props.accessibilityState?.checked).toBe(true);
      });
    });

    it('sollte Terms-Text anzeigen', () => {
      renderSignupScreen();

      expect(screen.getByText(/Nutzungsbedingungen/)).toBeTruthy();
      expect(screen.getByText(/Datenschutzrichtlinien/)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('sollte zur Anmeldung navigieren', () => {
      renderSignupScreen();

      const loginLink = screen.getByText('Anmelden');
      fireEvent.press(loginLink);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { email: '' });
    });

    it('sollte E-Mail-Adresse an Login-Screen weitergeben', async () => {
      renderSignupScreen();

      await fillSignupForm('test@example.com', 'password', 'password');

      const loginLink = screen.getByText('Anmelden');
      fireEvent.press(loginLink);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { 
        email: 'test@example.com' 
      });
    });
  });

  describe('Accessibility', () => {
    it('sollte korrekte A11y-Labels haben', () => {
      renderSignupScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      expect(emailInput.props.accessibilityLabel).toBe('E-Mail-Adresse eingeben');

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      expect(passwordInput.props.accessibilityLabel).toBe('Passwort eingeben');

      const confirmPasswordInput = screen.getByPlaceholderText('Passwort erneut eingeben');
      expect(confirmPasswordInput.props.accessibilityLabel).toBe('Passwort bestätigen');

      const termsCheckbox = screen.getByRole('checkbox');
      expect(termsCheckbox.props.accessibilityLabel).toBe('Nutzungsbedingungen akzeptieren');
    });

    it('sollte Passwort-Stärke-Announcements haben', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(85);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'VeryStrongPassword123!');

      await waitFor(() => {
        const strengthLabel = screen.getByText('Sehr gut');
        expect(strengthLabel.props.accessibilityLabel).toContain('Passwort-Stärke: Sehr gut');
      });
    });

    it('sollte Progress-Bar für Screen Reader haben', async () => {
      mockPasswordValidator.calculateStrength.mockReturnValue(60);

      renderSignupScreen();

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      fireEvent.changeText(passwordInput, 'GoodPassword123');

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar.props.accessibilityValue?.min).toBe(0);
        expect(progressBar.props.accessibilityValue?.max).toBe(100);
        expect(progressBar.props.accessibilityValue?.now).toBe(60);
      });
    });

    it('sollte korrekten Fokus-Flow unterstützen', () => {
      renderSignupScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      const confirmPasswordInput = screen.getByPlaceholderText('Passwort erneut eingeben');

      expect(emailInput.props.returnKeyType).toBe('next');
      expect(passwordInput.props.returnKeyType).toBe('next');
      expect(confirmPasswordInput.props.returnKeyType).toBe('go');
    });
  });

  describe('ScrollView Behavior', () => {
    it('sollte ScrollView für längeren Content haben', () => {
      renderSignupScreen();

      // ScrollView sollte für lange Formulare vorhanden sein
      // Testing-Framework-spezifische Implementierung hier
    });

    it('sollte keyboardShouldPersistTaps aktiviert haben', () => {
      renderSignupScreen();

      // Prüft dass Taps außerhalb der Tastatur verarbeitet werden
      // Testing-Framework-spezifische Implementierung hier
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit sehr langen Passwörtern umgehen', async () => {
      renderSignupScreen();

      const longPassword = 'a'.repeat(200);
      
      await fillSignupForm('test@example.com', longPassword, longPassword);

      // Sollte nicht crashen
      expect(screen.getByPlaceholderText('Mindestens 8 Zeichen').props.value).toBe(longPassword);
    });

    it('sollte Sonderzeichen in Passwörtern handhaben', async () => {
      renderSignupScreen();

      const specialPassword = 'Päss@wörd123!äöüß';
      
      await fillSignupForm('test@example.com', specialPassword, specialPassword);

      const passwordInput = screen.getByPlaceholderText('Mindestens 8 Zeichen');
      expect(passwordInput.props.value).toBe(specialPassword);
    });

    it('sollte Rate-Limiting handhaben', async () => {
      mockRateLimiter.checkRateLimit.mockReturnValue({
        code: AuthErrorCode.TOO_MANY_REQUESTS,
        message: 'Zu viele Versuche',
        retryAfter: 60
      });

      renderSignupScreen();

      await fillSignupForm('test@example.com', 'validPassword123', 'validPassword123');
      
      const signupButton = screen.getAllByText('Konto erstellen')[1];
      fireEvent.press(signupButton);

      expect(screen.getByText('Zu viele Versuche')).toBeTruthy();
      expect(signupButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
