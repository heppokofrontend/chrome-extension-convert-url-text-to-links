const injectIntoExistingTabs = async () => {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });

  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_scripts.js'],
      });
    } catch {
      // Chrome Web Store やその他の注入禁止ページは失敗するので無視する。
    }
  }
};
void injectIntoExistingTabs();
