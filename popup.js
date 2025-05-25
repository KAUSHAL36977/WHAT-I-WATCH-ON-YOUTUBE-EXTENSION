// Initialize variables
let grindModeEnabled = false;
let watchStats = {};

// Motivational messages
const motivationalMessages = [
    "Stay focused on your goals!",
    "Every productive minute counts!",
    "You're building better habits!",
    "Keep up the great work!",
    "Your future self thanks you!",
    "Stay in the zone!",
    "You're making progress!",
    "Focus on what matters!",
    "Time is your most valuable asset!",
    "Keep grinding! 💪"
];

// Helper function to check if URL is YouTube
function isYouTubeUrl(url) {
    return url && url.includes('youtube.com');
}

// Helper function to inject content script if needed
function injectContentScript(tabId, callback) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
    }, (results) => {
        if (chrome.runtime.lastError) {
            console.error('Error injecting content script:', chrome.runtime.lastError);
            if (callback) callback({ error: chrome.runtime.lastError.message });
        } else {
            console.log('Content script injected successfully');
            if (callback) callback({ success: true });
        }
    });
}

// Helper function to send message to content script with retry logic
function sendMessageToContentScript(tab, message, callback, retryCount = 0) {
    if (!isYouTubeUrl(tab.url)) {
        console.log('Not a YouTube page');
        if (callback) callback({ error: 'Not a YouTube page' });
        return;
    }

    // Maximum number of retries
    const MAX_RETRIES = 3;
    // Delay between retries in milliseconds
    const RETRY_DELAY = 500;

    function trySendMessage() {
        chrome.tabs.sendMessage(tab.id, message, function(response) {
            if (chrome.runtime.lastError) {
                console.log(`Attempt ${retryCount + 1} failed:`, chrome.runtime.lastError.message);
                
                if (retryCount < MAX_RETRIES) {
                    // If content script isn't loaded, try to inject it
                    if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                        console.log('Attempting to inject content script...');
                        injectContentScript(tab.id, function(injectResult) {
                            if (injectResult.error) {
                                if (callback) callback({ error: injectResult.error });
                            } else {
                                // Wait a bit for the script to initialize
                                setTimeout(() => {
                                    sendMessageToContentScript(tab, message, callback, retryCount + 1);
                                }, RETRY_DELAY);
                            }
                        });
                    } else {
                        // For other errors, retry after delay
                        setTimeout(() => {
                            sendMessageToContentScript(tab, message, callback, retryCount + 1);
                        }, RETRY_DELAY);
                    }
                } else {
                    console.error('Max retries reached. Could not establish connection.');
                    if (callback) callback({ 
                        error: 'Could not establish connection after multiple attempts. Please refresh the page and try again.' 
                    });
                }
            } else {
                console.log('Message sent successfully:', response);
                if (callback) callback(response);
            }
        });
    }

    trySendMessage();
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        grindModeToggle: document.getElementById('grindModeToggle'),
        statsBody: document.getElementById('statsBody'),
        exportStatsButton: document.getElementById('exportStats'),
        clearStatsButton: document.getElementById('clearStats'),
        videosWatchedElement: document.getElementById('videosWatched'),
        productiveTimeElement: document.getElementById('productiveTime'),
        entertainmentTimeElement: document.getElementById('entertainmentTime'),
        focusScoreElement: document.getElementById('focusScore'),
        motivationalMessageElement: document.getElementById('motivationalMessage'),
        emptyState: document.getElementById('emptyState'),
        statsTable: document.getElementById('statsTable')
    };

    // Load initial state
    chrome.storage.local.get(['grindModeEnabled', 'watchStats'], function(result) {
        grindModeEnabled = result.grindModeEnabled || false;
        watchStats = result.watchStats || {};
        
        // Update UI
        if (elements.grindModeToggle) {
            elements.grindModeToggle.checked = grindModeEnabled;
        }
        updateStats();
        updateMotivationalMessage();
    });

    // Toggle GrindMode
    if (elements.grindModeToggle) {
        elements.grindModeToggle.addEventListener('change', function() {
            const newState = this.checked;
            
            // Save state immediately for UI responsiveness
            chrome.storage.local.set({ grindModeEnabled: newState });
            grindModeEnabled = newState;
            
            // Notify content script
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    sendMessageToContentScript(tabs[0], {
                        action: 'grindModeChanged',
                        enabled: newState
                    }, function(response) {
                        if (response && response.error) {
                            // If there's an error, revert the toggle
                            if (response.error.includes('Could not establish connection')) {
                                alert('Please refresh the YouTube page and try again.');
                            } else if (response.error === 'Not a YouTube page') {
                                alert('GrindMode only works on YouTube pages.');
                            }
                            // Revert the toggle and state
                            elements.grindModeToggle.checked = !newState;
                            grindModeEnabled = !newState;
                            chrome.storage.local.set({ grindModeEnabled: !newState });
                        }
                    });
                }
            });
        });
    }

    // Export button click handler
    if (elements.exportStatsButton) {
        elements.exportStatsButton.addEventListener('click', function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    sendMessageToContentScript(tabs[0], { 
                        action: 'exportStats' 
                    }, function(response) {
                        if (response && response.error) {
                            if (response.error === 'Not a YouTube page') {
                                // Export stats even if not on YouTube
                                exportStatsToCSV();
                            }
                        }
                    });
                }
            });
        });
    }

    // Clear stats button click handler
    if (elements.clearStatsButton) {
        elements.clearStatsButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all statistics? This action cannot be undone.')) {
                chrome.storage.local.set({ watchStats: {} }, function() {
                    watchStats = {};
                    updateStats();
                    updateMotivationalMessage();
                });
            }
        });
    }

    // Export stats to CSV
    function exportStatsToCSV() {
        const headers = ['Date', 'Video Title', 'Category', 'Duration', 'Message', 'URL'];
        const rows = [headers];

        Object.entries(watchStats).forEach(([timestamp, entry]) => {
            const date = new Date(parseInt(timestamp));
            rows.push([
                date.toLocaleString(),
                `"${(entry.title || 'Unknown').replace(/"/g, '""')}"`,
                entry.category === 'work' ? 'Work/Study' : 'Entertainment',
                entry.duration || 0,
                `"${(entry.message || '').replace(/"/g, '""')}"`,
                entry.url || ''
            ]);
        });

        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `grindmode_stats_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Update stats display
    function updateStats() {
        const today = new Date().toDateString();
        let todayStats = {
            videosWatched: 0,
            productiveTime: 0,
            entertainmentTime: 0
        };

        // Calculate today's stats
        Object.values(watchStats).forEach(entry => {
            const entryDate = new Date(entry.timestamp).toDateString();
            if (entryDate === today) {
                todayStats.videosWatched++;
                
                if (entry.category === 'work') {
                    todayStats.productiveTime += entry.duration || 0;
                } else {
                    todayStats.entertainmentTime += entry.duration || 0;
                }
            }
        });

        // Calculate focus score
        const totalTime = todayStats.productiveTime + todayStats.entertainmentTime;
        const focusScore = totalTime > 0 
            ? Math.round((todayStats.productiveTime / totalTime) * 100) 
            : 0;

        // Update UI elements if they exist
        if (elements.videosWatchedElement) {
            elements.videosWatchedElement.textContent = todayStats.videosWatched;
        }
        if (elements.productiveTimeElement) {
            elements.productiveTimeElement.textContent = formatTime(todayStats.productiveTime);
        }
        if (elements.entertainmentTimeElement) {
            elements.entertainmentTimeElement.textContent = formatTime(todayStats.entertainmentTime);
        }
        if (elements.focusScoreElement) {
            elements.focusScoreElement.textContent = `${focusScore}%`;
            // Update focus score color
            if (focusScore >= 80) {
                elements.focusScoreElement.style.color = '#4CAF50';
            } else if (focusScore >= 50) {
                elements.focusScoreElement.style.color = '#FFA000';
            } else {
                elements.focusScoreElement.style.color = '#f44336';
            }
        }

        // Show/hide empty state
        if (elements.emptyState) {
            elements.emptyState.style.display = todayStats.videosWatched === 0 ? 'block' : 'none';
        }
        if (elements.statsTable) {
            elements.statsTable.style.display = todayStats.videosWatched === 0 ? 'none' : 'table';
        }

        // Update stats table
        if (elements.statsBody) {
            elements.statsBody.innerHTML = '';
            Object.entries(watchStats)
                .sort((a, b) => b[1].timestamp - a[1].timestamp)
                .forEach(([timestamp, entry]) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(parseInt(timestamp)).toLocaleTimeString()}</td>
                        <td>${entry.title || 'Unknown'}</td>
                        <td>${entry.category === 'work' ? 'Work/Study' : 'Entertainment'}</td>
                        <td>${formatTime(entry.duration || 0)}</td>
                    `;
                    elements.statsBody.appendChild(row);
                });
        }
    }

    // Format time in minutes
    function formatTime(minutes) {
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    // Update motivational message
    function updateMotivationalMessage() {
        if (elements.motivationalMessageElement) {
            const randomIndex = Math.floor(Math.random() * motivationalMessages.length);
            elements.motivationalMessageElement.textContent = motivationalMessages[randomIndex];
        }
    }

    // Listen for stats updates from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'statsUpdated') {
            watchStats = request.stats;
            updateStats();
        }
    });
});
