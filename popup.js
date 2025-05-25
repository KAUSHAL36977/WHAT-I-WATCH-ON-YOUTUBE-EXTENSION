document.addEventListener('DOMContentLoaded', function() {
    const grindModeToggle = document.getElementById('grindModeToggle');
    const statsBody = document.getElementById('statsBody');
    const exportStatsButton = document.getElementById('exportStats');

    // Load initial state
    chrome.storage.local.get(['grindModeEnabled', 'watchStats'], function(result) {
        grindModeToggle.checked = result.grindModeEnabled || false;
        updateStatsDisplay(result.watchStats || {});
    });

    // Toggle GrindMode
    grindModeToggle.addEventListener('change', function() {
        const isEnabled = grindModeToggle.checked;
        chrome.storage.local.set({ grindModeEnabled: isEnabled }, function() {
            // Notify content script about the change
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'grindModeChanged',
                        enabled: isEnabled
                    });
                }
            });
        });
    });

    // Update stats display
    function updateStatsDisplay(stats) {
        const categories = {
            work: { name: 'Work/Study', time: 0, videos: 0 },
            entertainment: { name: 'Entertainment', time: 0, videos: 0 }
        };

        // Aggregate stats by category
        Object.values(stats).forEach(entry => {
            const category = entry.category === 'work' ? 'work' : 'entertainment';
            categories[category].time += entry.duration || 0;
            categories[category].videos += 1;
        });

        // Update table
        statsBody.innerHTML = Object.values(categories).map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td>${formatTime(cat.time)}</td>
                <td>${cat.videos}</td>
            </tr>
        `).join('');
    }

    // Format time in minutes to hours and minutes
    function formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }

    // Export stats
    exportStatsButton.addEventListener('click', function() {
        chrome.storage.local.get(['watchStats'], function(result) {
            const stats = result.watchStats || {};
            const csv = convertToCSV(stats);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'youtube-stats.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // Convert stats to CSV
    function convertToCSV(stats) {
        const headers = ['Date', 'Video Title', 'Category', 'Duration (minutes)', 'Message'];
        const rows = [headers];

        Object.entries(stats).forEach(([timestamp, entry]) => {
            rows.push([
                new Date(parseInt(timestamp)).toLocaleString(),
                entry.title || 'Unknown',
                entry.category === 'work' ? 'Work/Study' : 'Entertainment',
                entry.duration || 0,
                entry.message || ''
            ]);
        });

        return rows.map(row => row.join(',')).join('\n');
    }

    // Listen for stats updates
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'statsUpdated') {
            updateStatsDisplay(request.stats);
        }
    });
});
