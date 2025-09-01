Breath (Timer & Methoden)

Ziel
Geführte Atemübungen (Box, 4-7-8, Coherent, „Equal/5-5“, „Custom“) mit präzisem Timer, Phasen-Events (Inhale/Hold/Exhale/Hold), Audio/Haptik-Cues, Pause/Resume, Abbruch, Session-Persistenz (für Analytics & AI), A11y.

Akzeptanzkriterien

Start in ≤3 Taps; Live-Progress je Phase; Pause/Resume/Stop funktioniert.

Methoden parametrisierbar (Sekunden/Zyklen); „Custom“ speicherbar.

Audio/Haptik pro Phase (abschaltbar in Settings).

Bei Abschluss wird BreathingSession geschrieben (method, durationSec, timestamp).

Fehlerrobust: Timer driftfrei, App-Hintergrund → sauberes Resume/Cancel.

Nicht-Ziele
Aufwendige Animationen/Branding (kommt später), Watch-Companion (Phase 2).

Tests (Unit)
Phasenwechsel, Pause/Resume, Abbruch, Zeitmessung, Settings-Respekt, Persistenz-Aufruf.