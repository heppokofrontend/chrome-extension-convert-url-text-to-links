export const STORAGE_KEY_SAVE_DATA = 'saveData';

export const INJECTED_MARKER_KEY = '__heppokofrontend.convert-url-text-to-links.injected__';

export const TRAILING_PUNCTUATION_MODES = [
  'none',
  'period',
  'periodColon',
  'periodColonQuestion',
  'all',
] as const;
export type TrailingPunctuationMode = (typeof TRAILING_PUNCTUATION_MODES)[number];

export type SaveData = {
  observeDOM: boolean;
  enableTtp: boolean;
  enableAllDoubleSlash: boolean;
  enableNoColon: boolean;
  useNewTab: boolean;
  trailingPunctuationMode: TrailingPunctuationMode;
};

export type BooleanSaveDataKey = Exclude<keyof SaveData, 'trailingPunctuationMode'>;

export const BOOLEAN_SAVE_DATA_KEYS = [
  'observeDOM',
  'enableTtp',
  'enableAllDoubleSlash',
  'enableNoColon',
  'useNewTab',
] as const satisfies readonly BooleanSaveDataKey[];

export const defaultSaveData: SaveData = {
  observeDOM: false,
  enableTtp: false,
  enableAllDoubleSlash: false,
  enableNoColon: false,
  useNewTab: true,
  trailingPunctuationMode: 'periodColonQuestion',
};
