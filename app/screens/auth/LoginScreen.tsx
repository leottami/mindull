/**
 * Login Screen - Container-Logik ohne Styles
 * E-Mail/Passwort + Apple SSO mit UI-Zuständen und A11y
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, AccessibilityInfo } from 'react-native';
import { getAuthService } from '../../../services/auth';
import { EmailValidator, passwordValidator, authRateLimiter } from '../../../services/auth/policies';
import { AuthErrorCode, LoginRequest, AppleSignInRequest } from '../../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

interface LoginScreenState {
  email: string;
  password: string;
  isLoading: boolean;
  isAppleLoading: boolean;
  errors: {
    email?: string;
    password?: string;
    general?: string;
  };
  isDisabled: boolean;
  remainingLockoutTime?: number;
  showPassword: boolean;
  isSuccess: boolean;
}

interface ValidationState {
  email: boolean;
  password: boolean;
  canSubmit: boolean;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Login-Logik Hook
 */
function useLoginLogic() {
  const authService = getAuthService();
  
  const [state, setState] = useState<LoginScreenState>({
    email: '',
    password: '',
    isLoading: false,
    isAppleLoading: false,
    errors: {},
    isDisabled: false,
    showPassword: false,
    isSuccess: false
  });

  // Rate-Limiting prüfen
  const checkRateLimit = useCallback((email: string): boolean => {
    const rateLimitError = authRateLimiter.checkRateLimit(email);
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

  // Inline-Validierung
  const validateField = useCallback((field: 'email' | 'password', value: string): string | undefined => {
    switch (field) {
      case 'email':
        const emailError = EmailValidator.validate(value);
        return emailError?.message;
      
      case 'password':
        if (!value.trim()) {
          return 'Passwort ist erforderlich';
        }
        // Bei Login keine strenge Passwort-Validierung
        return undefined;
      
      default:
        return undefined;
    }
  }, []);

  // Login ausführen
  const performLogin = useCallback(async (email: string, password: string) => {
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
      const request: LoginRequest = { email: email.trim(), password };
      await authService.signIn(request);
      
      setState(prev => ({
        ...prev,
        isSuccess: true,
        isLoading: false
      }));

      // Navigation erfolgt automatisch über AuthBridge
    } catch (error: any) {
      const errorMessage = mapAuthError(error);
      
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

  // Apple Sign-In
  const performAppleSignIn = useCallback(async (appleResponse: any) => {
    setState(prev => ({
      ...prev,
      isAppleLoading: true,
      errors: {}
    }));

    try {
      const request: AppleSignInRequest = {
        identityToken: appleResponse.identityToken,
        authorizationCode: appleResponse.authorizationCode,
        nonce: appleResponse.nonce,
        email: appleResponse.email,
        fullName: appleResponse.fullName
      };

      await authService.signInWithApple(request);
      
      setState(prev => ({
        ...prev,
        isSuccess: true,
        isAppleLoading: false
      }));

    } catch (error: any) {
      const errorMessage = mapAuthError(error);
      
      setState(prev => ({
        ...prev,
        isAppleLoading: false,
        errors: {
          general: errorMessage
        }
      }));
    }
  }, [authService]);

  return {
    state,
    setState,
    validateField,
    performLogin,
    performAppleSignIn
  };
}

/**
 * Validation State Hook
 */
function useValidation(email: string, password: string) {
  const [validation, setValidation] = useState<ValidationState>({
    email: false,
    password: false,
    canSubmit: false
  });

  useEffect(() => {
    const emailValid = EmailValidator.validate(email) === null;
    const passwordValid = password.trim().length > 0;
    const canSubmit = emailValid && passwordValid;

    setValidation({
      email: emailValid,
      password: passwordValid,
      canSubmit
    });
  }, [email, password]);

  return validation;
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

function mapAuthError(error: any): string {
  if (!error?.code) {
    return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }

  switch (error.code) {
    case AuthErrorCode.INVALID_CREDENTIALS:
      return 'E-Mail oder Passwort sind falsch.';
    
    case AuthErrorCode.EMAIL_NOT_VERIFIED:
      return 'Bitte bestätigen Sie Ihre E-Mail-Adresse.';
    
    case AuthErrorCode.USER_NOT_FOUND:
      return 'Kein Konto mit dieser E-Mail-Adresse gefunden.';
    
    case AuthErrorCode.TOO_MANY_REQUESTS:
      return 'Zu viele Versuche. Bitte warten Sie einen Moment.';
    
    case AuthErrorCode.ACCOUNT_LOCKED:
      return 'Konto ist temporär gesperrt.';
    
    case AuthErrorCode.NETWORK_ERROR:
      return 'Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.';
    
    case AuthErrorCode.API_TIMEOUT:
      return 'Zeitüberschreitung. Bitte versuchen Sie es erneut.';
    
    case AuthErrorCode.APPLE_CANCELLED:
      return 'Apple-Anmeldung wurde abgebrochen.';
    
    case AuthErrorCode.APPLE_FAILED:
      return 'Apple-Anmeldung fehlgeschlagen.';
    
    default:
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface LoginScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      email?: string;
      returnTo?: string;
    };
  };
}

export function LoginScreen({ navigation, route }: LoginScreenProps) {
  const {
    state,
    setState,
    validateField,
    performLogin,
    performAppleSignIn
  } = useLoginLogic();

  const validation = useValidation(state.email, state.password);
  const lockoutTime = useLockoutTimer(state.remainingLockoutTime);

  // Refs für A11y Navigation
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const loginButtonRef = useRef<TouchableOpacity>(null);

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
      emailRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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

  const handlePasswordChange = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      password: text,
      errors: {
        ...prev.errors,
        password: undefined,
        general: undefined
      }
    }));
  }, [setState]);

  const handleEmailBlur = useCallback(() => {
    const error = validateField('email', state.email);
    if (error) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, email: error }
      }));
    }
  }, [state.email, validateField, setState]);

  const handlePasswordBlur = useCallback(() => {
    const error = validateField('password', state.password);
    if (error) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, password: error }
      }));
    }
  }, [state.password, validateField, setState]);

  const handleLogin = useCallback(async () => {
    // Final validation
    const emailError = validateField('email', state.email);
    const passwordError = validateField('password', state.password);

    if (emailError || passwordError) {
      setState(prev => ({
        ...prev,
        errors: {
          email: emailError,
          password: passwordError
        }
      }));
      
      // Focus auf erstes fehlerhaftes Feld
      if (emailError) {
        emailRef.current?.focus();
      } else if (passwordError) {
        passwordRef.current?.focus();
      }
      return;
    }

    await performLogin(state.email, state.password);
  }, [state.email, state.password, validateField, performLogin, setState]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      // Mock Apple Sign-In Response
      // In echter App würde hier @react-native-apple-authentication verwendet
      const appleResponse = {
        identityToken: 'mock-identity-token',
        authorizationCode: 'mock-auth-code',
        nonce: 'mock-nonce',
        email: 'user@privaterelay.appleid.com'
      };
      
      await performAppleSignIn(appleResponse);
    } catch (error) {
      // Apple-spezifische Fehlerbehandlung
      setState(prev => ({
        ...prev,
        errors: {
          general: 'Apple-Anmeldung fehlgeschlagen'
        }
      }));
    }
  }, [performAppleSignIn, setState]);

  const handleTogglePasswordVisibility = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPassword: !prev.showPassword
    }));
  }, [setState]);

  const handleNavigateToSignup = useCallback(() => {
    navigation.navigate('SignupScreen');
  }, [navigation]);

  const handleNavigateToReset = useCallback(() => {
    navigation.navigate('ResetPasswordScreen', { email: state.email });
  }, [navigation, state.email]);

  // ============================================================================
  // A11Y HELPERS
  // ============================================================================

  const getEmailAccessibilityState = () => ({
    invalid: !!state.errors.email
  });

  const getPasswordAccessibilityState = () => ({
    invalid: !!state.errors.password
  });

  const getLoginButtonAccessibilityState = () => ({
    disabled: !validation.canSubmit || state.isLoading || state.isDisabled
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View
      style={{ flex: 1, padding: 16 }}
      accessibilityLabel="Anmelde-Bildschirm"
    >
      {/* Header */}
      <View style={{ marginBottom: 32 }}>
        <Text
          style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}
          accessibilityRole="header"
          accessibilityLevel={1}
        >
          Willkommen zurück
        </Text>
        <Text
          style={{ fontSize: 16, color: '#666' }}
          accessibilityHint="Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an"
        >
          Melden Sie sich in Ihrem Konto an
        </Text>
      </View>

      {/* Success State */}
      {state.isSuccess && (
        <View
          style={{ backgroundColor: '#d4edda', padding: 12, borderRadius: 8, marginBottom: 16 }}
          accessibilityRole="alert"
          accessibilityLabel="Anmeldung erfolgreich"
        >
          <Text style={{ color: '#155724' }}>
            Anmeldung erfolgreich! Sie werden weitergeleitet...
          </Text>
        </View>
      )}

      {/* General Error */}
      {state.errors.general && (
        <View
          style={{ backgroundColor: '#f8d7da', padding: 12, borderRadius: 8, marginBottom: 16 }}
          accessibilityRole="alert"
          accessibilityLabel={`Fehler: ${state.errors.general}`}
        >
          <Text style={{ color: '#721c24' }}>
            {state.errors.general}
          </Text>
        </View>
      )}

      {/* Lockout Timer */}
      {lockoutTime && (
        <View
          style={{ backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 16 }}
          accessibilityRole="alert"
          accessibilityLabel={`Konto gesperrt. Versuchen Sie es in ${lockoutTime} Sekunden erneut.`}
        >
          <Text style={{ color: '#856404' }}>
            Konto gesperrt. Versuchen Sie es in {lockoutTime} Sekunden erneut.
          </Text>
        </View>
      )}

      {/* Email Input */}
      <View style={{ marginBottom: 16 }}>
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
            borderColor: state.errors.email ? '#dc3545' : '#ccc',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
          }}
          accessibilityLabel="E-Mail-Adresse eingeben"
          accessibilityHint="Geben Sie Ihre E-Mail-Adresse ein"
          accessibilityState={getEmailAccessibilityState()}
          onSubmitEditing={() => passwordRef.current?.focus()}
          returnKeyType="next"
        />
        {state.errors.email && (
          <Text
            style={{ color: '#dc3545', fontSize: 14, marginTop: 4 }}
            accessibilityRole="alert"
            accessibilityLabel={`E-Mail-Fehler: ${state.errors.email}`}
          >
            {state.errors.email}
          </Text>
        )}
      </View>

      {/* Password Input */}
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}
          accessibilityLabel="Passwort"
        >
          Passwort
        </Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            ref={passwordRef}
            value={state.password}
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            placeholder="Ihr Passwort"
            secureTextEntry={!state.showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            editable={!state.isLoading && !state.isDisabled}
            style={{
              borderWidth: 1,
              borderColor: state.errors.password ? '#dc3545' : '#ccc',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              paddingRight: 50,
              backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
            }}
            accessibilityLabel="Passwort eingeben"
            accessibilityHint="Geben Sie Ihr Passwort ein"
            accessibilityState={getPasswordAccessibilityState()}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
          <TouchableOpacity
            onPress={handleTogglePasswordVisibility}
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              padding: 4
            }}
            accessibilityRole="button"
            accessibilityLabel={state.showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            disabled={state.isLoading || state.isDisabled}
          >
            <Text style={{ color: '#007AFF', fontSize: 14 }}>
              {state.showPassword ? 'Verbergen' : 'Anzeigen'}
            </Text>
          </TouchableOpacity>
        </View>
        {state.errors.password && (
          <Text
            style={{ color: '#dc3545', fontSize: 14, marginTop: 4 }}
            accessibilityRole="alert"
            accessibilityLabel={`Passwort-Fehler: ${state.errors.password}`}
          >
            {state.errors.password}
          </Text>
        )}
      </View>

      {/* Login Button */}
      <TouchableOpacity
        ref={loginButtonRef}
        onPress={handleLogin}
        disabled={!validation.canSubmit || state.isLoading || state.isDisabled}
        style={{
          backgroundColor: (!validation.canSubmit || state.isLoading || state.isDisabled) ? '#ccc' : '#007AFF',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          alignItems: 'center'
        }}
        accessibilityRole="button"
        accessibilityLabel="Anmelden"
        accessibilityHint="Tippen Sie hier, um sich anzumelden"
        accessibilityState={getLoginButtonAccessibilityState()}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600'
          }}
        >
          {state.isLoading ? 'Wird angemeldet...' : 'Anmelden'}
        </Text>
      </TouchableOpacity>

      {/* Apple Sign In Button */}
      <TouchableOpacity
        onPress={handleAppleSignIn}
        disabled={state.isAppleLoading || state.isDisabled}
        style={{
          backgroundColor: state.isAppleLoading || state.isDisabled ? '#ccc' : '#000',
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          alignItems: 'center'
        }}
        accessibilityRole="button"
        accessibilityLabel="Mit Apple anmelden"
        accessibilityHint="Verwenden Sie Ihre Apple-ID zur Anmeldung"
        accessibilityState={{
          disabled: state.isAppleLoading || state.isDisabled
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600'
          }}
        >
          {state.isAppleLoading ? 'Apple-Anmeldung...' : 'Mit Apple anmelden'}
        </Text>
      </TouchableOpacity>

      {/* Action Links */}
      <View style={{ alignItems: 'center' }}>
        <TouchableOpacity
          onPress={handleNavigateToReset}
          disabled={state.isLoading || state.isDisabled}
          style={{ marginBottom: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Passwort vergessen"
          accessibilityHint="Setzen Sie Ihr Passwort zurück"
        >
          <Text style={{ color: '#007AFF', fontSize: 16 }}>
            Passwort vergessen?
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>
            Noch kein Konto? 
          </Text>
          <TouchableOpacity
            onPress={handleNavigateToSignup}
            disabled={state.isLoading || state.isDisabled}
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
  );
}

export default LoginScreen;
