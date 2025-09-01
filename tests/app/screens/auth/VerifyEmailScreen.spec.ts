/**
 * VerifyEmailScreen Tests
 * Testet E-Mail-Verifikation, Resend-Timer und Auto-Check
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { VerifyEmailScreen } from '../../../../app/screens/auth/VerifyEmailScreen';

// ============================================================================
// MOCKS
// ============================================================================

const mockAuthService = {
  getCurrentUser: jest.fn()
};

jest.mock('../../../../services/auth', () => ({
  getAuthService: () => mockAuthService
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn()
};

// Mock Timers
jest.useFakeTimers();

// ============================================================================
// TEST HELPERS
// ============================================================================

const renderVerifyEmailScreen = (routeParams = { email: 'test@example.com' }) => {
  return render(
    <VerifyEmailScreen
      navigation={mockNavigation}
      route={{ params: routeParams }}
    />
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.getCurrentUser.mockResolvedValue({
      id: '123',
      email: 'test@example.com',
      emailVerified: false
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering and Initial State', () => {
    it('sollte korrekt rendern', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('E-Mail bestätigen')).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();
      expect(screen.getByText('Bestätigung prüfen')).toBeTruthy();
      expect(screen.getByText('E-Mail-App öffnen')).toBeTruthy();
    });

    it('sollte E-Mail-Adresse aus Route-Params anzeigen', () => {
      renderVerifyEmailScreen({ email: 'custom@example.com' });

      expect(screen.getByText('custom@example.com')).toBeTruthy();
    });

    it('sollte Instruktionen anzeigen', () => {
      renderVerifyEmailScreen();

      expect(screen.getByText('Nächste Schritte:')).toBeTruthy();
      expect(screen.getByText('• Prüfen Sie Ihren Posteingang')).toBeTruthy();
      expect(screen.getByText('• Schauen Sie auch im Spam-Ordner nach')).toBeTruthy();
      expect(screen.getByText('• Klicken Sie auf den Bestätigungslink')).toBeTruthy();
    });

    it('sollte E-Mail erneut senden Button initial aktiviert haben', () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      expect(resendButton).toBeTruthy();
    });
  });

  describe('Auto-Check Verification', () => {
    it('sollte automatisch auf Verifikation prüfen', async () => {
      renderVerifyEmailScreen();

      // Timer für Auto-Check vorspulen
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      });
    });

    it('sollte Success-State bei verifizierten User anzeigen', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: true
      });

      renderVerifyEmailScreen();

      // Auto-Check Timer
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.getByText('E-Mail bestätigt!')).toBeTruthy();
        expect(screen.getByText('Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie werden automatisch weitergeleitet.')).toBeTruthy();
      });
    });

    it('sollte automatisch zur App weiterleiten bei Verifikation', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: true
      });

      renderVerifyEmailScreen();

      // Auto-Check Timer
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Weiterleitung Timer
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockNavigation.replace).toHaveBeenCalledWith('AppStack');
      });
    });

    it('sollte Auto-Check stoppen wenn bereits verifiziert', async () => {
      mockAuthService.getCurrentUser
        .mockResolvedValueOnce({
          id: '123',
          email: 'test@example.com',
          emailVerified: false
        })
        .mockResolvedValueOnce({
          id: '123',
          email: 'test@example.com',
          emailVerified: true
        });

      renderVerifyEmailScreen();

      // Erster Check
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockAuthService.getCurrentUser).toHaveBeenCalledTimes(2);
      });

      // Zweiter Check - sollte nicht passieren da bereits verifiziert
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should remain at 2 calls
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('Manual Verification Check', () => {
    it('sollte manuelle Verifikation prüfen können', async () => {
      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      fireEvent.press(checkButton);

      expect(screen.getByText('Wird geprüft...')).toBeTruthy();
      expect(checkButton.parent?.props.accessibilityState?.disabled).toBe(true);

      await waitFor(() => {
        expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
      });
    });

    it('sollte Fehlermeldung bei nicht-verifizierten User anzeigen', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: false
      });

      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      fireEvent.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText('E-Mail noch nicht bestätigt. Bitte prüfen Sie Ihren Posteingang.')).toBeTruthy();
      });
    });

    it('sollte Erfolg bei manueller Prüfung anzeigen', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: true
      });

      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      fireEvent.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText('E-Mail bestätigt!')).toBeTruthy();
      });
    });
  });

  describe('Resend Email Functionality', () => {
    it('sollte E-Mail erneut senden können', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(resendButton);

      // Simuliert Resend-API Call
      await waitFor(() => {
        expect(screen.getByText('Erneut senden in 60s')).toBeTruthy();
      });
    });

    it('sollte Resend-Countdown anzeigen', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Erneut senden in 60s')).toBeTruthy();
      });

      // Timer vorspulen
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Erneut senden in 59s')).toBeTruthy();
      });
    });

    it('sollte Resend nach Countdown wieder aktivieren', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(resendButton);

      // Countdown komplett ablaufen lassen
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(screen.getByText('E-Mail erneut senden')).toBeTruthy();
      });
    });

    it('sollte Resend-Counter verwalten', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      
      // Erster Resend
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Versuche: 1/5')).toBeTruthy();
      });

      // Countdown ablaufen lassen
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Zweiter Resend
      const newResendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(newResendButton);

      await waitFor(() => {
        expect(screen.getByText('Versuche: 2/5')).toBeTruthy();
      });
    });

    it('sollte maximale Resend-Versuche begrenzen', async () => {
      renderVerifyEmailScreen();

      // 5 Resend-Versuche simulieren
      for (let i = 0; i < 5; i++) {
        const resendButton = screen.getByText('E-Mail erneut senden');
        fireEvent.press(resendButton);

        act(() => {
          jest.advanceTimersByTime(60000);
        });

        await waitFor(() => {
          if (i < 4) {
            expect(screen.getByText('E-Mail erneut senden')).toBeTruthy();
          }
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Max. Versuche erreicht')).toBeTruthy();
      });
    });
  });

  describe('Navigation Actions', () => {
    it('sollte E-Mail-Adresse ändern können', () => {
      renderVerifyEmailScreen({ email: 'test@example.com', fromSignup: true });

      const changeEmailButton = screen.getByText('E-Mail-Adresse ändern');
      fireEvent.press(changeEmailButton);

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('sollte zur Registrierung navigieren wenn nicht von Signup', () => {
      renderVerifyEmailScreen({ email: 'test@example.com', fromSignup: false });

      const changeEmailButton = screen.getByText('E-Mail-Adresse ändern');
      fireEvent.press(changeEmailButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('SignupScreen');
    });

    it('sollte zur Anmeldung navigieren', () => {
      renderVerifyEmailScreen();

      const loginButton = screen.getByText('Zur Anmeldung');
      fireEvent.press(loginButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('LoginScreen', { email: 'test@example.com' });
    });

    it('sollte E-Mail-App öffnen', () => {
      // Mock Alert.alert
      const mockAlert = jest.spyOn(require('react-native'), 'Alert').mockImplementation(() => {});

      renderVerifyEmailScreen();

      const openEmailButton = screen.getByText('E-Mail-App öffnen');
      fireEvent.press(openEmailButton);

      expect(mockAlert).toHaveBeenCalledWith(
        'E-Mail-App öffnen',
        'Öffnen Sie Ihre E-Mail-App, um die Bestätigungs-E-Mail zu finden.',
        [{ text: 'OK' }]
      );

      mockAlert.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('sollte korrekte A11y-Labels haben', () => {
      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      expect(checkButton.parent?.props.accessibilityRole).toBe('button');
      expect(checkButton.parent?.props.accessibilityLabel).toBe('Bestätigung prüfen');
      expect(checkButton.parent?.props.accessibilityHint).toBe('Prüfen Sie, ob Ihre E-Mail bereits bestätigt wurde');

      const emailAppButton = screen.getByText('E-Mail-App öffnen');
      expect(emailAppButton.parent?.props.accessibilityRole).toBe('button');
      expect(emailAppButton.parent?.props.accessibilityLabel).toBe('E-Mail-App öffnen');
    });

    it('sollte Success-State für Screen Reader ankündigen', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: true
      });

      renderVerifyEmailScreen();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        const successIcon = screen.getByLabelText('Erfolgreich bestätigt');
        expect(successIcon.props.accessibilityRole).toBe('image');
      });
    });

    it('sollte Error-Announcements haben', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        emailVerified: false
      });

      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      fireEvent.press(checkButton);

      await waitFor(() => {
        const errorMessage = screen.getByText('E-Mail noch nicht bestätigt. Bitte prüfen Sie Ihren Posteingang.');
        expect(errorMessage.parent?.props.accessibilityRole).toBe('alert');
      });
    });

    it('sollte Countdown für Screen Reader zugänglich machen', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(resendButton);

      await waitFor(() => {
        const countdownText = screen.getByText('Erneut senden in 60s');
        expect(countdownText.props.accessibilityLabel).toContain('60 Sekunden');
      });
    });
  });

  describe('Error Handling', () => {
    it('sollte API-Fehler beim Check behandeln', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new Error('Network error'));

      renderVerifyEmailScreen();

      const checkButton = screen.getByText('Bestätigung prüfen');
      fireEvent.press(checkButton);

      await waitFor(() => {
        expect(screen.getByText('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')).toBeTruthy();
      });
    });

    it('sollte Resend-Fehler behandeln', async () => {
      renderVerifyEmailScreen();

      // Mock Promise.reject für Resend
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((cb, delay) => {
        if (delay === 1000) {
          throw new Error('Resend failed');
        }
        return originalSetTimeout(cb, delay);
      });

      const resendButton = screen.getByText('E-Mail erneut senden');
      fireEvent.press(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')).toBeTruthy();
      });

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Component Lifecycle', () => {
    it('sollte Timer beim Unmount cleanen', () => {
      const { unmount } = renderVerifyEmailScreen();

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('sollte Auto-Check beim Mount starten', () => {
      renderVerifyEmailScreen();

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit fehlendem route param umgehen', () => {
      // Sollte nicht crashen auch wenn email fehlt
      expect(() => {
        renderVerifyEmailScreen({ email: undefined as any });
      }).not.toThrow();
    });

    it('sollte mit sehr langer E-Mail-Adresse umgehen', () => {
      const longEmail = 'very.long.email.address.that.might.overflow@very.long.domain.example.com';
      
      renderVerifyEmailScreen({ email: longEmail });

      expect(screen.getByText(longEmail)).toBeTruthy();
    });

    it('sollte gleichzeitige Resend-Versuche verhindern', async () => {
      renderVerifyEmailScreen();

      const resendButton = screen.getByText('E-Mail erneut senden');
      
      // Schnell hintereinander drücken
      fireEvent.press(resendButton);
      fireEvent.press(resendButton);
      fireEvent.press(resendButton);

      await waitFor(() => {
        // Nur ein Countdown sollte laufen
        expect(screen.getByText('Versuche: 1/5')).toBeTruthy();
      });
    });
  });
});
