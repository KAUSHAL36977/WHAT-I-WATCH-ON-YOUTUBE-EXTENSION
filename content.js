let grindModeEnabled = false;
let currentVideoId = null;
let videoStartTime = null;
let videoStats = {};

// Load initial state
chrome.storage.local.get(['grindModeEnabled'], function(result) {
    grindModeEnabled = result.grindModeEnabled || false;
});

// Listen for GrindMode toggle changes
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'grindModeChanged') {
        grindModeEnabled = request.enabled;
    }
});

// Create and inject the prompt modal
function createPromptModal() {
    const modal = document.createElement('div');
    modal.id = 'grindModeModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        text-align: center;
    `;

    content.innerHTML = `
        <h2>GrindMode YouTube Tracker</h2>
        <p>What's your purpose for watching this video?</p>
        <select id="watchPurpose" style="width: 100%; margin: 10px 0; padding: 8px;">
            <option value="">Select a purpose...</option>
            <option value="work">Work/Study Related</option>
            <option value="entertainment">Entertainment/Fun</option>
        </select>
        <div id="entertainmentPrompt" style="display: none; margin: 10px 0;">
            <p style="color: #ff4444; font-weight: bold;">
                How long do you want to stay poor? You're procrastinating again!
                Get back on track and focus on your goals!
            </p>
        </div>
        <div id="workPrompt" style="display: none; margin: 10px 0;">
            <p style="color: #4CAF50; font-weight: bold;">
                Keep on learning and growing! Keep the grind on and keep making money!
            </p>
        </div>
        <button id="confirmWatch" style="
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
        ">Continue Watching</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listeners
    const watchPurpose = document.getElementById('watchPurpose');
    const entertainmentPrompt = document.getElementById('entertainmentPrompt');
    const workPrompt = document.getElementById('workPrompt');
    const confirmButton = document.getElementById('confirmWatch');

    watchPurpose.addEventListener('change', function() {
        entertainmentPrompt.style.display = this.value === 'entertainment' ? 'block' : 'none';
        workPrompt.style.display = this.value === 'work' ? 'block' : 'none';
    });

    confirmButton.addEventListener('click', function() {
        if (watchPurpose.value) {
            const videoData = {
                category: watchPurpose.value,
                title: document.title.replace(' - YouTube', ''),
                timestamp: Date.now(),
                message: watchPurpose.value === 'work' ? 
                    'Keep on learning and growing! Keep the grind on!' :
                    'Entertainment time - remember your goals!'
            };
            
            chrome.storage.local.get(['watchStats'], function(result) {
                const stats = result.watchStats || {};
                stats[videoData.timestamp] = videoData;
                chrome.storage.local.set({ watchStats: stats });
                
                // Notify popup to update stats
                chrome.runtime.sendMessage({
                    action: 'statsUpdated',
                    stats: stats
                });
            });

            modal.remove();
            startTrackingVideo();
        }
    });
}

// Start tracking video
function startTrackingVideo() {
    const video = document.querySelector('video');
    if (video) {
        videoStartTime = Date.now();
        video.addEventListener('timeupdate', trackVideoProgress);
    }
}

// Track video progress
function trackVideoProgress() {
    if (!videoStartTime) return;
    
    const video = document.querySelector('video');
    if (!video) return;

    const currentTime = Math.floor(video.currentTime);
    const videoId = new URLSearchParams(window.location.search).get('v');

    if (videoId !== currentVideoId) {
        currentVideoId = videoId;
        videoStartTime = Date.now();
    }

    // Update stats every minute
    if (currentTime % 60 === 0) {
        chrome.storage.local.get(['watchStats'], function(result) {
            const stats = result.watchStats || {};
            const lastEntry = Object.values(stats).pop();
            if (lastEntry) {
                lastEntry.duration = (lastEntry.duration || 0) + 1;
                stats[lastEntry.timestamp] = lastEntry;
                chrome.storage.local.set({ watchStats: stats });
            }
        });
    }
}

// Check for video page and show prompt if needed
function checkForVideo() {
    if (!grindModeEnabled) return;
    
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId && videoId !== currentVideoId) {
        currentVideoId = videoId;
        if (!document.getElementById('grindModeModal')) {
            createPromptModal();
        }
    }
}

// Monitor URL changes for new videos
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkForVideo();
    }
}).observe(document, { subtree: true, childList: true });

// Initial check
checkForVideo();
