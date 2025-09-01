# 📌 Angeheftete Dokumente - mindull App

## Wichtige Referenzdokumente

### 🎯 [PRD.brief.md](./PRD.brief.md) - **ANGEHEFTET**
**Product Requirements Document** mit kompletter Vision, MVP-Scope und Engineering-Brief #0

**Schnellzugriff:**
- **Zweck**: Achtsamkeits-App (Atmung + Journal/Gratitude + Phase 2: Träume)
- **Zielgruppe**: 20-35 Jahre, iOS, privacy-first, offline-fähig
- **MVP-Muss**: Tabs (Breath/Journal/Gratitude/Settings), 3-5 Atemmethoden, Diary CRUD, AI-Reflexion
- **KPIs**: Crash-free ≥99.5%, D1≥30%, Atemstart ≤3 Taps/≤2s
- **Tech**: React Native + TS, React Query, Supabase, Sentry

### 🚀 Engineering-Brief #0: Bootstrap
**Aktueller Fokus:** App-Entry, Tab-Navigation, React-Query-Provider, Theme, Placeholder-Screens

**Akzeptanzkriterien:**
- ✅ App startet ohne Fehler
- ✅ Tabs funktionieren (Breath/Journal/Gratitude/Settings)  
- ✅ React Query konfiguriert
- ✅ Theme folgt System
- ✅ A11y-Labels vorhanden
- ✅ Sentry-Stub (ohne PII)

---

## Projektstruktur

```
mindull/
├── docs/
│   ├── PRD.brief.md     📌 ANGEHEFTET
│   └── README.md        (dieser Index)
├── .cursorrules         (Entwicklungsleitplanken)
├── app/                 (Screens & Navigation)
├── components/          (UI-Komponenten)
├── services/            (Business Logic)
└── ...
```

---

**💡 Tipp:** Diese Datei dient als "Pinboard" für wichtige Dokumente während der Entwicklung.
