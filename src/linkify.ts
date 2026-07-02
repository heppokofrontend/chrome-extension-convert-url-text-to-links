import type { TrailingPunctuationMode } from './constants';
import { getTrailingPunctuationPattern } from './utils';

export const getTextNodes = (context?: Node) => {
  const xPathResult = document.evaluate(
    '//text()',
    context ?? document,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null,
  );
  const result: Node[] = [];
  let { snapshotLength } = xPathResult;

  while (snapshotLength--) {
    const item = xPathResult.snapshotItem(snapshotLength);

    if (item !== null) {
      result.unshift(item);
    }
  }

  return result;
};

const key = `@heppokofrontend<${performance.now().toString()}>`;

export const getRegExp = (() => {
  const common = `\\/\\/[\\w/:%#\\$&\\?\\(\\)~\\.=\\+\\-@]+`;
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
    enableTtp: boolean;
    enableAllDoubleSlash: boolean;
    enableNoColon: boolean;
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

export const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation();
};

export const checkIsSkippableTarget = (textNode: Text) => {
  const parent = textNode.parentElement;

  if (parent === null) {
    return true;
  }

  return (
    parent.closest(
      'a, button, input, textarea, summary, code, script, noscript, template, style, [contenteditable="true"], head',
    ) !== null
  );
};

export const convertToLink = ({
  textNode,
  enableTtp,
  enableAllDoubleSlash,
  enableNoColon,
  useNewTab,
  trailingPunctuationMode,
}: {
  textNode: Text;
  enableTtp: boolean;
  enableAllDoubleSlash: boolean;
  enableNoColon: boolean;
  useNewTab: boolean;
  trailingPunctuationMode: TrailingPunctuationMode;
}) => {
  const { regExp, regExpGlobal, regExpSplitPattern } = getRegExp({
    enableTtp,
    enableAllDoubleSlash,
    enableNoColon,
  });
  const textContent = textNode.textContent;

  if (textContent.trim() === '' || !regExp.test(textContent)) {
    return;
  }

  const marked = textContent.replace(regExpGlobal, `${key}$1`);
  const parts = marked.split(regExpSplitPattern).filter((s) => s !== '');
  const fragment = document.createDocumentFragment();

  for (const text of parts) {
    if (!text.startsWith(key)) {
      fragment.append(text);
      continue;
    }

    const a = document.createElement('a');
    let urlString = text.slice(key.length);
    let tail = '';
    const trailingPattern = getTrailingPunctuationPattern(trailingPunctuationMode);

    if (trailingPattern !== null) {
      const punctuationMatch = trailingPattern.exec(urlString);

      if (punctuationMatch !== null) {
        tail = punctuationMatch[0];
        urlString = urlString.slice(0, -tail.length);
      }
    }

    let url = urlString;

    if (enableTtp && url.startsWith('ttp')) {
      url = `h${url}`;
    }

    if (enableNoColon && !url.includes('://')) {
      url = url.replace('//', '://');
    }

    a.href = url;
    a.textContent = urlString;
    a.style.cssText = 'color: inherit !important;';
    a.addEventListener('click', stopPropagation);

    if (useNewTab) {
      a.target = '_blank';
    }

    fragment.append(a);

    if (tail !== '') {
      fragment.append(tail);
    }
  }

  textNode.replaceWith(fragment);
};

export const narrowDownToOnlyTopLevelNodeLayer = (elements: Node[]) =>
  elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
