Auth (E-Mail + Apple)

Ziel
Zuverlässige Anmeldung mit E-Mail/Passwort und Sign in with Apple. Sichere Session-Verwaltung (Access/Refresh), Keychain für Refresh, Memory für Access, Auto-Refresh, saubere Logout-Räumung, RQ-Cache-Reset, Navigation.

Akzeptanzkriterien

Sign-up, Login, Logout, Password-Reset, E-Mail-Verifikation (Gate vor Nutzung).

Apple SSO: Nonce-Flow, id_token prüfen, Konto erstellen/verknüpfen.

Tokens: Auto-Refresh ab T-5 min, 401 → Re-auth.

Secure Storage nur für Refresh-Token; kein Token in Logs.

Auth-State-Wechsel räumt sensible Caches und invalidiert Query-Scopes.

Fehlertexte kurz, ohne PII; Lockout-Zähler/Backoff clientseitig.

Nicht-Ziele
UI-Branding, komplexe Rollen/Rechte, MDM/BYOD-Policies.

Telemetry (minimal)
auth.login.success|fail, auth.signup.success|fail, auth.apple.success|fail (ohne PII).

Tests (Unit)
Happy Paths (Email/Apple), Timeout/Offline, 401-Refresh, Secure-Storage-Fehler, Abbruch Apple.