import { PIIScrubber, type ScrubResult } from '../../../services/ai/scrubber';

describe('PIIScrubber', () => {
  describe('scrub', () => {
    it('sollte deutsche Namen korrekt ersetzen', () => {
      const text = 'Heute habe ich mit Anna Müller und Hans Schmidt gesprochen.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('Heute habe ich mit [NAME]_1 und [NAME]_2 gesprochen.');
      expect(result.originalMap.get('[NAME]_1')).toBe('Anna Müller');
      expect(result.originalMap.get('[NAME]_2')).toBe('Hans Schmidt');
    });

    it('sollte Namen mit Umlauten korrekt behandeln', () => {
      const text = 'Gestern traf ich Fräulein Schröder und Herrn Böhm.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('Gestern traf ich Fräulein [NAME]_1 und Herrn [NAME]_2.');
      expect(result.originalMap.get('[NAME]_1')).toBe('Schröder');
      expect(result.originalMap.get('[NAME]_2')).toBe('Böhm');
    });

    it('sollte E-Mail-Adressen korrekt ersetzen', () => {
      const text = 'Kontaktiere mich unter test@example.com oder support@mindull.de';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('Kontaktiere mich unter [EMAIL]_1 oder [EMAIL]_2');
      expect(result.originalMap.get('[EMAIL]_1')).toBe('test@example.com');
      expect(result.originalMap.get('[EMAIL]_2')).toBe('support@mindull.de');
    });

    it('sollte deutsche Telefonnummern korrekt ersetzen', () => {
      const text = 'Ruf mich an: +49 30 12345678 oder 0170 1234567';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('Ruf mich an: [PHONE]_1 oder [PHONE]_2');
      expect(result.originalMap.get('[PHONE]_1')).toBe('+49 30 12345678');
      expect(result.originalMap.get('[PHONE]_2')).toBe('0170 1234567');
    });

    it('sollte Orte und Adressen korrekt ersetzen', () => {
      const text = 'Ich wohne in der Musterstraße 123 in Hamburg.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('Ich wohne in der [LOCATION]_1 123 in [NAME]_1.');
      expect(result.originalMap.get('[LOCATION]_1')).toBe('Musterstraße');
      expect(result.originalMap.get('[NAME]_1')).toBe('Hamburg');
    });

    it('sollte komplexe Texte mit mehreren PII-Typen korrekt behandeln', () => {
      const text = 'Anna Müller (anna.mueller@email.de) wohnt in der Hauptstraße 5 in Köln. Tel: +49 89 12345678';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe('[NAME]_1 ([EMAIL]_1) wohnt in der [LOCATION]_1 5 in [NAME]_2. Tel: [PHONE]_1');
      expect(result.originalMap.get('[NAME]_1')).toBe('Anna Müller');
      expect(result.originalMap.get('[EMAIL]_1')).toBe('anna.mueller@email.de');
      expect(result.originalMap.get('[LOCATION]_1')).toBe('Hauptstraße');
      expect(result.originalMap.get('[NAME]_2')).toBe('Köln');
      expect(result.originalMap.get('[PHONE]_1')).toBe('+49 89 12345678');
    });

    it('sollte Text ohne PII unverändert lassen', () => {
      const text = 'Heute war ein schöner Tag. Ich habe meditiert und bin spazieren gegangen.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toBe(text);
      expect(result.originalMap.size).toBe(0);
    });

    it('sollte leeren Text korrekt behandeln', () => {
      const result = PIIScrubber.scrub('');
      
      expect(result.scrubbedText).toBe('');
      expect(result.originalMap.size).toBe(0);
    });

    it('sollte custom Placeholders verwenden', () => {
      const text = 'Anna Müller wohnt in Hamburg.';
      const result = PIIScrubber.scrub(text, {
        customPlaceholders: {
          name: '[PERSON]',
          location: '[STADT]'
        }
      });
      
      expect(result.scrubbedText).toBe('[PERSON]_1 wohnt in [PERSON]_2.');
      expect(result.originalMap.get('[PERSON]_1')).toBe('Anna Müller');
      expect(result.originalMap.get('[PERSON]_2')).toBe('Hamburg');
    });

    it('sollte deterministische Ersetzung durchführen', () => {
      const text = 'Anna Müller und Anna Schmidt';
      const result1 = PIIScrubber.scrub(text);
      const result2 = PIIScrubber.scrub(text);
      
      expect(result1.scrubbedText).toBe(result2.scrubbedText);
      expect(result1.originalMap).toEqual(result2.originalMap);
    });
  });

  describe('unscrub', () => {
    it('sollte gescrubbten Text korrekt wiederherstellen', () => {
      const originalText = 'Anna Müller (anna@test.de) wohnt in Berlin.';
      const result = PIIScrubber.scrub(originalText);
      const restored = PIIScrubber.unscrub(result.scrubbedText, result.originalMap);
      
      expect(restored).toBe(originalText);
    });

    it('sollte Text ohne PII unverändert lassen', () => {
      const text = 'Einfacher Text ohne PII.';
      const originalMap = new Map<string, string>();
      const restored = PIIScrubber.unscrub(text, originalMap);
      
      expect(restored).toBe(text);
    });

    it('sollte mit leeren Maps umgehen', () => {
      const text = '[NAME]_1 wohnt in [LOCATION]_1.';
      const originalMap = new Map<string, string>();
      const restored = PIIScrubber.unscrub(text, originalMap);
      
      expect(restored).toBe(text);
    });
  });

  describe('containsPII', () => {
    it('sollte true zurückgeben für Text mit PII', () => {
      expect(PIIScrubber.containsPII('Anna Müller')).toBe(true);
      expect(PIIScrubber.containsPII('test@email.de')).toBe(true);
      expect(PIIScrubber.containsPII('+49 30 12345678')).toBe(true);
      expect(PIIScrubber.containsPII('Hamburg')).toBe(true);
    });

    it('sollte false zurückgeben für Text ohne PII', () => {
      expect(PIIScrubber.containsPII('Einfacher Text')).toBe(false);
      expect(PIIScrubber.containsPII('')).toBe(false);
      expect(PIIScrubber.containsPII('Heute war ein schöner Tag.')).toBe(false);
    });
  });

  describe('countPII', () => {
    it('sollte korrekte Anzahl von PII-Einträgen zählen', () => {
      const text = 'Anna Müller und Hans Schmidt wohnen in Hamburg und Köln. Kontakt: test@email.de, +49 30 12345678';
      const counts = PIIScrubber.countPII(text);
      
      expect(counts.name).toBe(4); // Anna Müller, Hans Schmidt, Hamburg, Köln
      expect(counts.location).toBe(0); // Keine Straßennamen
      expect(counts.email).toBe(1); // test@email.de
      expect(counts.phone).toBe(1); // +49 30 12345678
    });

    it('sollte 0 für Text ohne PII zurückgeben', () => {
      const text = 'Einfacher Text ohne persönliche Informationen.';
      const counts = PIIScrubber.countPII(text);
      
      expect(counts.name).toBe(0);
      expect(counts.location).toBe(0);
      expect(counts.email).toBe(0);
      expect(counts.phone).toBe(0);
    });

    it('sollte leeren Text korrekt behandeln', () => {
      const counts = PIIScrubber.countPII('');
      
      expect(counts.name).toBe(0);
      expect(counts.location).toBe(0);
      expect(counts.email).toBe(0);
      expect(counts.phone).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit Sonderzeichen in Namen umgehen', () => {
      const text = 'Marie-Luise von der Osten wohnt in der Muster-Straße.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.scrubbedText).toContain('[LOCATION]_');
    });

    it('sollte mit mehrfachen Leerzeichen umgehen', () => {
      const text = 'Anna    Müller   wohnt   in   Hamburg.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.scrubbedText).toContain('[NAME]_');
    });

    it('sollte mit Zeilenumbrüchen umgehen', () => {
      const text = 'Anna\nMüller\nwohnt\nin\nHamburg.';
      const result = PIIScrubber.scrub(text);
      
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.scrubbedText).toContain('[NAME]_');
    });

    it('sollte mit sehr langen Texten umgehen', () => {
      const longText = 'Anna Müller '.repeat(1000) + 'wohnt in Hamburg.';
      const result = PIIScrubber.scrub(longText);
      
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.originalMap.size).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('sollte große Texte effizient verarbeiten', () => {
      const startTime = Date.now();
      const largeText = 'Anna Müller wohnt in Hamburg. '.repeat(1000);
      const result = PIIScrubber.scrub(largeText);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Sollte unter 1 Sekunde sein
      expect(result.scrubbedText).toContain('[NAME]_');
      expect(result.scrubbedText).toContain('[NAME]_');
    });
  });
});
