/**
 * Verify Email Screen - Container-Logik ohne Styles
 * E-Mail-Bestätigung mit Resend-Funktionalität und Timer
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { getAuthService } from '../../../services/auth';
import { AuthErrorCode } from '../../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

interface VerifyEmailScreenState {
  email: string;
  isResending: boolean;
  canResend: boolean;
  resendCountdown: number;
  resendCount: number;
  maxResendAttempts: number;
  isVerified: boolean;
  isCheckingVerification: boolean;
  errors: {
    general?: string;
  };
  lastResendTime?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RESEND_COOLDOWN_SECONDS = 60; // 1 Minute zwischen Resend-Versuchen
const MAX_RESEND_ATTEMPTS = 5; // Maximal 5 Resend-Versuche
const AUTO_CHECK_INTERVAL = 3000; // Alle 3 Sekunden auf Verifikation prüfen

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Email Verification Logic Hook
 */
function useEmailVerification(email: string) {
  const authService = getAuthService();
  
  const [state, setState] = useState<VerifyEmailScreenState>({
    email,
    isResending: false,
    canResend: true,
    resendCountdown: 0,
    resendCount: 0,
    maxResendAttempts: MAX_RESEND_ATTEMPTS,
    isVerified: false,
    isCheckingVerification: false,
    errors: {}
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

  // Auto-Check für E-Mail-Verifikation
  useEffect(() => {
    if (state.isVerified || state.isCheckingVerification) {
      return;
    }

    const checkVerification = async () => {
      try {
        setState(prev => ({ ...prev, isCheckingVerification: true }));
        
        const user = await authService.getCurrentUser();
        if (user?.emailVerified) {
          setState(prev => ({
            ...prev,
            isVerified: true,
            isCheckingVerification: false
          }));
        } else {
          setState(prev => ({ ...prev, isCheckingVerification: false }));
        }
      } catch (error) {
        setState(prev => ({ ...prev, isCheckingVerification: false }));
      }
    };

    const interval = setInterval(checkVerification, AUTO_CHECK_INTERVAL);
    
    // Initial check
    checkVerification();

    return () => clearInterval(interval);
  }, [authService, state.isVerified, state.isCheckingVerification]);

  // Resend E-Mail
  const resendVerificationEmail = useCallback(async () => {
    if (!state.canResend || state.resendCount >= state.maxResendAttempts) {
      return;
    }

    setState(prev => ({
      ...prev,
      isResending: true,
      errors: {}
    }));

    try {
      // In echter App würde hier eine Resend-API aufgerufen
      // Für MVP simulieren wir das
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setState(prev => ({
        ...prev,
        isResending: false,
        canResend: false,
        resendCountdown: RESEND_COOLDOWN_SECONDS,
        resendCount: prev.resendCount + 1,
        lastResendTime: Date.now()
      }));

    } catch (error: any) {
      const errorMessage = mapVerificationError(error);
      
      setState(prev => ({
        ...prev,
        isResending: false,
        errors: {
          general: errorMessage
        }
      }));
    }
  }, [state.canResend, state.resendCount, state.maxResendAttempts]);

  // Manuelle Verifikation prüfen
  const checkVerificationStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isCheckingVerification: true, errors: {} }));

    try {
      const user = await authService.getCurrentUser();
      if (user?.emailVerified) {
        setState(prev => ({
          ...prev,
          isVerified: true,
          isCheckingVerification: false
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          isCheckingVerification: false,
          errors: {
            general: 'E-Mail noch nicht bestätigt. Bitte prüfen Sie Ihren Posteingang.'
          }
        }));
      }
    } catch (error: any) {
      const errorMessage = mapVerificationError(error);
      
      setState(prev => ({
        ...prev,
        isCheckingVerification: false,
        errors: {
          general: errorMessage
        }
      }));
    }
  }, [authService]);

  return {
    state,
    setState,
    resendVerificationEmail,
    checkVerificationStatus
  };
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

function mapVerificationError(error: any): string {
  if (!error?.code) {
    return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }

  switch (error.code) {
    case AuthErrorCode.TOO_MANY_REQUESTS:
      return 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
    
    case AuthErrorCode.NETWORK_ERROR:
      return 'Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.';
    
    case AuthErrorCode.API_TIMEOUT:
      return 'Zeitüberschreitung. Bitte versuchen Sie es erneut.';
    
    case AuthErrorCode.USER_NOT_FOUND:
      return 'Benutzer nicht gefunden.';
    
    default:
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface VerifyEmailScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
    replace: (screen: string, params?: any) => void;
  };
  route: {
    params: {
      email: string;
      fromSignup?: boolean;
    };
  };
}

