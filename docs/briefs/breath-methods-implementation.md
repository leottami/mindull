# Atem-Methoden Implementation

## Übersicht

Die Atem-Methoden-Implementierung definiert einen umfassenden Katalog verfügbarer Atemtechniken mit Parametergrenzen, Validierung und i18n-Unterstützung.

## Implementierte Dateien

### 1. `services/breath/methods.catalog.ts`
**Hauptkatalog der Atem-Methoden**

- **Verfügbare Methoden**: Box, 4-7-8, Coherent, Equal/5-5, Custom
- **Parametergrenzen**: 
  - Phase-Dauer: 1-20 Sekunden
  - Zyklen: 1-50 (methodenspezifisch)
  - Session-Dauer: 30-3600 Sekunden
- **Kategorien**: Relaxation, Focus, Sleep, Energy, Custom
- **Schwierigkeitsgrade**: Beginner, Intermediate, Advanced
- **i18n-Unterstützung**: Alle Namen und Beschreibungen über Schlüssel

### 2. `models/breath.model.ts`
**Erweiterte Datenmodelle für Atem-Sessions**

- **Session-Status**: Preparing, Active, Paused, Completed, Cancelled, Error
- **Phase-Tracking**: Detaillierte Verfolgung jeder Atem-Phase
- **Konfiguration**: Audio/Haptik-Einstellungen, Hintergrund-Audio
- **Ergebnisse**: Tatsächliche Dauer, abgeschlossene Zyklen, Unterbrechungen
- **Statistiken**: Methoden-Nutzung, Kategorie-Analyse, Erfolgsraten

### 3. `tests/services/breath/methods.catalog.spec.ts`
**Umfassende Unit-Tests**

- **Validierung**: Alle Grenzwerte und Constraints
- **Berechnungen**: Session-Dauer, Methoden-Dauer
- **Edge Cases**: Minimale und maximale Werte
- **Kategorisierung**: Methoden nach Schwierigkeit und Kategorie

## Verfügbare Methoden

### Box Breathing (4-4-4-4)
- **Kategorie**: Relaxation
- **Schwierigkeit**: Beginner
- **Standard**: 10 Zyklen (3-20)
- **Dauer**: ~3 Minuten
- **Beschreibung**: Gleichmäßiges Atemmuster für Entspannung

### 4-7-8 Breathing
- **Kategorie**: Sleep
- **Schwierigkeit**: Intermediate
- **Standard**: 8 Zyklen (3-15)
- **Dauer**: ~4 Minuten
- **Beschreibung**: Tiefe Einatmung, lange Pause, vollständige Ausatmung

### Coherent Breathing (5-5)
- **Kategorie**: Focus
- **Schwierigkeit**: Beginner
- **Standard**: 12 Zyklen (5-25)
- **Dauer**: ~5 Minuten
- **Beschreibung**: Gleichmäßige Atmung für Herz-Kohärenz

### Equal Breathing (5-5)
- **Kategorie**: Focus
- **Schwierigkeit**: Beginner
- **Standard**: 10 Zyklen (3-20)
- **Dauer**: ~4 Minuten
- **Beschreibung**: Ausgewogene Ein- und Ausatmung

### Custom Breathing
- **Kategorie**: Custom
- **Schwierigkeit**: Advanced
- **Standard**: 10 Zyklen (1-50)
- **Dauer**: Benutzerdefiniert
- **Beschreibung**: Eigene Atem-Zeiten

## Parametergrenzen

### Phase-Dauer
- **Minimum**: 1 Sekunde
- **Maximum**: 20 Sekunden
- **Standard**: 4 Sekunden

### Zyklen
- **Minimum**: 1 Zyklus
- **Maximum**: 50 Zyklen (methodenspezifisch)
- **Standard**: 10 Zyklen

### Session-Dauer
- **Minimum**: 30 Sekunden
- **Maximum**: 3600 Sekunden (1 Stunde)
- **Standard**: 300 Sekunden (5 Minuten)

## Validierung

### Methoden-Validierung
- Überprüfung gültiger Methoden-IDs
- Validierung von Phase-Dauern
- Überprüfung von Zyklus-Grenzen
- Session-Dauer-Validierung

### Konfigurations-Validierung
- Vollständige Custom-Konfiguration
- Standard-Methoden-Konfiguration
- Fehlerbehandlung mit deutschen Meldungen

## i18n-Unterstützung

Alle Methoden verwenden i18n-Schlüssel für Namen und Beschreibungen:

```typescript
{
  nameKey: 'breath.methods.box.name',
  descriptionKey: 'breath.methods.box.description'
}
```

## Verwendung

### Standard-Methode starten
```typescript
import { calculateMethodDuration, BREATHING_METHODS } from './services/breath/methods.catalog';

const duration = calculateMethodDuration('box', 10);
const config = BREATHING_METHODS.box;
```

### Benutzerdefinierte Konfiguration
```typescript
import { createCustomConfig, BreathingMethodValidator } from './services/breath/methods.catalog';

const customConfig = createCustomConfig(
  { inhaleSec: 6, exhaleSec: 8 },
  15
);

const errors = BreathingMethodValidator.validateCustomConfig(customConfig);
```

### Methoden nach Kategorie filtern
```typescript
import { getMethodsByCategory, getMethodsByDifficulty } from './services/breath/methods.catalog';

const beginnerMethods = getMethodsByDifficulty('beginner');
const focusMethods = getMethodsByCategory().focus;
```

## Tests

Alle Features sind mit umfassenden Unit-Tests abgedeckt:

- **45 Tests** für alle Funktionen
- **Edge Cases** und Grenzwerte
- **Validierung** aller Constraints
- **Berechnungen** und Hilfsfunktionen

## Nächste Schritte

1. **UI-Integration**: Methoden-Auswahl in der App
2. **Timer-Implementation**: Phasen-basierte Timer-Logik
3. **Audio/Haptik**: Integration von Audio-Cues und Haptik-Feedback
4. **Session-Tracking**: Speicherung und Analyse von Atem-Sessions
5. **i18n-Übersetzungen**: Deutsche und englische Texte
