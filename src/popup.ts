const defaultSaveData = {
  enableTtp: false,
  observeDOM: false,
  enableAllDoubleSlash: false,
  enableNoColon: false,
  useNewTab: true,
};

const STATE = {
  saveData: defaultSaveData,
};

const getMessage = (key: string) => chrome.i18n.getMessage(key) || key;
const isValidOptionType = (value: unknown): value is keyof SaveDataType => {
  if (typeof value !== 'string') {
    return false;
  }

  return value in defaultSaveData;
};

const checkboxes = document.querySelectorAll<HTMLInputElement>('[data-option-type]');
const save = (newSaveData: SaveDataType) => {
  const value = {
    ...STATE.saveData,
    ...newSaveData,
  };

  STATE.saveData = value;

  for (const checkbox of checkboxes) {
    if (isValidOptionType(checkbox.dataset.optionType)) {
      checkbox.checked = value[checkbox.dataset.optionType];
    }
  }

  chrome.storage.local.set({
    saveData: value,
  });
};

const setLanguage = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-i18n]');

  for (const elm of targets) {
    const { i18n } = elm.dataset;

    if (!i18n) {
      continue;
    }

    const textContent = getMessage(i18n);

    elm.textContent = textContent;
  }
};

const loadSaveData = async () => {
  const getValue = <T>(key: string, callback: (items: Record<string, T | undefined>) => void) =>
    new Promise<void>((resolve) => {
      chrome.storage.local.get(key, (items) => {
        callback(items);
        resolve();
      });
    });

  return Promise.all([
    getValue<typeof defaultSaveData>('saveData', ({ saveData }) => {
      for (const [key, value] of Object.entries<boolean>(saveData ?? defaultSaveData)) {
        const checkbox = document.querySelector<HTMLInputElement>(`[data-option-type=${key}]`);

        if (checkbox) {
          checkbox.checked = value;
        }
      }

      STATE.saveData = saveData ?? defaultSaveData;
    }),
  ]);
};

const addEvent = () => {
  const onchangeListener = (e: Event) => {
    if (!(e.target instanceof HTMLInputElement)) {
      return;
    }

    const { optionType } = e.target.dataset;

    if (isValidOptionType(optionType)) {
      save({
        [optionType]: e.target.checked,
      });

      switch (optionType) {
        case 'enableAllDoubleSlash':
          if (e.target.checked) {
            save({
              enableTtp: true,
              enableNoColon: true,
            });
          }

          break;

        case 'enableTtp':
        case 'enableNoColon':
          if (!e.target.checked) {
            save({
              enableAllDoubleSlash: false,
            });
          }
      }
    }
  };

  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', onchangeListener);
  }
};

setLanguage();
loadSaveData().then(() => {
  addEvent();
});

// CSS Transitionの有効化
setTimeout(() => {
  document.body.dataset.state = 'loaded';
}, 300);
