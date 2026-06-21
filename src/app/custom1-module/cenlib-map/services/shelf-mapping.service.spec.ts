import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
} from '@angular/common/http/testing';

import { ShelfMappingService } from './shelf-mapping.service';

describe('ShelfMappingService', () => {
  let service: ShelfMappingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ShelfMappingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Parity with the Primo Maps producer (NDE_MAPS_MANGER, issue #100).
  // These cases mirror the producer's own test suites
  // (admin/__tests__/call-number-ordering.test.js and
  //  lambda/__tests__/range-validation-compare.test.mjs) so the consumer's
  // ordering stays behaviorally identical to compareCallNumbers there.
  describe('compareDeweyNumbers (producer #100 parity)', () => {
    const lt = (a: string, b: string) => expect(service.compareDeweyNumbers(a, b)).toBe(-1);
    const gt = (a: string, b: string) => expect(service.compareDeweyNumbers(a, b)).toBe(1);
    const eq = (a: string, b: string) => expect(service.compareDeweyNumbers(a, b)).toBe(0);

    it('orders plain Dewey by magnitude (3-digit integer parts)', () => {
      lt('099.5', '100');
      lt('292', '471.7');
    });

    it('sorts a parenthetical right after the base, before any decimal', () => {
      lt('396(44)', '396.04'); // '(' < '.'
      lt('396.04', '396.4');
      lt('396.4', '396.5');
      lt('320(5800)', '320.1');
    });

    it('orders different-length parentheticals digit-by-digit', () => {
      lt('323.67(6761)', '323.67(73)'); // 6 < 7 at first differing digit
      gt('323.67(73)', '323.67(6761)');
      lt('323.67(73)', '323.7');
    });

    it('keeps leading zeros significant', () => {
      lt('320(044)', '320(44)');
      lt('320(044)', '320(1)');
    });

    it('compares double parentheticals digit-by-digit', () => {
      lt('327(47)(56)', '327(73)(47)'); // 4 < 7
    });

    it('sorts a base before its own parenthetical sub-classification', () => {
      lt('913', '913(32)');
    });

    it('treats equal values as equal', () => {
      eq('471.7', '471.7');
    });

    it('orders ML / MT prefixes by the natural number after the prefix', () => {
      lt('ML5', 'ML113'); // 5 < 113 (NOT string order, where "ML5" > "ML113")
      lt('ML5', 'ML10');
      lt('ML10', 'ML100');
      lt('ML100', 'ML234');
      lt('MT5', 'MT113');
    });

    it('sorts digit-leading Dewey before alpha-prefixed', () => {
      lt('471', 'ML5');
    });
  });

  // TAU addition over the producer: DOM call numbers may not be 3-digit padded,
  // so a short leading integer is canonicalized before comparison.
  describe('compareDeweyNumbers (TAU leading-zero canonicalization)', () => {
    it('pads a short integer so magnitude is correct (99.5 < 100)', () => {
      expect(service.compareDeweyNumbers('99.5', '100')).toBe(-1);
      expect(service.compareDeweyNumbers('9.5', '100')).toBe(-1);
    });

    it('treats a non-padded call number as equal to its padded form', () => {
      expect(service.compareDeweyNumbers('99.5', '099.5')).toBe(0);
      expect(service.compareDeweyNumbers('9', '009')).toBe(0);
    });

    it('does NOT pad ML/MT prefixes (still natural-number ordered)', () => {
      expect(service.compareDeweyNumbers('ML5', 'ML113')).toBe(-1);
    });
  });

  describe('canonicalizeCallNumber (private behavior)', () => {
    const canon = (v: string) => (service as unknown as {
      canonicalizeCallNumber(v: string): string;
    }).canonicalizeCallNumber(v);

    it('zero-pads short Dewey integers to 3 digits', () => {
      expect(canon('99.5')).toBe('099.5');
      expect(canon('9')).toBe('009');
      expect(canon('0')).toBe('000');
    });

    it('leaves already-canonical values unchanged (idempotent)', () => {
      expect(canon('296.5')).toBe('296.5');
      expect(canon('301.153(42)')).toBe('301.153(42)');
      expect(canon('1296')).toBe('1296'); // 4 digits: not truncated
    });

    it('leaves alpha-prefixed call numbers untouched', () => {
      expect(canon('ML5')).toBe('ML5');
      expect(canon('QA76')).toBe('QA76');
    });
  });

  describe('isInDeweyRange', () => {
    it('includes both inclusive boundaries', () => {
      expect(service.isInDeweyRange('292', '292', '471.7')).toBe(true);
      expect(service.isInDeweyRange('471.7', '292', '471.7')).toBe(true);
    });

    it('excludes values just outside the range', () => {
      expect(service.isInDeweyRange('291', '292', '471.7')).toBe(false);
      expect(service.isInDeweyRange('472', '292', '471.7')).toBe(false);
    });

    it('matches a parenthetical call number inside a base range', () => {
      expect(service.isInDeweyRange('301.153(42)', '301', '302')).toBe(true);
    });

    it('matches a non-padded DOM call number against padded ranges', () => {
      expect(service.isInDeweyRange('99.5', '099', '100')).toBe(true);
    });

    it('reflects producer semantics: trailing zeros are NOT equal (issue #11 reversal)', () => {
      // Under the producer\'s string method 296.50 > 296.5, so a trailing-zero
      // call number does NOT fall inside a single-point 296.5 range.
      expect(service.isInDeweyRange('296.50', '296.5', '296.5')).toBe(false);
    });
  });
});
