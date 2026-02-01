import { describe, it, expect } from 'vitest';
import { generateHouseholdKey as quoteParserGenerateKey } from '@/lib/lqs-quote-parser';
import { generateHouseholdKey as salesParserGenerateKey } from '@/lib/lqs-sales-parser';

describe('Household Key Generation', () => {
  describe('Quote Parser', () => {
    it('should generate key with zip code', () => {
      const key = quoteParserGenerateKey('John', 'Smith', '12345');
      expect(key).toBe('SMITH_JOHN_12345');
    });

    it('should use 00000 when zip is null', () => {
      const key = quoteParserGenerateKey('John', 'Smith', null);
      expect(key).toBe('SMITH_JOHN_00000');
    });

    it('should use 00000 when zip is empty string', () => {
      const key = quoteParserGenerateKey('John', 'Smith', '');
      expect(key).toBe('SMITH_JOHN_00000');
    });

    it('should truncate zip to 5 characters', () => {
      const key = quoteParserGenerateKey('John', 'Smith', '12345-6789');
      expect(key).toBe('SMITH_JOHN_12345');
    });

    it('should normalize names to uppercase', () => {
      const key = quoteParserGenerateKey('john', 'smith', '12345');
      expect(key).toBe('SMITH_JOHN_12345');
    });

    it('should strip non-alpha characters from names', () => {
      const key = quoteParserGenerateKey("O'Brien", 'Mc-Donald Jr.', '12345');
      expect(key).toBe('MCDONALDJR_OBRIEN_12345');
    });

    it('should handle missing first name', () => {
      const key = quoteParserGenerateKey('', 'Smith', '12345');
      expect(key).toBe('SMITH_UNKNOWN_12345');
    });

    it('should handle missing last name', () => {
      const key = quoteParserGenerateKey('John', '', '12345');
      expect(key).toBe('UNKNOWN_JOHN_12345');
    });
  });

  describe('Sales Parser', () => {
    it('should generate key with zip code', () => {
      const key = salesParserGenerateKey('John', 'Smith', '12345');
      expect(key).toBe('SMITH_JOHN_12345');
    });

    it('should use 00000 when zip is null', () => {
      const key = salesParserGenerateKey('John', 'Smith', null);
      expect(key).toBe('SMITH_JOHN_00000');
    });

    it('should use 00000 when zip is empty string', () => {
      const key = salesParserGenerateKey('John', 'Smith', '');
      expect(key).toBe('SMITH_JOHN_00000');
    });
  });

  describe('Consistency between parsers', () => {
    it('should generate identical keys from both parsers', () => {
      const testCases = [
        { first: 'John', last: 'Smith', zip: '12345' },
        { first: 'Jane', last: 'Doe', zip: null },
        { first: 'Bob', last: 'Jones', zip: '' },
        { first: '', last: 'Unknown', zip: '00000' },
      ];

      for (const { first, last, zip } of testCases) {
        const quoteKey = quoteParserGenerateKey(first, last, zip);
        const salesKey = salesParserGenerateKey(first, last, zip);
        expect(quoteKey).toBe(salesKey);
      }
    });
  });
});
