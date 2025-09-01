# Apple SSO Setup & Konfiguration

## Übersicht

Dieses Dokument beschreibt die vollständige Einrichtung von Apple Sign-In für die mindull App, einschließlich Apple Developer Portal Konfiguration, Supabase Integration und Kantenfälle.

## 1. Apple Developer Portal Setup

### 1.1 Capabilities aktivieren

**Schritt 1: App ID konfigurieren**
1. Gehe zu [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigiere zu "Certificates, Identifiers & Profiles"
3. Wähle "Identifiers" → "App IDs"
4. Wähle deine App ID aus oder erstelle eine neue

**Schritt 2: Sign In with Apple aktivieren**
1. Klicke auf deine App ID
2. Scrolle zu "Capabilities"
3. Aktiviere "Sign In with Apple"
4. Klicke "Configure" neben Sign In with Apple

### 1.2 Services-ID erstellen

**Schritt 1: Services-ID anlegen**
1. Gehe zu "Identifiers" → "Services IDs"
2. Klicke "+" um eine neue Services-ID zu erstellen
3. Beschreibung: "mindull Apple Sign-In"
4. Identifier: `com.mindull.app.signin`
5. Klicke "Continue" und "Register"

**Schritt 2: Sign In with Apple konfigurieren**
1. Wähle die erstellte Services-ID
2. Aktiviere "Sign In with Apple"
3. Klicke "Configure"

**Schritt 3: Domains & Subdomains**
```
Primary App ID: com.mindull.app
Domains and Subdomains: mindull.supabase.co
Return URLs: https://mindull.supabase.co/auth/v1/callback
```

### 1.3 Private Key erstellen

**Schritt 1: Key generieren**
1. Gehe zu "Keys" → "All"
2. Klicke "+" um einen neuen Key zu erstellen
3. Key Name: "mindull-apple-signin"
4. Aktiviere "Sign In with Apple"
5. Klicke "Configure" und wähle deine Services-ID
6. Klicke "Save" und "Continue"
7. **WICHTIG:** Lade die .p8 Datei herunter (nur einmal verfügbar!)

**Schritt 2: Key-Details notieren**
```
Key ID: [aus der .p8 Datei oder Developer Portal]
Team ID: [aus Developer Portal → Membership]
Services ID: com.mindull.app.signin
```

## 2. Supabase Konfiguration

### 2.1 Environment Variables

**`.env` Datei:**
```bash
# Apple SSO Configuration
EXPO_PUBLIC_APPLE_CLIENT_ID=com.mindull.app.signin
EXPO_PUBLIC_APPLE_REDIRECT_URI=https://mindull.supabase.co/auth/v1/callback

# Apple Private Key (Base64 encoded)
APPLE_PRIVATE_KEY_BASE64=[base64_encoded_p8_content]
APPLE_KEY_ID=[key_id_from_p8]
APPLE_TEAM_ID=[team_id_from_developer_portal]
```

**Private Key Base64 Encoding:**
```bash
# Konvertiere .p8 zu Base64
base64 -i AuthKey_[KEY_ID].p8 | tr -d '\n'
```

### 2.2 Supabase Auth Settings

**Supabase Dashboard → Authentication → Providers:**

1. **Apple Provider aktivieren**
2. **Konfiguration:**
   ```
   Enabled: ✅
   Client ID: com.mindull.app.signin
   Client Secret: [generiert von Supabase]
   Redirect URL: https://mindull.supabase.co/auth/v1/callback
   ```

3. **Advanced Settings:**
   ```
   Enable Sign Up: ✅
   Enable Sign In: ✅
   Enable Email Confirmations: ❌ (Apple handles this)
   ```

### 2.3 Supabase Database Schema

**SQL für Apple SSO Support:**
```sql
-- Erweitere users Tabelle für Apple SSO
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS apple_id TEXT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS apple_email TEXT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS apple_linked_at TIMESTAMP WITH TIME ZONE;

-- Index für Apple ID Lookup
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON auth.users(apple_id);

-- Index für Apple Email Lookup
CREATE INDEX IF NOT EXISTS idx_users_apple_email ON auth.users(apple_email);

-- RLS Policies für Apple SSO
CREATE POLICY "Users can view own Apple data" ON auth.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own Apple data" ON auth.users
  FOR UPDATE USING (auth.uid() = id);
```

## 3. React Native Implementation

### 3.1 Dependencies installieren

```bash
# Apple Sign-In Library
npm install @react-native-apple-authentication/apple-authentication

# Für Expo
expo install expo-apple-authentication
```

### 3.2 iOS Konfiguration

**`ios/mindull/Info.plist`:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.mindull.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.mindull.app</string>
    </array>
  </dict>
</array>
```

**`ios/mindull/Entitlements.plist`:**
```xml
<key>com.apple.developer.applesignin</key>
<array>
  <string>Default</string>
</array>
```

### 3.3 Apple Sign-In Component

```typescript
import { appleAuth } from '@react-native-apple-authentication/apple-authentication';
import { AppleSSOFlow } from '../services/auth/apple.flow';

export const AppleSignInButton = () => {
  const handleAppleSignIn = async () => {
    try {
      const flow = new AppleSSOFlow();
      
      // 1. Nonce generieren
      const { nonce, config } = await flow.startSignIn('signin');
      
      // 2. Apple Sign-In Request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        user: null,
        nonce: nonce,
      });
      
      // 3. Response verarbeiten
      const response = {
        identityToken: appleAuthRequestResponse.identityToken!,
        authorizationCode: appleAuthRequestResponse.authorizationCode!,
        nonce: nonce,
        email: appleAuthRequestResponse.email,
        fullName: appleAuthRequestResponse.fullName,
        user: appleAuthRequestResponse.user
      };
      
      const result = await flow.handleSignInResponse(response, 'signin');
      
      if (result.success) {
        // Erfolgreicher Sign-In
        console.log('Apple Sign-In successful:', result.user);
      } else {
        // Fehler behandeln
        console.error('Apple Sign-In failed:', result.error);
      }
      
    } catch (error) {
      if (error.code === appleAuth.Error.CANCELED) {
        // User hat abgebrochen
        console.log('Apple Sign-In cancelled');
      } else {
        // Anderer Fehler
        console.error('Apple Sign-In error:', error);
      }
    }
  };

  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={{ width: '100%', height: 50 }}
      onPress={handleAppleSignIn}
    />
  );
};
```

## 4. Kantenfälle & Error Handling

### 4.1 Private Relay E-Mail

**Problem:** Apple generiert Private Relay E-Mail-Adressen
**Lösung:** Automatische Erkennung und Behandlung

```typescript
// Private Relay Detection
const isPrivateRelay = PrivateRelayHandler.isPrivateRelay(email);
if (isPrivateRelay) {
  // Spezielle Behandlung für Private Relay
  // E-Mail-Adresse kann sich bei jedem Sign-In ändern
}
```

### 4.2 Account Linking

**Problem:** User hat bereits E-Mail-Konto, will Apple verknüpfen
**Lösung:** Account-Linking Flow

```typescript
// Account-Linking Flow
const linkResult = await accountLinking.linkAccount(
  appleId,
  appleEmail,
  existingEmail,
  authorizationCode
);
```

### 4.3 E-Mail-Änderung

**Problem:** Apple E-Mail ändert sich (Private Relay)
**Lösung:** E-Mail-Update in Supabase

```typescript
// E-Mail-Update bei Apple Sign-In
if (user.appleEmail !== newAppleEmail) {
  await updateUserAppleEmail(userId, newAppleEmail);
}
```

### 4.4 Nonce-Validierung

**Problem:** Replay-Attacks
**Lösung:** Nonce-Management mit Expiry

```typescript
// Nonce generieren und validieren
const nonce = nonceManager.generateNonce('signin');
const isValid = nonceManager.validateNonce(nonce, 'signin');
```

## 5. Testing

### 5.1 Test-Konfiguration

**Sandbox Testing:**
```typescript
// Test Apple ID erstellen
// https://developer.apple.com/account/resources/identifiers/list/serviceId

