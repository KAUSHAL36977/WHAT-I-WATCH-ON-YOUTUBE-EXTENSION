document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleMode');
    const workStudyCount = document.getElementById('workStudyCount');
    const entertainmentCount = document.getElementById('entertainmentCount');
    const totalWatchTime = document.getElementById('totalWatchTime');
    const videoList = document.getElementById('videoList');

    // Load initial state
    chrome.storage.local.get(['grindMode', 'stats', 'recentVideos'], function(result) {
        updateToggleButton(result.grindMode || false);
        updateStats(result.stats || { workStudy: 0, entertainment: 0, totalTime: 0 });
        updateVideoList(result.recentVideos || []);
    });

    // Toggle Grind Mode
    toggleBtn.addEventListener('click', function() {
        chrome.storage.local.get(['grindMode'], function(result) {
            const newMode = !result.grindMode;
            chrome.storage.local.set({ grindMode: newMode }, function() {
                updateToggleButton(newMode);
                // Notify content script about mode change
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'grindModeChanged', enabled: newMode });
                    }
                });
            });
        });
    });

    function updateToggleButton(enabled) {
        toggleBtn.textContent = `Grind Mode: ${enabled ? 'ON' : 'OFF'}`;
        toggleBtn.classList.toggle('active', enabled);
    }

    function updateStats(stats) {
        workStudyCount.textContent = stats.workStudy;
        entertainmentCount.textContent = stats.entertainment;
        totalWatchTime.textContent = `${stats.totalTime} minutes`;
    }

    function updateVideoList(videos) {
        videoList.innerHTML = '';
        videos.slice(0, 10).forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'video-title';
            titleSpan.textContent = video.title;
            
            const typeSpan = document.createElement('span');
            typeSpan.className = `video-type ${video.type}`;
            typeSpan.textContent = video.type === 'work' ? 'Work/Study' : 'Entertainment';
            
            videoItem.appendChild(titleSpan);
            videoItem.appendChild(typeSpan);
            videoList.appendChild(videoItem);
        });
    }

    // Listen for stats updates
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'statsUpdated') {
            updateStats(request.stats);
            updateVideoList(request.recentVideos);
        }
    });
}); 