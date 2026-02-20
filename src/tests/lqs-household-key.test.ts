import { describe, it, expect } from 'vitest';
import { generateHouseholdKey as quoteParserGenerateKey, splitFullNameIfDuplicated } from '@/lib/lqs-quote-parser';
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

  describe('splitFullNameIfDuplicated', () => {
    it('should split when both fields have same full name', () => {
      const result = splitFullNameIfDuplicated('Gwendolyn Smith', 'Gwendolyn Smith');
      expect(result).toEqual({ firstName: 'Gwendolyn', lastName: 'Smith' });
    });

    it('should be case-insensitive when comparing', () => {
      const result = splitFullNameIfDuplicated('Gwendolyn smith', 'GWENDOLYN SMITH');
      expect(result).toEqual({ firstName: 'Gwendolyn', lastName: 'smith' });
    });

    it('should handle "Last, First" comma format', () => {
      const result = splitFullNameIfDuplicated('Smith, Gwendolyn', 'Smith, Gwendolyn');
      expect(result).toEqual({ firstName: 'Gwendolyn', lastName: 'Smith' });
    });

    it('should handle multi-word last names', () => {
      const result = splitFullNameIfDuplicated('Mary Jane Watson', 'Mary Jane Watson');
      expect(result).toEqual({ firstName: 'Mary', lastName: 'Jane Watson' });
    });

    it('should not modify when names are different', () => {
      const result = splitFullNameIfDuplicated('John', 'Smith');
      expect(result).toEqual({ firstName: 'John', lastName: 'Smith' });
    });

    it('should not modify when names are empty', () => {
      const result = splitFullNameIfDuplicated('', '');
      expect(result).toEqual({ firstName: '', lastName: '' });
    });

    it('should return same value for single-word duplicates', () => {
      const result = splitFullNameIfDuplicated('Madonna', 'Madonna');
      expect(result).toEqual({ firstName: 'Madonna', lastName: 'Madonna' });
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
