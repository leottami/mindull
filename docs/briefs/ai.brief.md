Engineering-Brief #5 — AI (Evening Summary & Morning Focus)

Ziel
Abends 3–5 Bullet-Summary über Diary/Gratitude/Sessions (letzte 24 h) + 1 kurze Atem-Empfehlung; morgens Tagesfokus (2–3 Impulse, Gratitude-Reminder). PII-Scrubber lokal, robust bei Offline/Timeouts, geringer Token-Verbrauch.

Akzeptanzkriterien

generateEveningSummary(userId, range) und generateMorningFocus(userId) liefern strukturierte Ergebnisse (Titel + Bullets).

PII-Scrubber entfernt/ersetzt Namen/Orte konsistent; keine Rohdaten in Logs.

Budget-Kontrolle: kompakte Prompts, Limit pro Tag; Timeout-Fallback (freundlicher kurzer Text).

Cache: Ergebnisse des selben Zeitfensters nicht neu generieren.

Nicht-Ziele
Langtexte, Therapie-Ratschläge, Push-Generierung im Hintergrund (ohne Remote-Push).

Tests (Unit)
Leerdaten, Timeouts, Scrubber-Kantenfälle, deterministische Zusammenstellung der Eingabe, Cache-Treffer.