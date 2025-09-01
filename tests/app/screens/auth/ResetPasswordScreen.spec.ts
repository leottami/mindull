/**
 * ResetPasswordScreen Tests
 * Testet Passwort-Reset Flow, Resend-Timer und Error-Handling
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { AuthErrorCode } from '../../../../services/auth/types';
import { ResetPasswordScreen } from '../../../../app/screens/auth/ResetPasswordScreen';

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthService = {
  resetPassword: jest.fn()
};

jest.mock('../../../../services/auth', () => ({
  getAuthService: () => mockAuthService
}));

const mockRateLimiter = {
  checkRateLimit: jest.fn()
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
  authRateLimiter: mockRateLimiter
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn()
};

// Mock Timers
jest.useFakeTimers();

// ============================================================================
// TEST HELPERS
// ============================================================================

const renderResetPasswordScreen = (routeParams = {}) => {
  return render(
    <ResetPasswordScreen
      navigation={mockNavigation}
      route={{ params: routeParams }}
    />
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.checkRateLimit.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering and Initial State', () => {
    it('sollte korrekt rendern', () => {
      renderResetPasswordScreen();

      expect(screen.getByText('Passwort vergessen?')).toBeTruthy();
      expect(screen.getByPlaceholderText('ihre@email.com')).toBeTruthy();
      expect(screen.getByText('Reset-Link senden')).toBeTruthy();
      expect(screen.getByText('Zur Anmeldung zurück')).toBeTruthy();
    });

    it('sollte E-Mail aus Route-Params vorab füllen', () => {
      renderResetPasswordScreen({ email: 'test@example.com' });

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('sollte Reset-Button initial deaktiviert haben', () => {
      renderResetPasswordScreen();

      const resetButton = screen.getByText('Reset-Link senden');
      expect(resetButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });

    it('sollte Instruktions-Text anzeigen', () => {
      renderResetPasswordScreen();

      expect(screen.getByText(/Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link/)).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('sollte E-Mail-Validierung inline durchführen', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(screen.getByText('Ungültige E-Mail-Adresse')).toBeTruthy();
      });
    });

    it('sollte Reset-Button aktivieren wenn E-Mail gültig ist', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        const resetButton = screen.getByText('Reset-Link senden');
        expect(resetButton.parent?.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('sollte Border-Farbe bei gültiger E-Mail ändern', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        expect(emailInput.props.style.borderColor).toBe('#198754'); // Grün für gültig
      });
    });

    it('sollte Border-Farbe bei ungültiger E-Mail ändern', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      
      fireEvent.changeText(emailInput, 'invalid');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        expect(emailInput.props.style.borderColor).toBe('#dc3545'); // Rot für Fehler
      });
    });
  });

  describe('Password Reset Flow', () => {
    it('sollte erfolgreichen Reset verarbeiten', async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
          email: 'test@example.com'
        });
      });

      await waitFor(() => {
        expect(screen.getByText('E-Mail gesendet!')).toBeTruthy();
        expect(screen.getByText('test@example.com')).toBeTruthy();
      });
    });

    it('sollte Loading-State während Reset anzeigen', async () => {
      mockAuthService.resetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      expect(screen.getByText('Wird gesendet...')).toBeTruthy();
      expect(resetButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });

    it('sollte Reset-Fehler anzeigen', async () => {
      mockAuthService.resetPassword.mockRejectedValue({
        code: AuthErrorCode.USER_NOT_FOUND,
        message: 'User not found'
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'notfound@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Kein Konto mit dieser E-Mail-Adresse gefunden.')).toBeTruthy();
      });
    });

    it('sollte Form-Validierung vor Submit prüfen', async () => {
      renderResetPasswordScreen();

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      // Service sollte nicht aufgerufen werden bei ungültiger Form
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('Success State', () => {
    beforeEach(async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('E-Mail gesendet!')).toBeTruthy();
      });
    });

    it('sollte Success-Screen mit korrekten Elementen anzeigen', () => {
      expect(screen.getByText('E-Mail gesendet!')).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();
      expect(screen.getByText('E-Mail-App öffnen')).toBeTruthy();
      expect(screen.getByText('Erneut senden')).toBeTruthy();
      expect(screen.getByText('Zur Anmeldung')).toBeTruthy();
    });

    it('sollte E-Mail-App öffnen können', () => {
      const mockAlert = jest.spyOn(require('react-native'), 'Alert').mockImplementation(() => {});

      const openEmailButton = screen.getByText('E-Mail-App öffnen');
      fireEvent.press(openEmailButton);

      expect(mockAlert).toHaveBeenCalledWith(
        'E-Mail-App öffnen',
        'Öffnen Sie Ihre E-Mail-App, um den Reset-Link zu finden.',
        [{ text: 'OK' }]
      );

      mockAlert.mockRestore();
    });

    it('sollte zur Anmeldung navigieren', () => {
      const loginButton = screen.getByText('Zur Anmeldung');
      fireEvent.press(loginButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { email: 'test@example.com' });
    });
  });

  describe('Resend Functionality', () => {
    beforeEach(async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('E-Mail gesendet!')).toBeTruthy();
      });
    });

    it('sollte Resend-Countdown anzeigen', () => {
      expect(screen.getByText('Erneut senden in 120s')).toBeTruthy();
    });

    it('sollte Countdown runterzählen', async () => {
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Erneut senden in 119s')).toBeTruthy();
      });
    });

    it('sollte Resend nach Countdown wieder aktivieren', async () => {
      act(() => {
        jest.advanceTimersByTime(120000);
      });

      await waitFor(() => {
        expect(screen.getByText('Erneut senden')).toBeTruthy();
      });

      const resendButton = screen.getByText('Erneut senden');
      expect(resendButton.parent?.props.accessibilityState?.disabled).toBe(false);
    });

    it('sollte Resend-Counter verwalten', async () => {
      // Countdown ablaufen lassen
      act(() => {
        jest.advanceTimersByTime(120000);
      });

      await waitFor(() => {
        expect(screen.getByText('Versuche: 1/3')).toBeTruthy();
      });

      // Zweiter Resend
      const resendButton = screen.getByText('Erneut senden');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Versuche: 2/3')).toBeTruthy();
      });
    });

    it('sollte maximale Resend-Versuche begrenzen', async () => {
      // 3 Resend-Versuche simulieren
      for (let i = 1; i <= 3; i++) {
        if (i > 1) {
          act(() => {
            jest.advanceTimersByTime(120000);
          });

          const resendButton = screen.getByText('Erneut senden');
          fireEvent.press(resendButton);
        }

        await waitFor(() => {
          expect(screen.getByText(`Versuche: ${i}/3`)).toBeTruthy();
        });
      }

      act(() => {
        jest.advanceTimersByTime(120000);
      });

      await waitFor(() => {
        expect(screen.getByText('Max. Versuche erreicht')).toBeTruthy();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('sollte Rate-Limit-Fehler anzeigen', async () => {
      mockRateLimiter.checkRateLimit.mockReturnValue({
        code: AuthErrorCode.TOO_MANY_REQUESTS,
        message: 'Zu viele Anfragen',
        retryAfter: 60
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      expect(screen.getByText('Zu viele Anfragen')).toBeTruthy();
      expect(resetButton.parent?.props.accessibilityState?.disabled).toBe(true);
    });

    it('sollte Lockout-Timer anzeigen', async () => {
      mockRateLimiter.checkRateLimit.mockReturnValue({
        code: AuthErrorCode.TOO_MANY_REQUESTS,
        message: 'Zu viele Anfragen',
        retryAfter: 30
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      expect(screen.getByText('Zu viele Anfragen. Versuchen Sie es in 30 Sekunden erneut.')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('sollte zur Anmeldung navigieren', () => {
      renderResetPasswordScreen();

      const loginButton = screen.getByText('Zur Anmeldung zurück');
      fireEvent.press(loginButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { email: '' });
    });

    it('sollte zur Registrierung navigieren', () => {
      renderResetPasswordScreen();

      const signupButton = screen.getByText('Registrieren');
      fireEvent.press(signupButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('SignupScreen', { email: '' });
    });

    it('sollte E-Mail-Adresse an Navigation weitergeben', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const loginButton = screen.getByText('Zur Anmeldung zurück');
      fireEvent.press(loginButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { 
        email: 'test@example.com' 
      });
    });
  });

  describe('Accessibility', () => {
    it('sollte korrekte A11y-Labels haben', () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      expect(emailInput.props.accessibilityLabel).toBe('E-Mail-Adresse eingeben');
      expect(emailInput.props.accessibilityHint).toBe('Geben Sie die E-Mail-Adresse Ihres Kontos ein');

      const resetButton = screen.getByText('Reset-Link senden');
      expect(resetButton.parent?.props.accessibilityRole).toBe('button');
      expect(resetButton.parent?.props.accessibilityLabel).toBe('Reset-Link senden');
    });

    it('sollte Success-State für Screen Reader ankündigen', async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        const successIcon = screen.getByLabelText('E-Mail gesendet');
        expect(successIcon.props.accessibilityRole).toBe('image');
      });
    });

    it('sollte Error-Announcements haben', async () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'invalid');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        const errorMessage = screen.getByText('Ungültige E-Mail-Adresse');
        expect(errorMessage.parent?.props.accessibilityRole).toBe('alert');
      });
    });

    it('sollte Countdown für Screen Reader zugänglich machen', async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        const countdownText = screen.getByText('Erneut senden in 120s');
        expect(countdownText.props.accessibilityLabel).toContain('120 Sekunden');
      });
    });

    it('sollte korrekten Fokus-Flow unterstützen', () => {
      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      expect(emailInput.props.returnKeyType).toBe('send');
    });
  });

  describe('Error Handling', () => {
    it('sollte Netzwerkfehler behandeln', async () => {
      mockAuthService.resetPassword.mockRejectedValue({
        code: AuthErrorCode.NETWORK_ERROR,
        message: 'Network error'
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.')).toBeTruthy();
      });
    });

    it('sollte Timeout-Fehler behandeln', async () => {
      mockAuthService.resetPassword.mockRejectedValue({
        code: AuthErrorCode.API_TIMEOUT,
        message: 'Timeout'
      });

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Zeitüberschreitung. Bitte versuchen Sie es erneut.')).toBeTruthy();
      });
    });

    it('sollte unbekannte Fehler behandeln', async () => {
      mockAuthService.resetPassword.mockRejectedValue(new Error('Unknown error'));

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit fehlendem route param umgehen', () => {
      expect(() => {
        renderResetPasswordScreen({ email: undefined });
      }).not.toThrow();
    });

    it('sollte Whitespace in E-Mail trimmen', async () => {
      mockAuthService.resetPassword.mockResolvedValue({});

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, '  test@example.com  ');

      const resetButton = screen.getByText('Reset-Link senden');
      fireEvent.press(resetButton);

      await waitFor(() => {
        expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
          email: 'test@example.com'
        });
      });
    });

    it('sollte mehrfache Submit-Versuche verhindern', async () => {
      mockAuthService.resetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderResetPasswordScreen();

      const emailInput = screen.getByPlaceholderText('ihre@email.com');
      fireEvent.changeText(emailInput, 'test@example.com');

      const resetButton = screen.getByText('Reset-Link senden');
      
      fireEvent.press(resetButton);
      fireEvent.press(resetButton); // Zweiter Versuch

      // Service sollte nur einmal aufgerufen werden
      expect(mockAuthService.resetPassword).toHaveBeenCalledTimes(1);
    });

    it('sollte Timer beim Unmount cleanen', () => {
      const { unmount } = renderResetPasswordScreen();

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
