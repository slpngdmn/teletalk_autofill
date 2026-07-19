// Function to check the URL and set the badge
function updateBadge(tabId, url) {
    if (url && url.includes("teletalk.com.bd")) {
        // Set the text to a thunder icon
        chrome.action.setBadgeText({ text: "🗲", tabId: tabId });
        // Set the background color to a nice orange/warning color
        chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0], tabId: tabId });
    } else {
        // Clear the badge if you are on any other website (like Facebook, Google)
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    }
}

// 1. Listen for when you switch between tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        updateBadge(activeInfo.tabId, tab.url);
    });
});

// 2. Listen for when a page loads or changes its URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url) {
        updateBadge(tabId, tab.url);
    }
});