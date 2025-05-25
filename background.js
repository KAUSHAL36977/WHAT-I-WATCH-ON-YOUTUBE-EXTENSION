// Initialize extension state
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({
        grindModeEnabled: false,
        watchStats: {}
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'statsUpdated') {
        // Update badge with total videos watched
        const totalVideos = Object.keys(request.stats).length;
        chrome.action.setBadgeText({
            text: totalVideos.toString(),
            tabId: sender.tab.id
        });
        chrome.action.setBadgeBackgroundColor({
            color: '#2196F3',
            tabId: sender.tab.id
        });
    } else if (request.type === "getGrindMode") {
        chrome.storage.local.get("grindMode", (data) => {
            sendResponse({ grindMode: data.grindMode });
        });
        return true;
    } else if (request.type === "setGrindMode") {
        chrome.storage.local.set({ grindMode: request.value });
    } else if (request.type === "addHistory") {
        chrome.storage.local.get("history", (data) => {
            const history = data.history || [];
            history.push(request.entry);
            chrome.storage.local.set({ history });
        });
    } else if (request.type === "getHistory") {
        chrome.storage.local.get("history", (data) => {
            sendResponse({ history: data.history || [] });
        });
        return true;
    }
});

// Set up daily stats reset (optional)
chrome.alarms.create('resetDailyStats', {
    periodInMinutes: 24 * 60 // 24 hours
});

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'resetDailyStats') {
        // You can implement daily stats reset logic here if needed
        // For now, we'll keep the stats persistent
    }
});
