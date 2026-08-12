const TELETALK_HOST = /(^|\.)teletalk\.com\.bd$/i;

function isTeletalk(url) {
  try {
    return TELETALK_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function updateBadge(tabId, url) {
  const text = isTeletalk(url) ? "🗲" : "";
  chrome.action.setBadgeText({ text, tabId }, () => void chrome.runtime.lastError);
  if (text) {
    chrome.action.setBadgeBackgroundColor(
      { color: [0, 0, 0, 0], tabId },
      () => void chrome.runtime.lastError,
    );
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    updateBadge(tabId, tab.url);
  });
});

// Only reacts to URL/load changes, so typing in a page doesn't churn the badge.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  updateBadge(tabId, changeInfo.url || tab.url);
});
