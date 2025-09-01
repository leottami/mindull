# Client-Sicherheitsregeln für mindull

## Übersicht

Dieses Dokument definiert die Client-seitigen Sicherheitsregeln für die mindull App. Alle Entwickler müssen diese Regeln strikt befolgen, um die Privatsphäre der Nutzer zu schützen und Compliance-Anforderungen zu erfüllen.

## 1. PII (Personally Identifiable Information) - Regeln

### 1.1 PII-Definition

**PII umfasst:**
- E-Mail-Adressen (außer in Auth-Kontext)
- Namen (Vor-/Nachname)
- Geburtsdaten
- Telefonnummern
- Adressen
- IP-Adressen
- Geräte-IDs (außer anonymisiert)
- Session-Tokens
- Passwörter (auch gehashte)

### 1.2 PII-Verbot in Logs

**STRENG VERBOTEN:**
```typescript
// ❌ FALSCH
console.log('User email:', user.email);
console.error('Login failed for:', email);
logger.info('User session:', session);

// ✅ RICHTIG
console.log('User authentication successful');
console.error('Login failed - invalid credentials');
logger.info('Session created successfully');
```

### 1.3 PII-Scrubbing für AI-Anfragen

**Vor AI-API-Calls:**
```typescript
// ❌ FALSCH
const prompt = `User ${user.name} (${user.email}) wrote: ${diaryEntry}`;

// ✅ RICHTIG
const scrubbedPrompt = scrubPII(diaryEntry);
const prompt = `User diary entry: ${scrubbedPrompt}`;
```

**PII-Scrubbing-Funktion:**
```typescript
function scrubPII(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, '[DATE]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]');
}
```

### 1.4 PII in Error Messages

**Verboten:**
```typescript
// ❌ FALSCH
throw new Error(`User ${email} not found`);
throw new Error(`Invalid password for ${user.name}`);

// ✅ RICHTIG
throw new Error('User not found');
throw new Error('Invalid credentials');
```

## 2. Logging-Regeln

### 2.1 Erlaubte Log-Inhalte

**SICHER ZU LOGGEN:**
- Event-Namen (auth.login.success)
- Error-Codes (AUTH_INVALID_CREDENTIALS)
- Timestamps
- Anonymisierte User-IDs (user_123)
- Feature-Nutzung (breathing_session_started)
- Performance-Metriken
- App-Version
- Geräte-Typ (ohne spezifische ID)

### 2.2 Log-Level-Richtlinien

**DEBUG:**
```typescript
logger.debug('Component mounted', { component: 'LoginScreen' });
logger.debug('API call initiated', { endpoint: '/auth/login' });
```

**INFO:**
```typescript
logger.info('User authenticated successfully');
logger.info('Breathing session completed', { duration: 300 });
```

**WARN:**
```typescript
logger.warn('Rate limit approaching', { attempts: 4 });
logger.warn('Network connectivity issues detected');
```

**ERROR:**
```typescript
logger.error('Authentication failed', { 
  errorCode: 'AUTH_INVALID_CREDENTIALS',
  context: 'login_screen'
});
```

### 2.3 Strukturiertes Logging

**Verwende strukturierte Logs:**
```typescript
// ❌ FALSCH
console.log('Something went wrong with user login');

// ✅ RICHTIG
logger.error('Authentication failed', {
  errorCode: 'AUTH_INVALID_CREDENTIALS',
  context: 'login_screen',
  timestamp: new Date().toISOString(),
  sessionId: generateSessionId(),
  retryCount: 2
});
```

## 3. Clipboard-Regeln

### 3.1 Clipboard-Verbot für Sensitive Daten

**STRENG VERBOTEN:**
```typescript
// ❌ FALSCH
Clipboard.setString(user.email);
Clipboard.setString(session.accessToken);
Clipboard.setString(user.password);

// ✅ RICHTIG
Clipboard.setString('mindull://share/breathing-session');
Clipboard.setString('Check out mindull - the mindfulness app!');
```

### 3.2 Erlaubte Clipboard-Inhalte

