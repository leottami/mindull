/**
 * PII-Scrubber für lokale Datenverarbeitung
 * Entfernt/ersetzt persönlich identifizierbare Informationen vor AI-Verarbeitung
 */

export interface ScrubResult {
  scrubbedText: string;
  originalMap: Map<string, string>;
}

export interface ScrubOptions {
  preserveCase?: boolean;
  customPlaceholders?: {
    name?: string;
    location?: string;
    email?: string;
    phone?: string;
  };
}

export class PIIScrubber {
  private static readonly DEFAULT_PLACEHOLDERS = {
    name: '[NAME]',
    location: '[LOCATION]',
    email: '[EMAIL]',
    phone: '[PHONE]'
  };

  private static readonly PATTERNS = {
    // E-Mail-Adressen (spezifischste Patterns zuerst)
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // Deutsche Telefonnummern (verschiedene Formate)
    phone: /\b(?:\+49|0)[\s-]?[0-9\s-]{8,15}\b/g,
    
    // Orte/Adressen (Deutschland-fokussiert) - nur echte Ortsnamen
    location: /\b[A-ZÄÖÜ][a-zäöüß]+(?:[- ]+[A-ZÄÖÜ][a-zäöüß]+)*\s+(?:Straße|Strasse|Weg|Platz|Allee|Gasse|Ring)\b/g
  };

