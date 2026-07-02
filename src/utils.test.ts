import { describe, expect, it } from 'vitest';
import { defaultSaveData, type TrailingPunctuationMode } from './constants';
import {
  checkIsBooleanSaveDataKey,
  checkIsTrailingPunctuationMode,
  getTrailingPunctuationPattern,
  parseSaveData,
} from './utils';

describe('getTrailingPunctuationPattern', () => {
  it('returns null for "none"', () => {
    expect(getTrailingPunctuationPattern('none')).toBeNull();
  });

  const cases: {
    mode: Exclude<TrailingPunctuationMode, 'none'>;
    trims: string[];
    keeps: string[];
  }[] = [
    { mode: 'period', trims: ['.', '..', '...'], keeps: [':', '?', ')', ',', ';', '!', ']'] },
    { mode: 'periodColon', trims: ['.', ':', '.:', ':.', '::.'], keeps: ['?', ')', ',', '!'] },
    {
      mode: 'periodColonQuestion',
      trims: ['.', ':', '?', '?.:', '...'],
      keeps: [')', ',', ';', '!', ']'],
    },
    { mode: 'all', trims: ['.', ':', '?', ')', ').?', '...)'], keeps: [',', ';', '!', ']', '}'] },
  ];

  for (const { mode, trims, keeps } of cases) {
    describe(mode, () => {
      const pattern = getTrailingPunctuationPattern(mode);

      it('returns a RegExp', () => {
        expect(pattern).toBeInstanceOf(RegExp);
      });

      for (const suffix of trims) {
        it(`strips trailing "${suffix}"`, () => {
          const target = `https://example.com${suffix}`;
          const match = pattern?.exec(target);

          expect(match?.[0]).toBe(suffix);
        });
      }

      for (const suffix of keeps) {
        it(`does not strip trailing "${suffix}"`, () => {
          const target = `https://example.com${suffix}`;

          expect(pattern?.exec(target)).toBeNull();
        });
      }
    });
  }

  it('does not match punctuation embedded in the middle of a URL', () => {
    const pattern = getTrailingPunctuationPattern('all');

    expect(pattern?.exec('https://example.com/foo?bar')).toBeNull();
  });
});

describe('checkIsTrailingPunctuationMode', () => {
  it.each(['none', 'period', 'periodColon', 'periodColonQuestion', 'all'])('accepts %s', (mode) => {
    expect(checkIsTrailingPunctuationMode(mode)).toBe(true);
  });

  it.each(['periodAndComma', 'common', 'extended', '', 'unknown', null, undefined, 0, true, {}])(
    'rejects %p',
    (value) => {
      expect(checkIsTrailingPunctuationMode(value)).toBe(false);
    },
  );
});

describe('checkIsBooleanSaveDataKey', () => {
  it.each(['observeDOM', 'enableTtp', 'enableAllDoubleSlash', 'enableNoColon', 'useNewTab'])(
    'accepts %s',
    (key) => {
      expect(checkIsBooleanSaveDataKey(key)).toBe(true);
    },
  );

  it.each(['trailingPunctuationMode', '', 'unknown', null, undefined, 42])(
    'rejects %p',
    (value) => {
      expect(checkIsBooleanSaveDataKey(value)).toBe(false);
    },
  );
});

describe('parseSaveData', () => {
  it('returns a fresh default clone for null', () => {
    const result = parseSaveData(null);

    expect(result).toEqual(defaultSaveData);
    expect(result).not.toBe(defaultSaveData);
  });

  it('returns defaults for non-object', () => {
    expect(parseSaveData(undefined)).toEqual(defaultSaveData);
    expect(parseSaveData('string')).toEqual(defaultSaveData);
    expect(parseSaveData(42)).toEqual(defaultSaveData);
    expect(parseSaveData(true)).toEqual(defaultSaveData);
  });

  it('reads a fully-populated object as-is', () => {
    const source = {
      observeDOM: true,
      enableTtp: true,
      enableAllDoubleSlash: true,
      enableNoColon: true,
      useNewTab: false,
      trailingPunctuationMode: 'all',
    } satisfies Record<string, unknown>;

    expect(parseSaveData(source)).toEqual(source);
  });

  it('falls back to defaults for missing keys', () => {
    const result = parseSaveData({});

    expect(result).toEqual(defaultSaveData);
  });

  it('falls back to defaults for non-boolean values on boolean keys', () => {
    const result = parseSaveData({
      observeDOM: 'yes',
      enableTtp: 1,
      enableAllDoubleSlash: null,
      enableNoColon: undefined,
      useNewTab: {},
    });

    expect(result.observeDOM).toBe(defaultSaveData.observeDOM);
    expect(result.enableTtp).toBe(defaultSaveData.enableTtp);
    expect(result.enableAllDoubleSlash).toBe(defaultSaveData.enableAllDoubleSlash);
    expect(result.enableNoColon).toBe(defaultSaveData.enableNoColon);
    expect(result.useNewTab).toBe(defaultSaveData.useNewTab);
  });

  it('falls back to default trailingPunctuationMode for invalid values', () => {
    expect(parseSaveData({ trailingPunctuationMode: 'unknown' }).trailingPunctuationMode).toBe(
      defaultSaveData.trailingPunctuationMode,
    );
    expect(parseSaveData({ trailingPunctuationMode: null }).trailingPunctuationMode).toBe(
      defaultSaveData.trailingPunctuationMode,
    );
    expect(parseSaveData({ trailingPunctuationMode: 42 }).trailingPunctuationMode).toBe(
      defaultSaveData.trailingPunctuationMode,
    );
  });

  it('accepts each valid trailingPunctuationMode', () => {
    for (const mode of ['none', 'period', 'periodColon', 'periodColonQuestion', 'all'] as const) {
      expect(parseSaveData({ trailingPunctuationMode: mode }).trailingPunctuationMode).toBe(mode);
    }
  });
});
