// Initialize extension state
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({
        grindMode: false,
        stats: {
            workStudy: 0,
            entertainment: 0,
            totalTime: 0
        },
        recentVideos: []
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'statsUpdated') {
        // Forward stats update to popup if it's open
        chrome.runtime.sendMessage(request);
    }
});

// Handle tab updates to check for YouTube videos
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tabId, { action: 'checkVideo' });
    }
}); 