  // Whitelist für deutsche Wörter, die nicht als Namen erkannt werden sollen
  private static readonly COMMON_WORDS = new Set([
    'Heute', 'Gestern', 'Morgen', 'Kontaktiere', 'Ruf', 'Tel', 'Ich', 'Du', 'Sie', 'Wir', 'Ihr', 'mich', 'an', 'Tag', 'Text', 'Einfacher',
    'Herr', 'Frau', 'Fräulein', 'Doktor', 'Professor', 'Direktor', 'Manager', 'Chef', 'Boss',
    'Vater', 'Mutter', 'Sohn', 'Tochter', 'Bruder', 'Schwester', 'Oma', 'Opa', 'Onkel', 'Tante',
    'Freund', 'Freundin', 'Kollege', 'Kollegin', 'Nachbar', 'Nachbarin', 'Arzt', 'Ärztin',
    'Lehrer', 'Lehrerin', 'Student', 'Studentin', 'Schüler', 'Schülerin', 'Kunde', 'Kundin',
    'Kontakt', 'Adresse', 'Telefon', 'Email', 'E-Mail', 'Nummer', 'Straße', 'Strasse', 'Weg',
    'Platz', 'Allee', 'Gasse', 'Ring', 'Haus', 'Wohnung', 'Apartment', 'Zimmer', 'Etage',
    'Stockwerk', 'Gebäude', 'Büro', 'Firma', 'Unternehmen', 'Geschäft', 'Laden', 'Restaurant',
    'Café', 'Bar', 'Hotel', 'Pension', 'Gasthaus', 'Krankenhaus', 'Klinik', 'Praxis', 'Schule',
    'Universität', 'Hochschule', 'Institut', 'Behörde', 'Amt', 'Rathaus', 'Polizei', 'Feuerwehr',
    'Post', 'Bank', 'Sparkasse', 'Volksbank', 'Deutsche', 'Bank', 'Commerzbank', 'HypoVereinsbank',
    'Berlin', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund',
    'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum',
    'Wuppertal', 'Bielefeld', 'Bonn', 'Mannheim', 'Karlsruhe', 'Wiesbaden', 'Münster', 'Gelsenkirchen',
    'Aachen', 'Braunschweig', 'Chemnitz', 'Kiel', 'Halle', 'Magdeburg', 'Freiburg', 'Krefeld',
    'Lübeck', 'Oberhausen', 'Erfurt', 'Mainz', 'Rostock', 'Kassel', 'Potsdam', 'Hagen',
    'Potsdam', 'Hamm', 'Mülheim', 'Ludwigshafen', 'Leverkusen', 'Oldenburg', 'Osnabrück',
    'Solingen', 'Heidelberg', 'Herne', 'Neuss', 'Darmstadt', 'Paderborn', 'Regensburg',
    'Ingolstadt', 'Würzburg', 'Fürth', 'Wolfsburg', 'Offenbach', 'Ulm', 'Heilbronn', 'Pforzheim',
    'Göttingen', 'Bottrop', 'Trier', 'Recklinghausen', 'Reutlingen', 'Bremerhaven', 'Koblenz',
    'Bergisch', 'Gladbach', 'Jena', 'Remscheid', 'Erlangen', 'Moers', 'Siegen', 'Hildesheim',
    'Salzgitter', 'Cottbus', 'Kaiserslautern', 'Gütersloh', 'Schwerin', 'Witten', 'Gera',
    'Düren', 'Flensburg', 'Iserlohn', 'Tübingen', 'Ludwigsburg', 'Villingen-Schwenningen',
    'Konstanz', 'Minden', 'Worms', 'Velbert', 'Neumünster', 'Delmenhorst', 'Brandenburg',
    'Norderstedt', 'Wilhelmshaven', 'Bamberg', 'Celle', 'Landshut', 'Aschaffenburg', 'Dessau',
    'Rosenheim', 'Rheine', 'Herford', 'Stralsund', 'Friedrichshafen', 'Schwäbisch', 'Gmünd',
    'Offenburg', 'Neubrandenburg', 'Greifswald', 'Bergheim', 'Herten', 'Garbsen', 'Wesel',
    'Sindelfingen', 'Langenfeld', 'Neu-Ulm', 'Grevenbroich', 'Euskirchen', 'Stolberg', 'Hameln',
    'Görlitz', 'Hilden', 'Meerbusch', 'Sankt', 'Augustin', 'Hürth', 'Waiblingen', 'Pulheim',
    'Baden-Baden', 'Menden', 'Bad', 'Salzuflen', 'Langenhagen', 'Nordhorn', 'Lingen', 'Bad',
    'Homburg', 'Neustadt', 'Ahlen', 'Wolfenbüttel', 'Ibbenbüren', 'Schweinfurt', 'Wetzlar',
    'Gummersbach', 'Bergkamen', 'Cuxhaven', 'Sankt', 'Ingbert', 'Königswinter', 'Kerpen',
    'Schwäbisch', 'Hall', 'Rüsselsheim', 'Leinfelden-Echterdingen', 'Eschweiler', 'Goslar',
    'Willich', 'Germering', 'Sankt', 'Augustin', 'Speyer', 'Bünde', 'Böblingen', 'Lörrach',
    'Rheinfelden', 'Viersen', 'Langen', 'Hameln', 'Bad', 'Kreuznach', 'Mühlheim', 'Baden',
    'Lünen', 'Bad', 'Oeynhausen', 'Neu-Isenburg', 'Langen', 'Kamp-Lintfort', 'Laatzen',
    'Sankt', 'Wendel', 'Greven', 'Friedberg', 'Hessisch', 'Oldendorf', 'Waldshut-Tiengen',
    'Tönisvorst', 'Bad', 'Hersfeld', 'Neunkirchen', 'Wülfrath', 'Überlingen', 'Rinteln',
    'Schwandorf', 'Buchholz', 'Nordheide', 'Wertheim', 'Nettetal', 'Geldern', 'Lübbecke',
    'Vechta', 'Bad', 'Neuenahr-Ahrweiler', 'Kempen', 'Bad', 'Zwischenahn', 'Lage', 'Meppen',
    'Kehl', 'Seelze', 'Winsen', 'Wittenberg', 'Königs', 'Wusterhausen', 'Sprockhövel',
    'Wermelskirchen', 'Leichlingen', 'Rheinland', 'Bad', 'Soden', 'Taunus', 'Hückelhoven',
    'Schwelm', 'Warendorf', 'Neustadt', 'Weinstrasse', 'Wülfrath', 'Überlingen', 'Rinteln',
    'Schwandorf', 'Buchholz', 'Nordheide', 'Wertheim', 'Nettetal', 'Geldern', 'Lübbecke',
    'Vechta', 'Bad', 'Neuenahr-Ahrweiler', 'Kempen', 'Bad', 'Zwischenahn', 'Lage', 'Meppen',
    'Kehl', 'Seelze', 'Winsen', 'Wittenberg', 'Königs', 'Wusterhausen', 'Sprockhövel',
    'Wermelskirchen', 'Leichlingen', 'Rheinland', 'Bad', 'Soden', 'Taunus', 'Hückelhoven',
    'Schwelm', 'Warendorf', 'Neustadt', 'Weinstrasse'
  ]);

  /**
   * Entfernt PII aus Text und ersetzt sie durch Platzhalter
   */
  static scrub(text: string, options: ScrubOptions = {}): ScrubResult {
    const placeholders = { ...this.DEFAULT_PLACEHOLDERS, ...options.customPlaceholders };
    const originalMap = new Map<string, string>();
    let scrubbedText = text;
    let counter = 1;

    // Reset regex state
    this.PATTERNS.email.lastIndex = 0;
    this.PATTERNS.phone.lastIndex = 0;
    this.PATTERNS.location.lastIndex = 0;

    // E-Mails zuerst (da sie spezifischste Patterns haben)
    const emailResult = this.replacePattern(
      scrubbedText,
      this.PATTERNS.email,
      placeholders.email!,
      originalMap,
      counter,
      'email'
    );
    scrubbedText = emailResult.scrubbedText;
    counter = emailResult.newCounter;

    // Telefonnummern
    const phoneResult = this.replacePattern(
      scrubbedText,
      this.PATTERNS.phone,
      placeholders.phone!,
      originalMap,
      counter,
      'phone'
    );
    scrubbedText = phoneResult.scrubbedText;
    counter = phoneResult.newCounter;

    // Orte (vor Namen, da sie spezifischer sind)
    const locationResult = this.replacePattern(
      scrubbedText,
      this.PATTERNS.location,
      placeholders.location!,
      originalMap,
      counter,
      'location'
    );
    scrubbedText = locationResult.scrubbedText;
    counter = locationResult.newCounter;

    // Namen (zuletzt, da sie am wenigsten spezifisch sind)
    const nameResult = this.replaceNames(
      scrubbedText,
      placeholders.name!,
      originalMap,
      counter
    );
    scrubbedText = nameResult.scrubbedText;
    counter = nameResult.newCounter;

    return { scrubbedText, originalMap };
  }

