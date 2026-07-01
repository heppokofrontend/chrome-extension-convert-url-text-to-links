import { STORAGE_KEY_SAVE_DATA, defaultSaveData, type SaveData } from './constants';
import { checkIsBooleanSaveDataKey, checkIsTrailingPunctuationMode, getSaveData } from './utils';

let currentSaveData: SaveData = { ...defaultSaveData };
const checkboxes = document.querySelectorAll<HTMLInputElement>('input[data-option-type]');
const selects = document.querySelectorAll<HTMLSelectElement>('select[data-option-type]');

const syncFields = (saveData: SaveData) => {
  for (const checkbox of checkboxes) {
    const optionKey = checkbox.dataset['optionType'];

    if (checkIsBooleanSaveDataKey(optionKey)) {
      checkbox.checked = saveData[optionKey];
    }
  }

  for (const select of selects) {
    if (select.dataset['optionType'] === 'trailingPunctuationMode') {
      select.value = saveData.trailingPunctuationMode;
    }
  }
};

const save = (patch: Partial<SaveData>) => {
  currentSaveData = { ...currentSaveData, ...patch };

  syncFields(currentSaveData);
  void chrome.storage.local.set({ [STORAGE_KEY_SAVE_DATA]: currentSaveData });
};

const setLanguage = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-i18n]');

  for (const elm of targets) {
    const key = elm.dataset['i18n'];

    if (key === undefined || key === '') {
      continue;
    }

    const message = chrome.i18n.getMessage(key);

    elm.textContent = message === '' ? key : message;
  }
};

const onCheckboxChange = (target: HTMLInputElement) => {
  const optionKey = target.dataset['optionType'];

  if (!checkIsBooleanSaveDataKey(optionKey)) {
    return;
  }

  const nextValue = target.checked;

  save({ [optionKey]: nextValue });

  if (optionKey === 'enableAllDoubleSlash' && nextValue) {
    save({ enableTtp: true, enableNoColon: true });

    return;
  }

  if ((optionKey === 'enableTtp' || optionKey === 'enableNoColon') && !nextValue) {
    save({ enableAllDoubleSlash: false });
  }
};

const onSelectChange = (target: HTMLSelectElement) => {
  if (target.dataset['optionType'] !== 'trailingPunctuationMode') {
    return;
  }

  if (!checkIsTrailingPunctuationMode(target.value)) {
    return;
  }

  save({ trailingPunctuationMode: target.value });
};

const onChange = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    onCheckboxChange(event.target);

    return;
  }

  if (event.target instanceof HTMLSelectElement) {
    onSelectChange(event.target);
  }
};

const attachEvents = () => {
  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', onChange);
  }

  for (const select of selects) {
    select.addEventListener('change', onChange);
  }
};

void (async () => {
  currentSaveData = await getSaveData();

  syncFields(currentSaveData);
  setLanguage();
  attachEvents();
})();

// CSS Transition の有効化
setTimeout(() => {
  document.body.dataset['state'] = 'loaded';
}, 300);