**SICHER ZU KOPIEREN:**
- Share-Links (ohne User-Daten)
- App-Store-Links
- Generische Texte
- Anonymisierte Session-IDs
- Feature-URLs

### 3.3 Clipboard-Validierung

```typescript
function isSafeForClipboard(content: string): boolean {
  const unsafePatterns = [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/, // E-Mail
    /password/i,
    /token/i,
    /secret/i,
    /key/i
  ];
  
  return !unsafePatterns.some(pattern => pattern.test(content));
}

// Verwendung
if (isSafeForClipboard(textToCopy)) {
  Clipboard.setString(textToCopy);
} else {
  throw new Error('Content contains sensitive data');
}
```

## 4. Screenshot-Regeln

### 4.1 Screenshot-Schutz für Sensitive Screens

**Zu schützende Bereiche:**
- Login/Signup-Screens
- E-Mail-Verifikation
- Passwort-Reset
- User-Profile mit persönlichen Daten
- Journal-Einträge
- Gratitude-Einträge
- AI-Reflexionen

### 4.2 Screenshot-Schutz implementieren

```typescript
import { Platform } from 'react-native';

// iOS Screenshot-Schutz
if (Platform.OS === 'ios') {
  import('react-native-screenshot-prevent').then(({ default: ScreenshotPrevent }) => {
    ScreenshotPrevent.enabled(true);
  });
}

// Android Screenshot-Schutz
if (Platform.OS === 'android') {
  import('react-native-screenshot-prevent').then(({ default: ScreenshotPrevent }) => {
    ScreenshotPrevent.enabled(true);
  });
}
```

### 4.3 Screen-spezifischer Schutz

```typescript
// In sensitive Screens
useEffect(() => {
  const enableScreenshotProtection = () => {
    if (Platform.OS === 'ios') {
      // iOS: FLAG_SECURE equivalent
      ScreenshotPrevent.enabled(true);
    }
  };

  const disableScreenshotProtection = () => {
    ScreenshotPrevent.enabled(false);
  };

  enableScreenshotProtection();
  
  return () => {
    disableScreenshotProtection();
  };
}, []);
```

### 4.4 Screenshot-Detection

```typescript
import { AppState } from 'react-native';

useEffect(() => {
  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      // App wurde wieder aktiv - möglicher Screenshot
      logger.warn('App became active - potential screenshot taken', {
        screen: 'sensitive_screen',
        timestamp: new Date().toISOString()
      });
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    AppState.removeEventListener('change', handleAppStateChange);
  };
}, []);
```

## 5. Secure Storage-Regeln

### 5.1 Token-Speicherung

**NUR im Keychain:**
```typescript
// ✅ RICHTIG
await Keychain.setInternetCredentials('mindull_refresh_token', {
  username: 'refresh_token',
  password: refreshToken
});

// ❌ FALSCH
await AsyncStorage.setItem('access_token', accessToken);
```

### 5.2 Sensitive Daten niemals in AsyncStorage

**VERBOTEN:**
```typescript
// ❌ FALSCH
AsyncStorage.setItem('user_email', user.email);
AsyncStorage.setItem('session_token', session.token);
AsyncStorage.setItem('user_password', password);
```

**ERLAUBT:**
```typescript
// ✅ RICHTIG
AsyncStorage.setItem('app_settings', JSON.stringify({
  theme: 'dark',
  notifications_enabled: true,
  language: 'de'
}));
```

## 6. Network Security

### 6.1 HTTPS-Only

```typescript
// ✅ RICHTIG
const API_BASE_URL = 'https://api.mindull.com';

// ❌ FALSCH
const API_BASE_URL = 'http://api.mindull.com';
```

### 6.2 Certificate Pinning

```typescript
// Implementiere Certificate Pinning für kritische Endpoints
const certificatePinner = {
  'api.mindull.com': {
    sha256: ['expected_certificate_hash']
  }
};
```

### 6.3 Network Security Config (Android)

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.mindull.com</domain>
    </domain-config>
