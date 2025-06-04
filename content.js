let grindModeEnabled = false;
let currentVideoId = null;
let watchStartTime = null;

// Initialize
chrome.storage.local.get(['grindMode'], function(result) {
    grindModeEnabled = result.grindMode || false;
});

// Listen for grind mode changes
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'grindModeChanged') {
        grindModeEnabled = request.enabled;
    }
});

// Create and inject modal HTML
function createModal() {
    const modal = document.createElement('div');
    modal.className = 'grind-mode-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>GrindMode Check</h2>
            <div id="question1" class="question">
                <p>Is this video:</p>
                <button class="modal-btn work-btn">Work/Study Related</button>
                <button class="modal-btn entertainment-btn">Entertainment/Fun</button>
            </div>
            <div id="question2" class="question" style="display: none;">
                <p id="question2Text"></p>
                <button class="modal-btn continue-btn">Continue</button>
                <button class="modal-btn cancel-btn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Show modal with questions
function showVideoPrompt(videoTitle) {
    if (!grindModeEnabled) return;

    const modal = createModal();
    const question1 = modal.querySelector('#question1');
    const question2 = modal.querySelector('#question2');
    const question2Text = modal.querySelector('#question2Text');
    const videoPlayer = document.querySelector('video');

    if (videoPlayer) {
        videoPlayer.pause();
    }

    // Handle work/study button
    modal.querySelector('.work-btn').addEventListener('click', function() {
        question1.style.display = 'none';
        question2.style.display = 'block';
        question2Text.innerHTML = `
            <strong>Keep grinding! 💪</strong><br>
            "Keep on learning and growing. The grind never stops! 
            Every minute spent learning is an investment in your future."
        `;
        
        modal.querySelector('.continue-btn').addEventListener('click', function() {
            recordVideo(videoTitle, 'work');
            modal.remove();
            if (videoPlayer) videoPlayer.play();
        });
    });

    // Handle entertainment button
    modal.querySelector('.entertainment-btn').addEventListener('click', function() {
        question1.style.display = 'none';
        question2.style.display = 'block';
        question2Text.innerHTML = `
            <strong>Think about it! 🤔</strong><br>
            "How long do you want to stay poor? 
            You're procrastinating again. Get back on track! 
            Every minute wasted is money lost."
        `;
        
        modal.querySelector('.continue-btn').addEventListener('click', function() {
            recordVideo(videoTitle, 'entertainment');
            modal.remove();
            if (videoPlayer) videoPlayer.play();
        });
    });

    // Handle cancel button
    modal.querySelector('.cancel-btn').addEventListener('click', function() {
        modal.remove();
        if (videoPlayer) {
            videoPlayer.pause();
            // Redirect to a productivity website or close the tab
            window.location.href = 'https://www.google.com/search?q=productivity+tips';
        }
    });
}

// Record video data
function recordVideo(title, type) {
    const videoData = {
        title: title,
        type: type,
        timestamp: new Date().toISOString(),
        duration: 0 // Will be updated when video ends
    };

    chrome.storage.local.get(['recentVideos', 'stats'], function(result) {
        const recentVideos = result.recentVideos || [];
        const stats = result.stats || { workStudy: 0, entertainment: 0, totalTime: 0 };

        // Update stats
        if (type === 'work') {
            stats.workStudy++;
        } else {
            stats.entertainment++;
        }

        // Add to recent videos
        recentVideos.unshift(videoData);
        if (recentVideos.length > 50) recentVideos.pop();

        // Save updated data
        chrome.storage.local.set({
            recentVideos: recentVideos,
            stats: stats
        }, function() {
            // Notify popup of update
            chrome.runtime.sendMessage({
                action: 'statsUpdated',
                stats: stats,
                recentVideos: recentVideos
            });
        });
    });

    // Start tracking watch time
    watchStartTime = Date.now();
    currentVideoId = title;
}

// Track video watch time
function updateWatchTime() {
    if (watchStartTime && currentVideoId) {
        const watchDuration = Math.floor((Date.now() - watchStartTime) / 60000); // Convert to minutes
        
        chrome.storage.local.get(['stats'], function(result) {
            const stats = result.stats || { workStudy: 0, entertainment: 0, totalTime: 0 };
            stats.totalTime += watchDuration;
            
            chrome.storage.local.set({ stats: stats }, function() {
                chrome.runtime.sendMessage({
                    action: 'statsUpdated',
                    stats: stats
                });
            });
        });

        watchStartTime = null;
        currentVideoId = null;
    }
}

// Monitor YouTube navigation
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('youtube.com/watch')) {
            const videoTitle = document.querySelector('h1.title')?.textContent;
            if (videoTitle) {
                showVideoPrompt(videoTitle);
            }
        }
    }
}).observe(document, { subtree: true, childList: true });

// Handle video end
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        updateWatchTime();
    }
});

// Add styles for the modal
const style = document.createElement('style');
style.textContent = `
    .grind-mode-modal {
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
    }

    .modal-content {
        background: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 400px;
        width: 90%;
        text-align: center;
    }

    .question {
        margin: 20px 0;
    }

    .modal-btn {
        display: block;
        width: 100%;
        margin: 10px 0;
        padding: 12px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        transition: background-color 0.3s;
    }

    .work-btn {
        background-color: #27ae60;
        color: white;
    }

    .entertainment-btn {
        background-color: #e74c3c;
        color: white;
    }

    .continue-btn {
        background-color: #3498db;
        color: white;
    }

    .cancel-btn {
        background-color: #95a5a6;
        color: white;
    }

    .modal-btn:hover {
        opacity: 0.9;
    }
`;
document.head.appendChild(style); 