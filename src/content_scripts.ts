const getTextNodes = (context?: Node) => {
  const xPathResult = document.evaluate(
    '//text()',
    context ?? document,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null,
  );
  const result = [];
  let { snapshotLength } = xPathResult;

  while (snapshotLength--) {
    result.unshift(xPathResult.snapshotItem(snapshotLength));
  }

  return result;
};

const key = `@heppokofrontend<${performance.now()}>`;
const getRegExp = (() => {
  // const regExp = /https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+$/;
  // const regExp = new RegExp(`(${protocol}${colon}${common})`);
  // const regExpGlobal = new RegExp(
  //   `(${protocol}${colon}${common})`,
  //   'g',
  // );
  // const regExpSplitPattern = new RegExp(
  //   `(${key}${protocol}${colon}${common})`,
  // );
  const common = `\\/\\/[\\w/:%#\\$&\\?\\(\\)~\\.=\\+\\-]+`;
  const allDoubleSlash = {
    regExp: new RegExp(`([a-zA-Z]+:?${common})`),
    regExpGlobal: new RegExp(`([a-zA-Z]+:?${common})`, 'g'),
    regExpSplitPattern: new RegExp(`(${key}[a-zA-Z]+:?${common})`),
  };
  const ttpAndNoColon = {
    regExp: new RegExp(`(h?ttps?:?${common})`),
    regExpGlobal: new RegExp(`(h?ttps?:?${common})`, 'g'),
    regExpSplitPattern: new RegExp(`(${key}h?ttps?:?${common})`),
  };
  const ttp = {
    regExp: new RegExp(`(h?ttps?:${common})`),
    regExpGlobal: new RegExp(`(h?ttps?:${common})`, 'g'),
    regExpSplitPattern: new RegExp(`(${key}h?ttps?:${common})`),
  };
  const colon = {
    regExp: new RegExp(`(https?:?${common})`),
    regExpGlobal: new RegExp(`(https?:?${common})`, 'g'),
    regExpSplitPattern: new RegExp(`(${key}https?:?${common})`),
  };
  const strict = {
    regExp: new RegExp(`(https?:${common})`),
    regExpGlobal: new RegExp(`(https?:${common})`, 'g'),
    regExpSplitPattern: new RegExp(`(${key}https?:${common})`),
  };

  return ({
    enableAllDoubleSlash,
    enableTtp,
    enableNoColon,
  }: {
    enableTtp: boolean | undefined;
    enableAllDoubleSlash: boolean | undefined;
    enableNoColon: boolean | undefined;
  }) => {
    if (enableAllDoubleSlash) {
      return allDoubleSlash;
    }

    if (enableTtp && enableNoColon) {
      return ttpAndNoColon;
    }

    if (enableTtp) {
      return ttp;
    }

    if (enableNoColon) {
      return colon;
    }

    return strict;
  };
})();

const stopPropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

const convertToLink = ({
  textNode,
  enableTtp,
  enableAllDoubleSlash,
  enableNoColon,
  useNewTab,
}: {
  textNode: Text;
  enableTtp: boolean | undefined;
  enableAllDoubleSlash: boolean | undefined;
  enableNoColon: boolean | undefined;
  useNewTab: boolean | undefined;
}) => {
  const { regExp, regExpGlobal, regExpSplitPattern } = getRegExp({
    enableTtp,
    enableAllDoubleSlash,
    enableNoColon,
  });

  if (!textNode.textContent?.trim() || !regExp.test(textNode.textContent)) {
    return;
  }

  const textContent = textNode.textContent.replace(regExpGlobal, `${key}$1`);
  const result = textContent.split(regExpSplitPattern).filter(Boolean);
  const fragment = document.createDocumentFragment();

  result.forEach((text) => {
    if (text.startsWith(key)) {
      const a = document.createElement('a');
      const urlString = text.replace(key, '');
      let url = urlString;

      if (enableTtp && url.startsWith('ttp')) {
        url = `h${url}`;
      }

      if (enableNoColon && !url.includes('://')) {
        url = url.replace('//', '://');
      }

      a.href = url;
      a.textContent = urlString;
      a.addEventListener('click', stopPropagation);

      if (useNewTab) {
        a.target = '_blank';
      }

      fragment.append(a);

      return;
    }

    fragment.append(text);
  });

  textNode.replaceWith(fragment);
};

const narrowDownToOnlyTopLevelNodeLayer = (elements: Node[]) => {
  const result = [];

  for (let i = 0; i < elements.length; i++) {
    const currentElement = elements[i];
    let isChild = false;

    for (let j = 0; j < elements.length; j++) {
      if (i !== j) {
        const otherElement = elements[j];

        if (otherElement.contains(currentElement)) {
          isChild = true;
          break;
        }
      }
    }

    if (!isChild) {
      result.push(currentElement);
    }
  }

  return result;
};

chrome.storage.local.get('saveData', (item) => {
  const saveData = item.saveData as SaveDataType;
  const convert = (textNode: Node) => {
    if (
      textNode instanceof Text &&
      !textNode.parentElement?.closest(
        'a, button, summary, code, script, noscript, template, style, [contenteditable="true"], head',
      )
    ) {
      convertToLink({
        textNode,
        enableTtp: saveData.enableTtp,
        enableAllDoubleSlash: saveData.enableAllDoubleSlash,
        enableNoColon: saveData.enableNoColon,
        useNewTab: saveData.useNewTab,
      });
    }
  };

  const textNodes = getTextNodes();

  textNodes.forEach((textNode) => {
    if (textNode) {
      convert(textNode);
    }
  });

  if (saveData.observeDOM === true) {
    let setTimeoutId = -1;
    const elementSet = new Set<Node>();
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          elementSet.add(mutation.target);
          // 大量のNodeの変更は間引きしてまとめて処理する
          clearTimeout(setTimeoutId);
          setTimeoutId = window.setTimeout(() => {
            const filteredElements = narrowDownToOnlyTopLevelNodeLayer([...elementSet]);

            filteredElements.forEach((root) => {
              const textNodes = getTextNodes(root);

              textNodes.forEach((textNode) => {
                if (textNode) {
                  convert(textNode);
                }
              });
            });

            elementSet.clear();
          }, 500);
        }

        if (mutation.type === 'characterData') {
          convert(mutation.target);
        }
      }
    });

    // MutationObserverを開始
    observer.observe(document.body, {
      attributes: false,
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
});