  /**
   * Stellt den ursprünglichen Text aus gescrubbten Daten wieder her
   */
  static unscrub(scrubbedText: string, originalMap: Map<string, string>): string {
    let restoredText = scrubbedText;
    
    for (const [placeholder, original] of originalMap) {
      restoredText = restoredText.replace(new RegExp(this.escapeRegex(placeholder), 'g'), original);
    }
    
    return restoredText;
  }

  /**
   * Prüft, ob Text PII enthält
   */
  static containsPII(text: string): boolean {
    // Reset regex state
    this.PATTERNS.email.lastIndex = 0;
    this.PATTERNS.phone.lastIndex = 0;
    this.PATTERNS.location.lastIndex = 0;
    
    // Prüfe E-Mails, Telefonnummern und Orte
    const hasEmail = this.PATTERNS.email.test(text);
    const hasPhone = this.PATTERNS.phone.test(text);
    const hasLocation = this.PATTERNS.location.test(text);
    
    // Prüfe Namen mit Whitelist
    const namePattern = /\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g;
    const nameMatches = text.match(namePattern);
    const hasName = nameMatches ? nameMatches.some(match => {
      const words = match.split(/\s+/);
      return !words.some(word => this.COMMON_WORDS.has(word));
    }) : false;
    
    return hasEmail || hasPhone || hasLocation || hasName;
  }

  /**
   * Zählt die Anzahl der PII-Einträge im Text
   */
  static countPII(text: string): Record<string, number> {
    const counts: Record<string, number> = {
      name: 0,
      location: 0,
      email: 0,
      phone: 0
    };

    // Reset regex state
    this.PATTERNS.email.lastIndex = 0;
    this.PATTERNS.phone.lastIndex = 0;
    this.PATTERNS.location.lastIndex = 0;

    // Zähle E-Mails, Telefonnummern und Orte
    const locationMatches = text.match(this.PATTERNS.location);
    const emailMatches = text.match(this.PATTERNS.email);
    const phoneMatches = text.match(this.PATTERNS.phone);

    // Zähle Namen mit Whitelist
    const namePattern = /\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g;
    const nameMatches = text.match(namePattern);
    counts.name = nameMatches ? nameMatches.filter(match => {
      const words = match.split(/\s+/);
      return !words.some(word => this.COMMON_WORDS.has(word));
    }).length : 0;

    counts.location = locationMatches?.length || 0;
    counts.email = emailMatches?.length || 0;
    counts.phone = phoneMatches?.length || 0;

    return counts;
  }

  private static replacePattern(
    text: string,
    pattern: RegExp,
    placeholder: string,
    originalMap: Map<string, string>,
    counter: number,
    type: string
  ): { scrubbedText: string; newCounter: number } {
    let newCounter = counter;
    // Reset regex state
    pattern.lastIndex = 0;
    const scrubbedText = text.replace(pattern, (match) => {
      const numberedPlaceholder = `${placeholder}_${newCounter}`;
      originalMap.set(numberedPlaceholder, match);
      newCounter++;
      return numberedPlaceholder;
    });
    return { scrubbedText, newCounter };
  }

  private static replaceNames(
    text: string,
    placeholder: string,
    originalMap: Map<string, string>,
    counter: number
  ): { scrubbedText: string; newCounter: number } {
    let newCounter = counter;
    const namePattern = /\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g;
    
    const scrubbedText = text.replace(namePattern, (match) => {
      // Prüfe, ob das Wort in der Whitelist steht
      const words = match.split(/\s+/);
      const isCommonWord = words.some(word => this.COMMON_WORDS.has(word));
      
      if (isCommonWord) {
        return match; // Nicht ersetzen
      }
      
      const numberedPlaceholder = `${placeholder}_${newCounter}`;
      originalMap.set(numberedPlaceholder, match);
      newCounter++;
      return numberedPlaceholder;
    });
    
    return { scrubbedText, newCounter };
  }

  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