// Test-Konfiguration
const TEST_APPLE_CONFIG = {
  clientId: 'com.mindull.app.signin.test',
  redirectUri: 'https://mindull.supabase.co/auth/v1/callback',
  scope: ['name', 'email']
};
```

### 5.2 Mock-Responses

```typescript
// Mock Apple Sign-In Response für Tests
const mockAppleResponse = {
  identityToken: 'mock_identity_token',
  authorizationCode: 'mock_auth_code',
  nonce: 'mock_nonce',
  email: 'test@privaterelay.appleid.com',
  fullName: {
    givenName: 'Test',
    familyName: 'User'
  }
};
```

### 5.3 Error-Szenarien testen

```typescript
// Test verschiedene Error-Szenarien
describe('Apple SSO Error Handling', () => {
  it('should handle invalid nonce', async () => {
    // Test invalid nonce
  });
  
  it('should handle expired token', async () => {
    // Test expired token
  });
  
  it('should handle private relay email', async () => {
    // Test private relay handling
  });
  
  it('should handle account linking', async () => {
    // Test account linking flow
  });
});
```

## 6. Production Checklist

### 6.1 Pre-Launch

- [ ] Apple Developer Portal konfiguriert
- [ ] Services-ID erstellt und konfiguriert
- [ ] Private Key generiert und gespeichert
- [ ] Supabase Apple Provider aktiviert
- [ ] Environment Variables gesetzt
- [ ] iOS Entitlements konfiguriert
- [ ] Database Schema aktualisiert
- [ ] RLS Policies erstellt

### 6.2 Testing

- [ ] Sandbox Apple ID erstellt
- [ ] Test-Sign-In funktioniert
- [ ] Private Relay E-Mail behandelt
- [ ] Account-Linking getestet
- [ ] Error-Handling getestet
- [ ] Nonce-Validierung getestet

### 6.3 Security

- [ ] Private Key sicher gespeichert
- [ ] Nonce-Validierung implementiert
- [ ] Token-Validierung implementiert
- [ ] Rate-Limiting konfiguriert
- [ ] Error-Logging ohne PII

### 6.4 Monitoring

- [ ] Apple Sign-In Erfolgsrate
- [ ] Private Relay Nutzung
- [ ] Account-Linking Rate
- [ ] Error-Rate nach Error-Code
- [ ] Performance-Metriken

## 7. Troubleshooting

### 7.1 Häufige Probleme

**Problem: "Invalid client" Error**
```
Lösung: Services-ID in Apple Developer Portal prüfen
```

**Problem: "Invalid redirect URI"**
```
Lösung: Redirect URI in Supabase und Apple Portal abgleichen
```

**Problem: "Invalid nonce"**
```
Lösung: Nonce-Generierung und -Validierung prüfen
```

**Problem: Private Relay E-Mail nicht erkannt**
```
Lösung: PrivateRelayHandler.isPrivateRelay() implementieren
```

### 7.2 Debug-Logging

```typescript
// Debug-Logging für Apple SSO
const APPLE_DEBUG = process.env.NODE_ENV === 'development';

if (APPLE_DEBUG) {
  console.log('Apple Sign-In Request:', {
    nonce,
    clientId: config.clientId,
    redirectUri: config.redirectUri
  });
}
```

## 8. Performance & Optimization

### 8.1 Caching

```typescript
// Apple Public Keys cachen
class AppleKeyCache {
  private static keys: Map<string, any> = new Map();
  private static lastFetch: number = 0;
  
  static async getKeys(): Promise<Map<string, any>> {
    const now = Date.now();
    if (now - this.lastFetch > 24 * 60 * 60 * 1000) {
      await this.fetchKeys();
    }
    return this.keys;
  }
}
```

### 8.2 Rate Limiting

```typescript
// Rate Limiting für Apple Sign-In
const appleRateLimiter = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 Minuten
  blockDuration: 60 * 60 * 1000 // 1 Stunde
};
```

---

**Wichtig:** Diese Konfiguration muss vor dem App-Store-Release vollständig getestet werden. Apple Sign-In ist ein kritischer Auth-Flow und Fehler können zu schlechten User-Reviews führen.
