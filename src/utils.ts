import {
  BOOLEAN_SAVE_DATA_KEYS,
  STORAGE_KEY_SAVE_DATA,
  TRAILING_PUNCTUATION_MODES,
  defaultSaveData,
  type BooleanSaveDataKey,
  type TrailingPunctuationMode,
} from './constants';

export const checkIsTrailingPunctuationMode = (value: unknown): value is TrailingPunctuationMode =>
  typeof value === 'string' && (TRAILING_PUNCTUATION_MODES as readonly string[]).includes(value);

export const checkIsBooleanSaveDataKey = (value: unknown): value is BooleanSaveDataKey =>
  typeof value === 'string' && (BOOLEAN_SAVE_DATA_KEYS as readonly string[]).includes(value);

// mode ごとに URL 末尾から剥がすべき文字集合を返す。
export const getTrailingPunctuationPattern = (mode: TrailingPunctuationMode) => {
  switch (mode) {
    case 'none':
      return null;
    case 'period':
      return /\.+$/;
    case 'periodColon':
      return /[.:]+$/;
    case 'periodColonQuestion':
      return /[.:?]+$/;
    case 'all':
      return /[.:?)]+$/;
  }
};

export const parseSaveData = (raw: unknown) => {
  if (typeof raw !== 'object' || raw === null) {
    return { ...defaultSaveData };
  }

  const source = raw as Record<string, unknown>;
  const readBool = (key: BooleanSaveDataKey) => {
    const value = source[key];

    return typeof value === 'boolean' ? value : defaultSaveData[key];
  };
  const rawMode = source['trailingPunctuationMode'];

  return {
    observeDOM: readBool('observeDOM'),
    enableTtp: readBool('enableTtp'),
    enableAllDoubleSlash: readBool('enableAllDoubleSlash'),
    enableNoColon: readBool('enableNoColon'),
    useNewTab: readBool('useNewTab'),
    trailingPunctuationMode: checkIsTrailingPunctuationMode(rawMode)
      ? rawMode
      : defaultSaveData.trailingPunctuationMode,
  };
};

export const getSaveData = async () => {
  const data = await chrome.storage.local.get(STORAGE_KEY_SAVE_DATA);
  const raw: unknown = (data as Record<string, unknown>)[STORAGE_KEY_SAVE_DATA];

  return parseSaveData(raw);
};
