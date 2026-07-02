import { getSaveData } from './utils';
import {
  checkIsSkippableTarget,
  convertToLink,
  getTextNodes,
  narrowDownToOnlyTopLevelNodeLayer,
} from './linkify';

void (async () => {
  const saveData = await getSaveData();
  const convert = (node: Node) => {
    if (node instanceof Text && !checkIsSkippableTarget(node)) {
      convertToLink({
        textNode: node,
        enableTtp: saveData.enableTtp,
        enableAllDoubleSlash: saveData.enableAllDoubleSlash,
        enableNoColon: saveData.enableNoColon,
        useNewTab: saveData.useNewTab,
        trailingPunctuationMode: saveData.trailingPunctuationMode,
      });
    }
  };

  for (const node of getTextNodes()) {
    convert(node);
  }

  if (!saveData.observeDOM) {
    return;
  }

  let debounceId: number | null = null;
  const pendingRoots = new Set<Node>();
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        pendingRoots.add(mutation.target);

        if (debounceId !== null) {
          clearTimeout(debounceId);
        }

        debounceId = window.setTimeout(() => {
          const filteredElements = narrowDownToOnlyTopLevelNodeLayer([...pendingRoots]);

          for (const root of filteredElements) {
            for (const node of getTextNodes(root)) {
              convert(node);
            }
          }

          pendingRoots.clear();
        }, 500);
      }

      if (mutation.type === 'characterData') {
        convert(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    attributes: false,
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
