/**
 * Reset Password Screen - Container-Logik ohne Styles  
 * Passwort-Reset mit E-Mail-Eingabe und Bestätigung
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { getAuthService } from '../../../services/auth';
import { EmailValidator, authRateLimiter } from '../../../services/auth/policies';
import { AuthErrorCode, PasswordResetRequest } from '../../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

interface ResetPasswordScreenState {
  email: string;
  isLoading: boolean;
  isSuccess: boolean;
  canResend: boolean;
  resendCountdown: number;
  resendCount: number;
  maxResendAttempts: number;
  errors: {
    email?: string;
    general?: string;
  };
  isDisabled: boolean;
  remainingLockoutTime?: number;
  lastResetTime?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RESEND_COOLDOWN_SECONDS = 120; // 2 Minuten zwischen Reset-Versuchen
const MAX_RESET_ATTEMPTS = 3; // Maximal 3 Reset-Versuche pro Session

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Password Reset Logic Hook
 */
function usePasswordReset() {
  const authService = getAuthService();
  
  const [state, setState] = useState<ResetPasswordScreenState>({
    email: '',
    isLoading: false,
    isSuccess: false,
    canResend: true,
    resendCountdown: 0,
    resendCount: 0,
    maxResendAttempts: MAX_RESET_ATTEMPTS,
    errors: {},
    isDisabled: false
  });

  // Resend-Timer Hook
  useEffect(() => {
    if (state.resendCountdown > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          resendCountdown: prev.resendCountdown - 1
        }));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (state.resendCountdown === 0 && !state.canResend) {
      setState(prev => ({
        ...prev,
        canResend: prev.resendCount < prev.maxResendAttempts
      }));
    }
  }, [state.resendCountdown, state.canResend, state.resendCount, state.maxResendAttempts]);

  // Rate-Limiting prüfen
  const checkRateLimit = useCallback((email: string): boolean => {
    const rateLimitError = authRateLimiter.checkRateLimit(`reset_${email}`);
    if (rateLimitError) {
      setState(prev => ({
        ...prev,
        isDisabled: true,
        remainingLockoutTime: rateLimitError.retryAfter,
        errors: {
          general: rateLimitError.message
        }
      }));
      return false;
    }
    return true;
  }, []);

  // Passwort-Reset anfordern
  const requestPasswordReset = useCallback(async (email: string) => {
    if (!checkRateLimit(email)) {
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      errors: {},
      isDisabled: true
    }));

    try {
      const request: PasswordResetRequest = { email: email.trim() };
      await authService.resetPassword(request);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
        canResend: false,
        resendCountdown: RESEND_COOLDOWN_SECONDS,
        resendCount: prev.resendCount + 1,
        lastResetTime: Date.now(),
        isDisabled: false
      }));

    } catch (error: any) {
      const errorMessage = mapResetError(error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        errors: {
          general: errorMessage
        }
      }));
    }
  }, [authService, checkRateLimit]);

  // Validation
  const validateEmail = useCallback((email: string): string | undefined => {
    const emailError = EmailValidator.validate(email);
    return emailError?.message;
  }, []);

  return {
    state,
    setState,
    requestPasswordReset,
    validateEmail
  };
}

/**
 * Lockout Timer Hook
 */
function useLockoutTimer(remainingTime?: number) {
  const [timeLeft, setTimeLeft] = useState<number | undefined>(remainingTime);

  useEffect(() => {
    if (!remainingTime) {
      setTimeLeft(undefined);
      return;
    }

    setTimeLeft(remainingTime);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          return undefined;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingTime]);

  return timeLeft;
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

function mapResetError(error: any): string {
  if (!error?.code) {
    return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }

  switch (error.code) {
    case AuthErrorCode.USER_NOT_FOUND:
      return 'Kein Konto mit dieser E-Mail-Adresse gefunden.';
    
    case AuthErrorCode.TOO_MANY_REQUESTS:
      return 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
    
    case AuthErrorCode.INVALID_EMAIL:
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    
    case AuthErrorCode.NETWORK_ERROR:
      return 'Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.';
    
    case AuthErrorCode.API_TIMEOUT:
      return 'Zeitüberschreitung. Bitte versuchen Sie es erneut.';
    
    default:
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ResetPasswordScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      email?: string;
    };
  };
}

