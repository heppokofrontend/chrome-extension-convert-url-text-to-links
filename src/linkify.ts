import type { TrailingPunctuationMode } from './constants';
import { getTrailingPunctuationPattern } from './utils';

export const getTextNodes = (context?: Node) => {
  const xPathResult = document.evaluate(
    './/text()',
    context ?? document.body,
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

export const getRegExp = (() => {
  const common = `\\/\\/[\\w/:%#\\$&\\?\\(\\)~\\.=\\+\\-@]+`;
  const allDoubleSlash = {
    regExp: new RegExp(`([a-zA-Z]+:?${common})`),
    regExpGlobal: new RegExp(`([a-zA-Z]+:?${common})`, 'g'),
  };
  const ttpAndNoColon = {
    regExp: new RegExp(`(h?ttps?:?${common})`),
    regExpGlobal: new RegExp(`(h?ttps?:?${common})`, 'g'),
  };
  const ttp = {
    regExp: new RegExp(`(h?ttps?:${common})`),
    regExpGlobal: new RegExp(`(h?ttps?:${common})`, 'g'),
  };
  const colon = {
    regExp: new RegExp(`(https?:?${common})`),
    regExpGlobal: new RegExp(`(https?:?${common})`, 'g'),
  };
  const strict = {
    regExp: new RegExp(`(https?:${common})`),
    regExpGlobal: new RegExp(`(https?:${common})`, 'g'),
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

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation();
};

export const checkIsSkippableTarget = (textNode: Text) => {
  const parent = textNode.parentElement;

  if (parent === null) {
    return true;
  }

  return (
    parent.closest(
      'a, button, input, textarea, summary, code, script, noscript, template, style, [contenteditable="true"]',
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
  const { regExp, regExpGlobal } = getRegExp({
    enableTtp,
    enableAllDoubleSlash,
    enableNoColon,
  });
  const textContent = textNode.textContent;

  if (textContent.trim() === '' || !regExp.test(textContent)) {
    return;
  }

  const parts = textContent.split(regExpGlobal);
  const trailingPattern = getTrailingPunctuationPattern(trailingPunctuationMode);
  const fragment = document.createDocumentFragment();

  for (const [i, part] of parts.entries()) {
    if (part === '') {
      continue;
    }

    if (i % 2 === 0) {
      fragment.append(part);
      continue;
    }

    let urlString = part;
    let tail = '';

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

    if (!url.includes('://')) {
      url = url.replace('//', '://');
    }

    const a = document.createElement('a');

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
