# Product Requirements Brief – Achtsamkeits-App (Arbeitsname)

## Zweck & Vision
Moderne iOS-App (iPhone, später Apple Watch) für **Atmung**, **Journal/Gratitude** und perspektivisch **luzides Träumen**. Fokus: **privacy-first**, offline-fähig, schnell, klare UI, minimale Reibung. Zielgruppe: junge, offene iOS-Nutzer:innen (20–35), **Einzel-Use** ohne Community.

## Nicht-Ziele (MVP)
- Kein Android, keine sozialen Features.
- Kein klinisches/medizinisches Produkt.
- Keine Remote-Pushes (nur **lokale** Erinnerungen).
- Keine Watch-App (Phase 2).

## Top Use-Cases (MVP)
1. **Atemübung starten** in ≤3 Taps; visuelle/akustische Führung; jederzeit abbrechen.  
2. **Journal/Gratitude erfassen** (morgens/abends), auch **offline**, später synchronisiert.  
3. **AI-Reflexion**: abends 3–5 Bullet-Summary des Tages; morgens kurzer Fokus/Impuls.  
4. *(Phase 2)* **Reality-Checks & Traumtagebuch** (Lucidity-Tagging, Recall-Skala).

## MVP-Scope
**Muss**
- Tabs: Breath, Journal, Gratitude, Settings.
- 3–5 geführte Atemmethoden inkl. Timer/Animation.
- Journal/Gratitude: Erstellen, Anzeigen, Bearbeiten, Löschen.
- **Lokale** Notifications: Gratitude (AM/PM) + Reality-Check-Preview.
- Auth: E-Mail + **Sign in with Apple**.
- **React Query** Caching; **Offline** Reads/Writes (eventual consistency).
- Telemetry: Sentry (Crashes) + minimale, anonymisierte Events.
- AI-Reflexion (GPT-4o-mini) mit **lokalem PII-Scrubber**.

**Soll**
- Settings für Reminder-Zeitfenster.
- Light/Dark Theme (systembasiert).
- Basis-A11y (Labels, Dynamic Type, Kontraste).

**Kann**
- Tags/Suche im Journal, einfache Streaks.

## Datenobjekte (high-level, ohne Schema)
- **User:** id, email, settings (Reminder-Zeiten, Opt-ins).  
- **DiaryEntry:** id, userId, date, text, tags[].  
- **GratitudeEntry:** id, userId, date, morning?, evening?.  
- **BreathingSession:** id, userId, method, durationSec, timestamp.  
- *(Phase 2)* **DreamEntry:** id, userId, date, title, content, lucidity:boolean, recall:1–5, tags[].

## Offline & Sync
- **Lesen:** Stale-While-Revalidate (Cache sofort, Netzwerk nachziehend).  
- **Schreiben:** Outbox-Queue mit Retry/Exponential Backoff.  
- **Konflikte:** Last-Write-Wins (MVP); Konfliktindikator im UI; spätere Merge-Strategie möglich.  
- **Fehler-UX:** sanfte Banner/Toasts; kein Datenverlust ohne Nutzerzustimmung.

## Security & Privacy
- **Hosting/DB:** Supabase **EU-Region** (z. B. Frankfurt), **Row-Level-Security pro `user_id`**, Least-Privilege Policies.  
- **Auth/Tokens:** Access kurzlebig (im Speicher), Refresh in **iOS Keychain**; Re-Auth bei 401.  
- **GDPR:** Datenminimierung; klare Privacy-Hinweise; **Opt-in** für Analytics; Export/Löschung als Phase-2-UI.  
- **AI-Nutzung:** Vorverarbeitung lokal (Namen/Orte → Platzhalter); keine Prompts/Completions loggen; **Antwortzeit-Ziel ≤ 5 s**, Fallback-Text bei Timeout.  
- **Logging:** Keine PII; Fehlercodes/Taxonomie statt Freitext.

## Notifications (MVP, lokal)
- **Gratitude:** 2 feste Reminder (Morgen/Abend), Zeiten konfigurierbar.  
- **Reality-Check-Preview:** 3–5 Erinnerungen/Tag **zwischen 10–20 Uhr**, pseudo-zufällig verteilt, **Ruhezeit nachts**; vollständige RC-Logik & Traumtagebuch in Phase 2.

## UX & Qualitätsleitplanken
- **Startzeit:** Warm < 2 s, Cold < 4 s (aktueller iOS-Simulator).  
- **Bedienbarkeit:** ≤ 3 Taps bis Atemstart; Animation/Feedback ≤ 2 s sichtbar.  
- **Zustände:** Jeder Daten-Screen hat Loading/Empty/Error mit Retry/Undo; A11y-Labels vorhanden.  
- **Design:** Ruhiges, ablenkungsarmes Layout; systemkonforme Gesten/Back-Behavior.  
- **Text/Ton:** knappe, freundliche Microcopy; keine medizinischen Versprechen.

## KPIs (MVP-Leitplanken)
- **Crash-Free Sessions** ≥ 99,5 %.  
- **AI-Timeout-Rate** < 2 %.  
- **Reminder-Opt-in-Rate** ≥ 60 %.  
- **D1/D7 Retention** ≥ 30 % / ≥ 20 % (Richtwerte).  
- **Task-Completion Atemstart** ≤ 3 Taps, ≤ 2 s bis Animation.

## Technik-Standards
- **App:** React Native (TypeScript), React Navigation, UI-Kit (z. B. react-native-paper).  
- **State/Serverstate:** React Query (hierarchische Query-Keys, kontrollierte `staleTime`).  
- **Daten:** Supabase (Postgres, EU, RLS).  
- **Storage:** iOS Keychain (Tokens), AsyncStorage/SQLite (Cache/Outbox).  
- **Telemetry:** Sentry + minimale, anonymisierte Events.  
- **CI/CD:** EAS Build oder Fastlane → TestFlight.  
- **Compliance:** Privacy Nutrition Labels; keine Secrets im Repo.

## Roadmap-Hinweis (Phase 2)
- **Luzides Träumen:** Traumtagebuch (DreamEntry), Reality-Check-Engine, Insights; Watch-Companion.  
- **Datenrechte UI:** Export/Löschung, detaillierte Consent-Verwaltung.  
- **Remote-Pushes:** Später für intelligente Reminder (nach Opt-in).

## Arbeitsmodus mit Cursor
- Diese Datei **gepinnt** halten und in Prompts referenzieren.  
- Pro Baustein einen **Engineering-Brief** (1 Seite) pinnen: Scope, Akzeptanzkriterien, Fehlerfälle, Telemetrie, Tests.

## Offene Entscheidungen (mit Empfehlung)
1. **Supabase-Region/Policies:** EU + strikte RLS pro Tabelle (**empfohlen**).  
2. **Reminder-Defaults:** 08:00 & 20:00 (Gratitude); RC 3–5×/Tag 10–20 Uhr, Ruhezeit 20–10 Uhr (**empfohlen**).  
3. **AI-Modell:** GPT-4o-mini Standard; Modell-Switch in Settings später (**empfohlen**).  
4. **Brand/Name:** Arbeitsname neutral lassen; Branding nach MVP-Skeleton entscheiden (**empfohlen**).