export function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const {
    state,
    setState,
    requestPasswordReset,
    validateEmail
  } = usePasswordReset();

  const lockoutTime = useLockoutTimer(state.remainingLockoutTime);

  // Refs für A11y Navigation
  const emailRef = useRef<TextInput>(null);

  // Initialize with route params
  useEffect(() => {
    if (route?.params?.email) {
      setState(prev => ({
        ...prev,
        email: route.params!.email!
      }));
    }
  }, [route?.params?.email, setState]);

  // Auto-focus auf Email-Field
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!state.isSuccess) {
        emailRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [state.isSuccess]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleEmailChange = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      email: text,
      errors: {
        ...prev.errors,
        email: undefined,
        general: undefined
      }
    }));
  }, [setState]);

  const handleEmailBlur = useCallback(() => {
    const error = validateEmail(state.email);
    if (error) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, email: error }
      }));
    }
  }, [state.email, validateEmail, setState]);

  const handleResetPassword = useCallback(async () => {
    // Final validation
    const emailError = validateEmail(state.email);

    if (emailError) {
      setState(prev => ({
        ...prev,
        errors: {
          email: emailError
        }
      }));
      emailRef.current?.focus();
      return;
    }

    await requestPasswordReset(state.email);
  }, [state.email, validateEmail, requestPasswordReset, setState]);

  const handleResendReset = useCallback(async () => {
    if (state.canResend && state.resendCountdown === 0) {
      await requestPasswordReset(state.email);
    }
  }, [state.canResend, state.resendCountdown, state.email, requestPasswordReset]);

  const handleBackToLogin = useCallback(() => {
    navigation.navigate('LoginScreen', { email: state.email });
  }, [navigation, state.email]);

  const handleBackToSignup = useCallback(() => {
    navigation.navigate('SignupScreen', { email: state.email });
  }, [navigation, state.email]);

  const handleOpenEmailApp = useCallback(() => {
    Alert.alert(
      'E-Mail-App öffnen',
      'Öffnen Sie Ihre E-Mail-App, um den Reset-Link zu finden.',
      [{ text: 'OK' }]
    );
  }, []);

  // ============================================================================
  // VALIDATION STATE
  // ============================================================================

  const emailValid = EmailValidator.validate(state.email) === null;
  const canSubmit = emailValid && !state.isLoading && !state.isDisabled;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View
      style={{ flex: 1, padding: 16, justifyContent: 'center' }}
      accessibilityLabel="Passwort-Reset-Bildschirm"
    >
      {state.isSuccess ? (
        // Success State
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#198754',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24
            }}
            accessibilityRole="image"
            accessibilityLabel="E-Mail gesendet"
          >
            <Text style={{ color: 'white', fontSize: 40 }}>📧</Text>
          </View>
          
          <Text
            style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}
            accessibilityRole="header"
            accessibilityLevel={1}
          >
            E-Mail gesendet!
          </Text>
          
          <Text
            style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 8 }}
          >
            Wir haben einen Reset-Link an
          </Text>
          
          <Text
            style={{ fontSize: 16, fontWeight: '600', color: '#000', textAlign: 'center', marginBottom: 24 }}
          >
            {state.email}
          </Text>
          
          <Text
            style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 20 }}
          >
            Prüfen Sie Ihren Posteingang und folgen Sie den Anweisungen in der E-Mail, um Ihr Passwort zurückzusetzen.
          </Text>

          {/* Open Email App Button */}
          <TouchableOpacity
            onPress={handleOpenEmailApp}
            style={{
              backgroundColor: '#007AFF',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              alignItems: 'center',
              width: '100%'
            }}
            accessibilityRole="button"
            accessibilityLabel="E-Mail-App öffnen"
            accessibilityHint="Öffnen Sie Ihre E-Mail-App"
          >
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              E-Mail-App öffnen
            </Text>
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'center' }}>
              Keine E-Mail erhalten?
            </Text>
            
            {state.canResend && state.resendCountdown === 0 ? (
              <TouchableOpacity
                onPress={handleResendReset}
                disabled={state.resendCount >= state.maxResendAttempts}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16
                }}
                accessibilityRole="button"
                accessibilityLabel="Reset-E-Mail erneut senden"
                accessibilityHint={`Reset-E-Mail erneut senden. ${state.maxResendAttempts - state.resendCount} Versuche übrig.`}
                accessibilityState={{
                  disabled: state.resendCount >= state.maxResendAttempts
                }}
              >
                <Text
                  style={{
                    color: state.resendCount >= state.maxResendAttempts ? '#ccc' : '#007AFF',
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                >
                  Erneut senden
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: 'center' }}>
                {state.resendCountdown > 0 ? (
                  <Text
                    style={{ fontSize: 14, color: '#666' }}
                    accessibilityLabel={`Erneut senden in ${state.resendCountdown} Sekunden möglich`}
                  >
                    Erneut senden in {state.resendCountdown}s
                  </Text>
                ) : (
                  <Text
                    style={{ fontSize: 14, color: '#666' }}
                    accessibilityLabel="Maximale Anzahl von Versuchen erreicht"
                  >
                    Max. Versuche erreicht
                  </Text>
                )}
                
                <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  Versuche: {state.resendCount}/{state.maxResendAttempts}
                </Text>
              </View>
            )}
          </View>

          {/* Footer Actions */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleBackToLogin}
              style={{ marginBottom: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Zur Anmeldung"
              accessibilityHint="Zurück zur Anmeldung"
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>
                Zur Anmeldung
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Main Form
        <View>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#fff3cd',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
              }}
              accessibilityRole="image"
              accessibilityLabel="Passwort-Reset-Symbol"
            >
              <Text style={{ fontSize: 40 }}>🔑</Text>
            </View>
            
            <Text
              style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}
              accessibilityRole="header"
              accessibilityLevel={1}
            >
              Passwort vergessen?
            </Text>
            
            <Text
              style={{ fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 }}
            >
              Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
            </Text>
          </View>

          {/* General Error */}
          {state.errors.general && (
            <View
              style={{ backgroundColor: '#f8d7da', padding: 12, borderRadius: 8, marginBottom: 16 }}
              accessibilityRole="alert"
              accessibilityLabel={`Fehler: ${state.errors.general}`}
            >
              <Text style={{ color: '#721c24', textAlign: 'center' }}>
                {state.errors.general}
              </Text>
            </View>
          )}

          {/* Lockout Timer */}
          {lockoutTime && (
            <View
              style={{ backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 16 }}
              accessibilityRole="alert"
              accessibilityLabel={`Anfragen begrenzt. Versuchen Sie es in ${lockoutTime} Sekunden erneut.`}
            >
              <Text style={{ color: '#856404', textAlign: 'center' }}>
                Zu viele Anfragen. Versuchen Sie es in {lockoutTime} Sekunden erneut.
              </Text>
            </View>
          )}

          {/* Email Input */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}
              accessibilityLabel="E-Mail-Adresse"
            >
              E-Mail-Adresse
            </Text>
            <TextInput
              ref={emailRef}
              value={state.email}
              onChangeText={handleEmailChange}
              onBlur={handleEmailBlur}
              placeholder="ihre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!state.isLoading && !state.isDisabled}
              style={{
                borderWidth: 1,
                borderColor: state.errors.email ? '#dc3545' : (emailValid && state.email ? '#198754' : '#ccc'),
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
              }}
              accessibilityLabel="E-Mail-Adresse eingeben"
              accessibilityHint="Geben Sie die E-Mail-Adresse Ihres Kontos ein"
              accessibilityState={{ invalid: !!state.errors.email }}
              onSubmitEditing={handleResetPassword}
              returnKeyType="send"
            />
            {state.errors.email && (
              <Text
                style={{ color: '#dc3545', fontSize: 14, marginTop: 4 }}
                accessibilityRole="alert"
              >
                {state.errors.email}
              </Text>
            )}
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            onPress={handleResetPassword}
            disabled={!canSubmit}
            style={{
              backgroundColor: !canSubmit ? '#ccc' : '#007AFF',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              alignItems: 'center'
            }}
            accessibilityRole="button"
            accessibilityLabel="Reset-Link senden"
            accessibilityHint="Senden Sie einen Passwort-Reset-Link an Ihre E-Mail-Adresse"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              {state.isLoading ? 'Wird gesendet...' : 'Reset-Link senden'}
            </Text>
          </TouchableOpacity>

          {/* Footer Actions */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleBackToLogin}
              style={{ marginBottom: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Zur Anmeldung zurück"
              accessibilityHint="Gehen Sie zurück zur Anmeldung"
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>
                Zur Anmeldung zurück
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#666' }}>
                Noch kein Konto? 
              </Text>
              <TouchableOpacity
                onPress={handleBackToSignup}
                style={{ marginLeft: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Konto erstellen"
                accessibilityHint="Registrieren Sie sich für ein neues Konto"
              >
                <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>
                  Registrieren
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default ResetPasswordScreen;
