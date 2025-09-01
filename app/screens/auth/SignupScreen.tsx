/**
 * Signup Screen - Container-Logik ohne Styles
 * Registrierung mit E-Mail/Passwort + Apple SSO, Inline-Validation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { getAuthService } from '../../../services/auth';
import { EmailValidator, passwordValidator, authRateLimiter } from '../../../services/auth/policies';
import { AuthErrorCode, SignUpRequest, AppleSignInRequest } from '../../../services/auth/types';

// ============================================================================
// TYPES
// ============================================================================

interface SignupScreenState {
  email: string;
  password: string;
  confirmPassword: string;
  isLoading: boolean;
  isAppleLoading: boolean;
  errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  };
  isDisabled: boolean;
  remainingLockoutTime?: number;
  showPassword: boolean;
  showConfirmPassword: boolean;
  isSuccess: boolean;
  agreedToTerms: boolean;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Signup-Logik Hook
 */
function useSignupLogic() {
  const authService = getAuthService();
  
  const [state, setState] = useState<SignupScreenState>({
    email: '',
    password: '',
    confirmPassword: '',
    isLoading: false,
    isAppleLoading: false,
    errors: {},
    isDisabled: false,
    showPassword: false,
    showConfirmPassword: false,
    isSuccess: false,
    agreedToTerms: false
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
  const validateField = useCallback((field: keyof Pick<SignupScreenState, 'email' | 'password' | 'confirmPassword'>, value: string, otherValue?: string): string | undefined => {
    switch (field) {
      case 'email':
        const emailError = EmailValidator.validate(value);
        return emailError?.message;
      
      case 'password':
        const passwordError = passwordValidator.validate(value);
        return passwordError?.message;
      
      case 'confirmPassword':
        if (!value.trim()) {
          return 'Passwort-Bestätigung ist erforderlich';
        }
        if (value !== otherValue) {
          return 'Passwörter stimmen nicht überein';
        }
        return undefined;
      
      default:
        return undefined;
    }
  }, []);

  // Passwort-Stärke berechnen
  const getPasswordStrength = useCallback((password: string): PasswordStrength => {
    const score = passwordValidator.calculateStrength(password);
    
    if (score < 30) {
      return { score, label: 'Schwach', color: '#dc3545' };
    } else if (score < 60) {
      return { score, label: 'Mittel', color: '#fd7e14' };
    } else if (score < 80) {
      return { score, label: 'Gut', color: '#20c997' };
    } else {
      return { score, label: 'Sehr gut', color: '#198754' };
    }
  }, []);

  // Registrierung ausführen
  const performSignup = useCallback(async (email: string, password: string) => {
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
      const request: SignUpRequest = { email: email.trim(), password };
      await authService.signUp(request);
      
      setState(prev => ({
        ...prev,
        isSuccess: true,
        isLoading: false
      }));

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
    getPasswordStrength,
    performSignup,
    performAppleSignIn
  };
}

/**
 * Validation State Hook
 */
function useSignupValidation(email: string, password: string, confirmPassword: string, agreedToTerms: boolean) {
  const [validation, setValidation] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    terms: false,
    canSubmit: false
  });

  useEffect(() => {
    const emailValid = EmailValidator.validate(email) === null;
    const passwordValid = passwordValidator.validate(password) === null;
    const confirmPasswordValid = confirmPassword === password && confirmPassword.length > 0;
    const termsValid = agreedToTerms;
    const canSubmit = emailValid && passwordValid && confirmPasswordValid && termsValid;

    setValidation({
      email: emailValid,
      password: passwordValid,
      confirmPassword: confirmPasswordValid,
      terms: termsValid,
      canSubmit
    });
  }, [email, password, confirmPassword, agreedToTerms]);

  return validation;
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

function mapAuthError(error: any): string {
  if (!error?.code) {
    return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }

  switch (error.code) {
    case AuthErrorCode.USER_ALREADY_EXISTS:
      return 'Ein Konto mit dieser E-Mail-Adresse existiert bereits.';
    
    case AuthErrorCode.WEAK_PASSWORD:
      return error.message || 'Das Passwort ist zu schwach.';
    
    case AuthErrorCode.INVALID_EMAIL:
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    
    case AuthErrorCode.TOO_MANY_REQUESTS:
      return 'Zu viele Versuche. Bitte warten Sie einen Moment.';
    
    case AuthErrorCode.NETWORK_ERROR:
      return 'Netzwerkfehler. Prüfen Sie Ihre Internetverbindung.';
    
    case AuthErrorCode.API_TIMEOUT:
      return 'Zeitüberschreitung. Bitte versuchen Sie es erneut.';
    
    case AuthErrorCode.APPLE_CANCELLED:
      return 'Apple-Registrierung wurde abgebrochen.';
    
    case AuthErrorCode.APPLE_FAILED:
      return 'Apple-Registrierung fehlgeschlagen.';
    
    default:
      return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface SignupScreenProps {
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

export function SignupScreen({ navigation, route }: SignupScreenProps) {
  const {
    state,
    setState,
    validateField,
    getPasswordStrength,
    performSignup,
    performAppleSignIn
  } = useSignupLogic();

  const validation = useSignupValidation(
    state.email,
    state.password,
    state.confirmPassword,
    state.agreedToTerms
  );

  const passwordStrength = getPasswordStrength(state.password);

  // Refs für A11y Navigation
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      confirmPassword: text,
      errors: {
        ...prev.errors,
        confirmPassword: undefined,
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

  const handleConfirmPasswordBlur = useCallback(() => {
    const error = validateField('confirmPassword', state.confirmPassword, state.password);
    if (error) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, confirmPassword: error }
      }));
    }
  }, [state.confirmPassword, state.password, validateField, setState]);

  const handleSignup = useCallback(async () => {
    // Final validation
    const emailError = validateField('email', state.email);
    const passwordError = validateField('password', state.password);
    const confirmPasswordError = validateField('confirmPassword', state.confirmPassword, state.password);

    if (emailError || passwordError || confirmPasswordError) {
      setState(prev => ({
        ...prev,
        errors: {
          email: emailError,
          password: passwordError,
          confirmPassword: confirmPasswordError
        }
      }));
      
      // Focus auf erstes fehlerhaftes Feld
      if (emailError) {
        emailRef.current?.focus();
      } else if (passwordError) {
        passwordRef.current?.focus();
      } else if (confirmPasswordError) {
        confirmPasswordRef.current?.focus();
      }
      return;
    }

    if (!state.agreedToTerms) {
      setState(prev => ({
        ...prev,
        errors: {
          general: 'Bitte akzeptieren Sie die Nutzungsbedingungen.'
        }
      }));
      return;
    }

    await performSignup(state.email, state.password);
  }, [state.email, state.password, state.confirmPassword, state.agreedToTerms, validateField, performSignup, setState]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      // Mock Apple Sign-In Response
      const appleResponse = {
        identityToken: 'mock-identity-token',
        authorizationCode: 'mock-auth-code',
        nonce: 'mock-nonce',
        email: 'user@privaterelay.appleid.com'
      };
      
      await performAppleSignIn(appleResponse);
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: {
          general: 'Apple-Registrierung fehlgeschlagen'
        }
      }));
    }
  }, [performAppleSignIn, setState]);

  const handleToggleTerms = useCallback(() => {
    setState(prev => ({
      ...prev,
      agreedToTerms: !prev.agreedToTerms,
      errors: {
        ...prev.errors,
        general: undefined
      }
    }));
  }, [setState]);

  const handleNavigateToLogin = useCallback(() => {
    navigation.navigate('LoginScreen', { email: state.email });
  }, [navigation, state.email]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Registrierungs-Bildschirm"
    >
      {/* Header */}
      <View style={{ marginBottom: 32 }}>
        <Text
          style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}
          accessibilityRole="header"
          accessibilityLevel={1}
        >
          Konto erstellen
        </Text>
        <Text
          style={{ fontSize: 16, color: '#666' }}
          accessibilityHint="Erstellen Sie ein neues Konto für mindull"
        >
          Werden Sie Teil der mindull Community
        </Text>
      </View>

      {/* Success State */}
      {state.isSuccess && (
        <View
          style={{ backgroundColor: '#d4edda', padding: 12, borderRadius: 8, marginBottom: 16 }}
          accessibilityRole="alert"
          accessibilityLabel="Registrierung erfolgreich"
        >
          <Text style={{ color: '#155724' }}>
            Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.
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

      {/* Email Input */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}
          accessibilityLabel="E-Mail-Adresse"
        >
          E-Mail-Adresse *
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
            borderColor: state.errors.email ? '#dc3545' : (validation.email ? '#198754' : '#ccc'),
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
          }}
          accessibilityLabel="E-Mail-Adresse eingeben"
          accessibilityHint="Geben Sie Ihre E-Mail-Adresse ein"
          accessibilityState={{ invalid: !!state.errors.email }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          returnKeyType="next"
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

      {/* Password Input */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}
          accessibilityLabel="Passwort"
        >
          Passwort *
        </Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            ref={passwordRef}
            value={state.password}
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            placeholder="Mindestens 8 Zeichen"
            secureTextEntry={!state.showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            editable={!state.isLoading && !state.isDisabled}
            style={{
              borderWidth: 1,
              borderColor: state.errors.password ? '#dc3545' : (validation.password ? '#198754' : '#ccc'),
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              paddingRight: 50,
              backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
            }}
            accessibilityLabel="Passwort eingeben"
            accessibilityHint="Erstellen Sie ein sicheres Passwort"
            accessibilityState={{ invalid: !!state.errors.password }}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            returnKeyType="next"
          />
          <TouchableOpacity
            onPress={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
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
        
        {/* Password Strength Indicator */}
        {state.password.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, color: '#666', marginRight: 8 }}>
                Passwort-Stärke:
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: '600', color: passwordStrength.color }}
                accessibilityLabel={`Passwort-Stärke: ${passwordStrength.label}`}
              >
                {passwordStrength.label}
              </Text>
            </View>
            <View
              style={{
                height: 4,
                backgroundColor: '#e9ecef',
                borderRadius: 2,
                overflow: 'hidden'
              }}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: passwordStrength.score
              }}
            >
              <View
                style={{
                  width: `${passwordStrength.score}%`,
                  height: '100%',
                  backgroundColor: passwordStrength.color
                }}
              />
            </View>
          </View>
        )}

        {state.errors.password && (
          <Text
            style={{ color: '#dc3545', fontSize: 14, marginTop: 4 }}
            accessibilityRole="alert"
          >
            {state.errors.password}
          </Text>
        )}
      </View>

      {/* Confirm Password Input */}
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}
          accessibilityLabel="Passwort bestätigen"
        >
          Passwort bestätigen *
        </Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            ref={confirmPasswordRef}
            value={state.confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            onBlur={handleConfirmPasswordBlur}
            placeholder="Passwort erneut eingeben"
            secureTextEntry={!state.showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            editable={!state.isLoading && !state.isDisabled}
            style={{
              borderWidth: 1,
              borderColor: state.errors.confirmPassword ? '#dc3545' : (validation.confirmPassword ? '#198754' : '#ccc'),
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              paddingRight: 50,
              backgroundColor: state.isDisabled ? '#f8f9fa' : '#fff'
            }}
            accessibilityLabel="Passwort bestätigen"
            accessibilityHint="Geben Sie Ihr Passwort erneut ein"
            accessibilityState={{ invalid: !!state.errors.confirmPassword }}
            onSubmitEditing={handleSignup}
            returnKeyType="go"
          />
          <TouchableOpacity
            onPress={() => setState(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              padding: 4
            }}
            accessibilityRole="button"
            accessibilityLabel={state.showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            disabled={state.isLoading || state.isDisabled}
          >
            <Text style={{ color: '#007AFF', fontSize: 14 }}>
              {state.showConfirmPassword ? 'Verbergen' : 'Anzeigen'}
            </Text>
          </TouchableOpacity>
        </View>
        {state.errors.confirmPassword && (
          <Text
            style={{ color: '#dc3545', fontSize: 14, marginTop: 4 }}
            accessibilityRole="alert"
          >
            {state.errors.confirmPassword}
          </Text>
        )}
      </View>

      {/* Terms and Conditions */}
      <View style={{ marginBottom: 24 }}>
        <TouchableOpacity
          onPress={handleToggleTerms}
          style={{ flexDirection: 'row', alignItems: 'flex-start' }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: state.agreedToTerms }}
          accessibilityLabel="Nutzungsbedingungen akzeptieren"
          disabled={state.isLoading || state.isDisabled}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderWidth: 2,
              borderColor: state.agreedToTerms ? '#007AFF' : '#ccc',
              backgroundColor: state.agreedToTerms ? '#007AFF' : 'transparent',
              marginRight: 12,
              marginTop: 2,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {state.agreedToTerms && (
              <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                ✓
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 14, color: '#666', flex: 1, lineHeight: 20 }}>
            Ich akzeptiere die{' '}
            <Text style={{ color: '#007AFF', textDecorationLine: 'underline' }}>
              Nutzungsbedingungen
            </Text>
            {' '}und{' '}
            <Text style={{ color: '#007AFF', textDecorationLine: 'underline' }}>
              Datenschutzrichtlinien
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Signup Button */}
      <TouchableOpacity
        onPress={handleSignup}
        disabled={!validation.canSubmit || state.isLoading || state.isDisabled}
        style={{
          backgroundColor: (!validation.canSubmit || state.isLoading || state.isDisabled) ? '#ccc' : '#007AFF',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          alignItems: 'center'
        }}
        accessibilityRole="button"
        accessibilityLabel="Konto erstellen"
        accessibilityHint="Tippen Sie hier, um Ihr Konto zu erstellen"
        accessibilityState={{
          disabled: !validation.canSubmit || state.isLoading || state.isDisabled
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600'
          }}
        >
          {state.isLoading ? 'Konto wird erstellt...' : 'Konto erstellen'}
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
        accessibilityLabel="Mit Apple registrieren"
        accessibilityHint="Verwenden Sie Ihre Apple-ID zur Registrierung"
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
          {state.isAppleLoading ? 'Apple-Registrierung...' : 'Mit Apple registrieren'}
        </Text>
      </TouchableOpacity>

      {/* Login Link */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>
            Bereits ein Konto? 
          </Text>
          <TouchableOpacity
            onPress={handleNavigateToLogin}
            disabled={state.isLoading || state.isDisabled}
            style={{ marginLeft: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Anmelden"
            accessibilityHint="Melden Sie sich mit Ihrem bestehenden Konto an"
          >
            <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>
              Anmelden
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

export default SignupScreen;