</network-security-config>
```

## 7. Code Security

### 7.1 Keine Hardcoded Secrets

**VERBOTEN:**
```typescript
// ❌ FALSCH
const API_KEY = 'sk-1234567890abcdef';
const SECRET_TOKEN = 'secret123';
```

**ERLAUBT:**
```typescript
// ✅ RICHTIG
const API_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
```

### 7.2 Environment Variables

```typescript
// .env (nicht im Repo)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SECRET_TOKEN=your-secret-token

// .env.example (im Repo)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SECRET_TOKEN=your-secret-token
```

## 8. Error Handling Security

### 8.1 Keine Stack Traces in Production

```typescript
// ❌ FALSCH
console.error('Error:', error.stack);

// ✅ RICHTIG
logger.error('Application error', {
  errorCode: 'APP_ERROR',
  context: 'auth_service',
  timestamp: new Date().toISOString()
});
```

### 8.2 Generic Error Messages

```typescript
// ❌ FALSCH
throw new Error(`Database connection failed: ${dbError.message}`);

// ✅ RICHTIG
throw new Error('Service temporarily unavailable');
```

## 9. Testing Security

### 9.1 Test-Daten

```typescript
// ✅ RICHTIG
const testUser = {
  id: 'test_user_123',
  email: 'test@example.com', // Nur in Tests
  name: 'Test User'
};

// ❌ FALSCH
const testUser = {
  id: 'real_user_123',
  email: 'real@user.com',
  name: 'Real User'
};
```

### 9.2 Mock-Services

```typescript
// ✅ RICHTIG
jest.mock('../../services/auth', () => ({
  getAuthService: () => ({
    signIn: jest.fn().mockResolvedValue({ user: testUser }),
    signUp: jest.fn().mockResolvedValue({ user: testUser })
  })
}));
```

## 10. Compliance & Audit

### 10.1 Regelmäßige Security Audits

- **Wöchentlich:** Code-Review auf PII-Leaks
- **Monatlich:** Dependency Security Scan
- **Quartalsweise:** Penetration Testing
- **Jährlich:** Full Security Audit

### 10.2 Security Checklist

Vor jedem Release prüfen:
- [ ] Keine PII in Logs
- [ ] Keine Hardcoded Secrets
- [ ] HTTPS für alle API-Calls
- [ ] Screenshot-Schutz aktiviert
- [ ] Clipboard-Schutz implementiert
- [ ] Error Messages generisch
- [ ] Secure Storage verwendet
- [ ] Certificate Pinning aktiviert

### 10.3 Incident Response

Bei Security-Vorfällen:
1. **Sofort:** Betroffene Daten isolieren
2. **Innerhalb 24h:** Incident Report erstellen
3. **Innerhalb 48h:** Fix implementieren
4. **Innerhalb 72h:** Nutzer benachrichtigen (falls nötig)

## 11. Tools & Automation

### 11.1 Security Linting

```json
// .eslintrc.js
module.exports = {
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error'
  }
};
```

### 11.2 Pre-commit Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Check for PII in staged files
if git diff --cached | grep -i "email\|password\|token\|secret"; then
  echo "ERROR: Potential PII detected in staged files"
  exit 1
fi

# Check for hardcoded secrets
if git diff --cached | grep -E "sk-[a-zA-Z0-9]{20,}"; then
  echo "ERROR: Potential API key detected"
  exit 1
fi
```

### 11.3 Automated Security Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Security Scan
        run: |
          npm audit
          npx eslint . --ext .ts,.tsx
          npx tsc --noEmit
```

## 12. Dokumentation & Training

### 12.1 Developer Onboarding

Neue Entwickler müssen:
1. Diese Security-Rules lesen und verstehen
2. Security-Training absolvieren
3. Code-Review mit Security-Fokus durchführen
4. Incident Response-Prozeduren kennen

### 12.2 Regelmäßige Updates

- **Monatlich:** Security-Rules Review
- **Quartalsweise:** Security-Training Update
- **Bei Incidents:** Immediate Rule Updates

---

**Wichtig:** Diese Regeln sind nicht optional. Verstöße können zu Security-Incidents und Compliance-Problemen führen. Bei Unsicherheiten immer das Security-Team konsultieren.