export function VerifyEmailScreen({ navigation, route }: VerifyEmailScreenProps) {
  const { email, fromSignup = false } = route.params;
  
  const {
    state,
    setState,
    resendVerificationEmail,
    checkVerificationStatus
  } = useEmailVerification(email);

  // Automatische Weiterleitung bei erfolgreicher Verifikation
  useEffect(() => {
    if (state.isVerified) {
      const timer = setTimeout(() => {
        navigation.replace('AppStack'); // Zur App weiterleiten
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.isVerified, navigation]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleResendEmail = useCallback(async () => {
    await resendVerificationEmail();
  }, [resendVerificationEmail]);

  const handleCheckVerification = useCallback(async () => {
    await checkVerificationStatus();
  }, [checkVerificationStatus]);

  const handleChangeEmail = useCallback(() => {
    if (fromSignup) {
      navigation.goBack(); // Zurück zur Registrierung
    } else {
      navigation.navigate('SignupScreen');
    }
  }, [navigation, fromSignup]);

  const handleBackToLogin = useCallback(() => {
    navigation.navigate('LoginScreen', { email });
  }, [navigation, email]);

  const handleOpenEmailApp = useCallback(() => {
    // In echter App würde hier die Standard-E-Mail-App geöffnet
    Alert.alert(
      'E-Mail-App öffnen',
      'Öffnen Sie Ihre E-Mail-App, um die Bestätigungs-E-Mail zu finden.',
      [{ text: 'OK' }]
    );
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View
      style={{ flex: 1, padding: 16, justifyContent: 'center' }}
      accessibilityLabel="E-Mail-Bestätigungs-Bildschirm"
    >
      {/* Success State */}
      {state.isVerified ? (
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
            accessibilityLabel="Erfolgreich bestätigt"
          >
            <Text style={{ color: 'white', fontSize: 40 }}>✓</Text>
          </View>
          
          <Text
            style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}
            accessibilityRole="header"
            accessibilityLevel={1}
          >
            E-Mail bestätigt!
          </Text>
          
          <Text
            style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 }}
          >
            Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie werden automatisch weitergeleitet.
          </Text>

          <View
            style={{
              width: 30,
              height: 30,
              borderWidth: 3,
              borderColor: '#007AFF',
              borderTopColor: 'transparent',
              borderRadius: 15
            }}
            accessibilityRole="progressbar"
            accessibilityLabel="Weiterleitung läuft"
          />
        </View>
      ) : (
        // Main Content
        <View>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#e3f2fd',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
              }}
              accessibilityRole="image"
              accessibilityLabel="E-Mail-Symbol"
            >
              <Text style={{ fontSize: 40 }}>📧</Text>
            </View>
            
            <Text
              style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}
              accessibilityRole="header"
              accessibilityLevel={1}
            >
              E-Mail bestätigen
            </Text>
            
            <Text
              style={{ fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 }}
            >
              Wir haben eine Bestätigungs-E-Mail an{'\n'}
              <Text style={{ fontWeight: '600', color: '#000' }}>{email}</Text>
              {'\n'}gesendet.
            </Text>
          </View>

          {/* Error Message */}
          {state.errors.general && (
            <View
              style={{ backgroundColor: '#f8d7da', padding: 12, borderRadius: 8, marginBottom: 24 }}
              accessibilityRole="alert"
              accessibilityLabel={`Fehler: ${state.errors.general}`}
            >
              <Text style={{ color: '#721c24', textAlign: 'center' }}>
                {state.errors.general}
              </Text>
            </View>
          )}

          {/* Instructions */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}
            >
              Nächste Schritte:
            </Text>
            <View style={{ paddingLeft: 16 }}>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                • Prüfen Sie Ihren Posteingang
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                • Schauen Sie auch im Spam-Ordner nach
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                • Klicken Sie auf den Bestätigungslink
              </Text>
            </View>
          </View>

          {/* Check Verification Button */}
          <TouchableOpacity
            onPress={handleCheckVerification}
            disabled={state.isCheckingVerification}
            style={{
              backgroundColor: state.isCheckingVerification ? '#ccc' : '#007AFF',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              alignItems: 'center'
            }}
            accessibilityRole="button"
            accessibilityLabel="Bestätigung prüfen"
            accessibilityHint="Prüfen Sie, ob Ihre E-Mail bereits bestätigt wurde"
            accessibilityState={{ disabled: state.isCheckingVerification }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              {state.isCheckingVerification ? 'Wird geprüft...' : 'Bestätigung prüfen'}
            </Text>
          </TouchableOpacity>

          {/* Open Email App Button */}
          <TouchableOpacity
            onPress={handleOpenEmailApp}
            style={{
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: '#007AFF',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              alignItems: 'center'
            }}
            accessibilityRole="button"
            accessibilityLabel="E-Mail-App öffnen"
            accessibilityHint="Öffnen Sie Ihre E-Mail-App"
          >
            <Text
              style={{
                color: '#007AFF',
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
                onPress={handleResendEmail}
                disabled={state.isResending || state.resendCount >= state.maxResendAttempts}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16
                }}
                accessibilityRole="button"
                accessibilityLabel="E-Mail erneut senden"
                accessibilityHint={`E-Mail erneut senden. ${state.maxResendAttempts - state.resendCount} Versuche übrig.`}
                accessibilityState={{
                  disabled: state.isResending || state.resendCount >= state.maxResendAttempts
                }}
              >
                <Text
                  style={{
                    color: (state.isResending || state.resendCount >= state.maxResendAttempts) ? '#ccc' : '#007AFF',
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                >
                  {state.isResending ? 'Wird gesendet...' : 'E-Mail erneut senden'}
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
              onPress={handleChangeEmail}
              style={{ marginBottom: 16 }}
              accessibilityRole="button"
              accessibilityLabel="E-Mail-Adresse ändern"
              accessibilityHint="Zurück zur Registrierung um E-Mail-Adresse zu ändern"
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>
                E-Mail-Adresse ändern
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBackToLogin}
              accessibilityRole="button"
              accessibilityLabel="Zur Anmeldung"
              accessibilityHint="Zurück zur Anmeldung"
            >
              <Text style={{ color: '#666', fontSize: 16 }}>
                Zur Anmeldung
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default VerifyEmailScreen;
