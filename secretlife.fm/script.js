// Global variables to prevent hoisting issues
let statusTimeout;
let listenerCountUpdateInterval;
let stateCheckInterval;

document.addEventListener('DOMContentLoaded', () => {
    // Core elements
    const playButton = document.getElementById('play-button');
    const loadingAnimation = document.getElementById('loading-animation');
    const stopButton = document.getElementById('stop-button');
    const audioPlayer = document.getElementById('audio-player');
    const volumeControl = document.getElementById('volume-control');
    const volumeSlider = document.getElementById('volume-slider');
    const statusIndicator = document.getElementById('status-indicator');
    const listenerCountElement = document.getElementById('listener-count');
    
    // Load saved volume preference if available
    if (localStorage.getItem('secretlife_volume')) {
        const savedVolume = parseFloat(localStorage.getItem('secretlife_volume'));
        audioPlayer.volume = savedVolume;
        volumeSlider.value = savedVolume;
    }
    
    // Audio paths - using the same paths that worked in the test HTML file
    const mainAudioPath = 'secretlifemedia/SofaEditC.mp3';
    const staticAudioPath = 'secretlifestatic/secretlife_static.mp3';
    
    // Log the paths for debugging
    console.log('Main audio path:', mainAudioPath);
    console.log('Static audio path:', staticAudioPath);
    
    // Initial setup - this will be changed based on time
    let currentAudioPath = staticAudioPath;
    
    // Add error handling for audio loading
    audioPlayer.addEventListener('error', function(e) {
        console.error('Audio error event:', e);
        if (audioPlayer.error) {
            console.error('Audio error code:', audioPlayer.error.code);
            console.error('Audio error message:', audioPlayer.error.message);
        }
        console.error('Current audio src:', audioPlayer.src);
    });
    
    // Add a listener to confirm when audio can play
    audioPlayer.addEventListener('canplaythrough', function() {
        console.log('Audio is ready to play through without buffering:', audioPlayer.src);
    });
    
    // Audio loading error counter for retry logic
    let audioLoadAttempts = 0;
    const MAX_LOAD_ATTEMPTS = 3;
    
    // Add error logging for debugging
    console.log('secretlife.fm - Script initialized');
    console.log('Current time (local):', new Date().toString());
    
    // Helper function to get Los Angeles (PST/PDT) time components
    function getPacificTimeComponents() {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        
        const timeString = formatter.format(new Date());
        const [hourStr, minuteStr, secondStr] = timeString.split(/[:\s]/).filter(part => part.match(/^\d+$/));
        
        return {
            hour: parseInt(hourStr, 10),
            minute: parseInt(minuteStr, 10),
            second: parseInt(secondStr || '0', 10)
        };
    }
    
    // Function to check if current time is after 2 PM PST/PDT
    function isAfter2PMPST() {
        const { hour } = getPacificTimeComponents();
        return hour >= 14 && hour < 17; // Between 2 PM and 5 PM
    }
    
    // Function to check if current time is before 1:59 PM PST/PDT
    function isBefore159PMPST() {
        const { hour, minute } = getPacificTimeComponents();
        return hour < 14 || (hour === 13 && minute < 59);
    }
    
    // Function to check if current time is after 5 PM PST/PDT
    function isAfter5PMPST() {
        const { hour } = getPacificTimeComponents();
        return hour >= 17; // 5 PM = 17:00
    }
    
    // Get server time to synchronize playback across all users
    function getServerTimeAndSync() {
        // Use local time instead of server time to avoid errors with PHP
        // This simplifies the code and avoids errors when running with Python's HTTP server
        console.log('Using local time for synchronization');
        syncAudioPlayback(new Date());
        
        // The original server time code is removed to avoid errors
        // If PHP support is added later, this function can be enhanced again
    }
    
    // Synchronize audio playback based on server time
    function syncAudioPlayback(serverTime) {
        if (!isAfter2PMPST() || isAfter5PMPST()) {
            return; // Only sync during main content period
        }
        
        // Format the server time to Pacific timezone
        const pacificFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        
        const timeString = pacificFormatter.format(serverTime);
        const [hourStr, minuteStr, secondStr] = timeString.split(/[:\s]/).filter(part => part.match(/^\d+$/));
        const pstHour = parseInt(hourStr, 10);
        const pstMinute = parseInt(minuteStr, 10);
        const pstSecond = parseInt(secondStr || '0', 10);
        
        // Calculate seconds since 2 PM PST/PDT
        const secondsSince2PM = (pstHour - 14) * 3600 + pstMinute * 60 + pstSecond;
        
        // Only adjust if playing the main audio
        if (audioPlayer.src.indexOf(mainAudioPath) !== -1) {
            console.log(`Syncing playback to ${secondsSince2PM} seconds since 2 PM`);
            
            // Pause, set time, then play if it was playing
            const wasPlaying = !audioPlayer.paused;
            audioPlayer.pause();
            
            // Get audio duration to handle looping correctly
            const audioDuration = audioPlayer.duration || 10800; // Default to 3 hours if duration unknown
            
            // Calculate position with looping support
            const loopedPosition = secondsSince2PM % audioDuration;
            
            // Set the time with loop awareness
            audioPlayer.currentTime = loopedPosition;
            
            if (wasPlaying) {
                audioPlayer.play().catch(error => {
                    console.error('Error playing synchronized audio:', error);
                    showStatus('Playback error. Try again.');
                });
            }
        }
    }
    
    // Function to update listener count
    function updateListenerCount() {
        try {
            fetch('update-listeners.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: audioPlayer.paused ? 'leave' : 'join',
                    sessionId: getOrCreateSessionId()
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.count) {
                    const listeners = parseInt(data.count);
                    listenerCountElement.textContent = `${listeners} ${listeners === 1 ? 'listener' : 'listeners'}`;
                }
            })
            .catch(error => {
                console.warn('Could not update listener count:', error);
            });
        } catch (error) {
            console.error('Error in updateListenerCount:', error);
        }
    }
    
    // Create or get session ID for listener tracking
    function getOrCreateSessionId() {
        let sessionId = localStorage.getItem('secretlife_session_id');
        if (!sessionId) {
            sessionId = 'user_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('secretlife_session_id', sessionId);
        }
        return sessionId;
    }
    
    // Setup listener count ping interval (only when active)
    function setupListenerCountInterval() {
        clearInterval(listenerCountUpdateInterval);
        if (!audioPlayer.paused) {
            updateListenerCount(); // Update immediately when starting
            listenerCountUpdateInterval = setInterval(updateListenerCount, 30000); // Update every 30 seconds
        }
    }
    
    // Simple check for time-based audio selection and state changes
    function checkTimeState() {
        // Simple time check: main audio from 2-5pm, static audio otherwise
        const inMainAudioWindow = isAfter2PMPST() && !isAfter5PMPST(); // 2-5pm window
        
        // Check current state vs what it should be
        const currentStateIsMainAudio = audioPlayer.src.includes(mainAudioPath);
        const needsStateChange = currentStateIsMainAudio !== inMainAudioWindow;
        
        console.log(`Time check - In 2-5PM window: ${inMainAudioWindow}, Current audio is main: ${currentStateIsMainAudio}, Needs change: ${needsStateChange}`);
        
        // If we need to change state
        if (needsStateChange) {
            console.log('Audio source needs to change based on time');
            
            // Store current playing state before changing anything
            const wasPlaying = !audioPlayer.paused;
            
            // Update the audio source based on time window
            if (inMainAudioWindow) {
                // 2-5PM: Use main audio
                if (!audioPlayer.src.includes(mainAudioPath)) {
                    console.log('Switching to main audio (2-5PM window)');
                    audioPlayer.src = mainAudioPath;
                    audioPlayer.load();
                    document.body.classList.add('with-background');
                    
                    // If it was playing before, sync and continue playing
                    if (wasPlaying) {
                        getServerTimeAndSync();
                    }
                }
            } else {
                // Outside 2-5PM: Use static audio
                if (!audioPlayer.src.includes(staticAudioPath)) {
                    console.log('Switching to static audio (outside 2-5PM window)');
                    audioPlayer.src = staticAudioPath;
                    audioPlayer.load();
                    document.body.classList.remove('with-background');
                    
                    // If it was playing before, continue playing static audio
                    if (wasPlaying) {
                        audioPlayer.play().catch(error => {
                            console.error('Error playing static audio:', error);
                        });
                    }
                }
            }
            
            // Update UI to reflect new state
            updateUI();
        }
    }
    
    // Update UI function with enhanced state management
    function updateUI() {
        const wasPlaying = !audioPlayer.paused;
        const currentTime = audioPlayer.currentTime;
        const isAfter2PM = isAfter2PMPST();
        const isBefore159PM = isBefore159PMPST();
        const isAfter5PM = isAfter5PMPST();
        
        console.log('Time check: After 2 PM: ' + isAfter2PM + ', Before 1:59 PM: ' + isBefore159PM + ', After 5 PM: ' + isAfter5PM);
        
        // Apply background only during 2-5 PM period
        if (isAfter2PM && !isAfter5PM) {
            document.body.classList.add('with-background');
            
            // Check if we need to switch audio source for main audio
            if (audioPlayer.src.indexOf(mainAudioPath) === -1) {
                // Directly change audio source instead of fading
                currentAudioPath = mainAudioPath;
                audioPlayer.src = mainAudioPath;
                audioPlayer.loop = true;
                audioPlayer.load();
                
                if (wasPlaying) {
                    audioPlayer.currentTime = currentTime;
                    audioPlayer.play().catch(function(error) {
                        console.error('Error playing main audio:', error);
                        playButton.classList.remove('hidden');
                        stopButton.classList.add('hidden');
                        showStatus('Playback error. Try again.');
                    });
                    getServerTimeAndSync(); // Sync with other listeners
                }
                
                showStatus('Playing Main Audio');
            }
        } else {
            document.body.classList.remove('with-background');
            
            // Check if we need to switch audio source for intermission
            if (audioPlayer.src.indexOf(staticAudioPath) === -1) {
                // Directly change audio source instead of fading
                currentAudioPath = staticAudioPath;
                audioPlayer.src = staticAudioPath;
                audioPlayer.loop = true;
                audioPlayer.load();
                
                if (wasPlaying) {
                    audioPlayer.currentTime = 0; // Start from beginning
                    audioPlayer.play().catch(function(error) {
                        console.error('Error playing intermission audio:', error);
                        playButton.classList.remove('hidden');
                        stopButton.classList.add('hidden');
                        showStatus('Playback error. Try again.');
                    });
                }
                
                showStatus('Playing Intermission');
            }
        }
        
        // Show play button unless the audio is already playing with enhanced visual feedback
        if (audioPlayer.paused) {
            playButton.classList.remove('hidden');
            stopButton.classList.add('hidden');
            playButton.classList.add('pulse'); // Make play button pulse when ready to play
            stopButton.classList.remove('pulse');
            // Show a subtle ready state indicator
            if (!statusIndicator.classList.contains('visible')) {
                showStatus('Ready to play', true);
            }
        } else {
            playButton.classList.add('hidden');
            stopButton.classList.remove('hidden');
            playButton.classList.remove('pulse');
            stopButton.classList.add('pulse'); // Make stop button pulse during playback
            // Update the status indicator if not already showing a message
            if (!statusIndicator.classList.contains('visible')) {
                if (audioPlayer.src.indexOf(mainAudioPath) !== -1) {
                    showStatus('Playing Main Audio', true);
                } else {
                    showStatus('Playing Intermission', true);
                }
            }
        }
    }
    
    // Initial UI update
    updateUI();
    
    // Setup time state check interval - checks every 30 seconds for state changes
    stateCheckInterval = setInterval(checkTimeState, 30000);
    
    // Also check time state when document regains visibility
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('Document became visible, checking time state');
            checkTimeState();
        }
    });
    
    // Initial server time fetch for accurate time
    getServerTimeAndSync();
    
    // Play button click event with better Chrome compatibility
    playButton.addEventListener('click', function() {
        // Allow playback at any time, but play different audio based on time
        const inMainAudioWindow = isAfter2PMPST() && !isAfter5PMPST();
        
        // Extra debugging for Chrome issue
        console.log('Play button clicked at ' + new Date().toISOString() + ', in main audio window: ' + inMainAudioWindow);
        console.log('Audio player current state:', audioPlayer.paused ? 'paused' : 'playing', 'src:', audioPlayer.src);
        
        // Always ensure looping is enabled regardless of audio type
        audioPlayer.loop = true;
        
        // Show loading animation
        loadingAnimation.classList.remove('hidden');
        playButton.classList.add('hidden');
        
        // Determine which audio to play based on current time
        if (isAfter2PMPST() && !isAfter5PMPST()) {
            // Main audio window (2-5 PM)
            console.log('Setting main audio for 2-5PM window');
            currentAudioPath = mainAudioPath;
            document.body.classList.add('with-background');
        } else {
            // Outside main window (before 2PM or after 5PM)
            console.log('Setting static/intermission audio outside 2-5PM window');
            currentAudioPath = staticAudioPath;
            document.body.classList.remove('with-background');
        }
        
        // Set the audio source directly without URL manipulation for simplicity
        console.log('Setting audio source to:', currentAudioPath);
        audioPlayer.src = currentAudioPath;
        audioPlayer.loop = true;
        audioPlayer.load();
        
        // Extra debugging
        console.log('Audio source after setting:', audioPlayer.src);
        
        // Add a timeout to hide the loading animation if nothing happens after 5 seconds
        const loadingTimeout = setTimeout(() => {
            console.log('Audio loading timeout - hiding loading animation');
            loadingAnimation.classList.add('hidden');
            playButton.classList.remove('hidden');
            showStatus('Loading timeout. Try again.');
        }, 5000);
        
        // Explicitly try to play the audio with proper error handling
        console.log('Explicitly attempting to play audio...');
        const playAttempt = audioPlayer.play();
        
        if (playAttempt !== undefined) {
            playAttempt.then(() => {
                // Success - audio is playing
                console.log('Audio playback started successfully');
                clearTimeout(loadingTimeout); // Clear the timeout since we've successfully started playing
                loadingAnimation.classList.add('hidden');
                stopButton.classList.remove('hidden');
                
                // Show correct status message based on which audio is playing
                if (audioPlayer.src.indexOf(mainAudioPath) !== -1) {
                    showStatus('Playing Main Audio', true);
                    // Add pulse class to stop button for visual feedback
                    stopButton.classList.add('pulse');
                } else {
                    showStatus('Playing Intermission', true);
                    stopButton.classList.add('pulse');
                }
            }).catch(error => {
                // Error starting playback
                console.error('Error playing audio:', error);
                clearTimeout(loadingTimeout); // Clear the timeout since we already have an error
                loadingAnimation.classList.add('hidden');
                playButton.classList.remove('hidden');
                showStatus('Playback error. Try again.');
            });
        } else {
            // For older browsers that don't return a promise from play()
            console.log('Play attempt did not return a promise - older browser');
            // We'll rely on the timeout and other event handlers in this case
        }
        
        // Remove any existing event listeners to avoid duplicates
        const newEndedHandler = function() {
            console.log('Audio ended, handling looping manually');
            // Just in case the default loop doesn't work, manually loop the audio
            if (isAfter2PMPST() && !isAfter5PMPST()) {
                // Re-sync on loop for main content
                getServerTimeAndSync();
            } else {
                // Just restart for static (intermission) content
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(function(err) {
                    console.error('Error restarting audio:', err);
                    // Only show error UI if there's an actual error
                    playButton.classList.remove('hidden');
                    stopButton.classList.add('hidden');
                    showStatus('Playback error. Try again.');
                });
                
                // Show the correct status message
                showStatus('Playing Intermission');
            }
        };
        
        // Use safer event listener adding/removing
        audioPlayer.removeEventListener('ended', newEndedHandler);
        audioPlayer.addEventListener('ended', newEndedHandler);
        
        // Note: The canplaythrough handler has been replaced with Promise-based play() handling above
    });
    
    // Show/hide volume control on stop button long press
    let pressTimer;
    
    stopButton.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
            volumeControl.classList.toggle('visible');
            volumeControl.classList.remove('hidden');
            showStatus('Volume control ' + (volumeControl.classList.contains('visible') ? 'enabled' : 'disabled'));
        }, 800);
    });
    
    stopButton.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
    });
    
    stopButton.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
    });
    
    // For touch devices
    stopButton.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            volumeControl.classList.toggle('visible');
            volumeControl.classList.remove('hidden');
            showStatus('Volume control ' + (volumeControl.classList.contains('visible') ? 'enabled' : 'disabled'));
        }, 800);
        e.preventDefault();
    }, { passive: false });
    
    stopButton.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });
    
    // The crossFade function has been removed
    // Audio source changes now happen directly without fading effects
    // This improves browser compatibility and fixes Chrome syntax errors
    
    // Handle volume change
    volumeSlider.addEventListener('input', () => {
        const newVolume = volumeSlider.value;
        audioPlayer.volume = newVolume;
        
        // Save volume preference to localStorage
        localStorage.setItem('secretlife_volume', newVolume);
        
        showStatus(`Volume: ${Math.round(newVolume * 100)}%`);
    });
    
    // Auto-hide volume control after 5 seconds of inactivity
    volumeSlider.addEventListener('change', () => {
        setTimeout(() => {
            volumeControl.classList.remove('visible');
        }, 5000);
    });
    
    // More reliable keyboard handling
    function handleKeyboardShortcut(key) {
        // Space bar toggles play/pause
        if (key === ' ' && !isAfter5PMPST()) {
            if (audioPlayer.paused) {
                if (!stopButton.classList.contains('hidden')) {
                    stopButton.click();
                } else {
                    playButton.click();
                }
            } else {
                stopButton.click();
            }
            return true;
        }
        
        // Up/Down arrows control volume
        if (key === 'ArrowUp') {
            const newVol = Math.min(1, parseFloat(volumeSlider.value) + 0.05);
            volumeSlider.value = newVol;
            audioPlayer.volume = newVol;
            localStorage.setItem('secretlife_volume', newVol);
            showStatus(`Volume: ${Math.round(newVol * 100)}%`);
            return true;
        }
        
        if (key === 'ArrowDown') {
            const newVol = Math.max(0, parseFloat(volumeSlider.value) - 0.05);
            volumeSlider.value = newVol;
            audioPlayer.volume = newVol;
            localStorage.setItem('secretlife_volume', newVol);
            showStatus(`Volume: ${Math.round(newVol * 100)}%`);
            return true;
        }
        
        // 'i' key shows info about current state
        if (key === 'i' || key === 'I') {
            let stateMessage = '';
            if (isAfter5PMPST()) {
                stateMessage = 'Currently in intermission mode until tomorrow';
            } else if (isAfter2PMPST()) {
                stateMessage = 'Currently in 2 PM mode with main audio';
            } else if (isBefore159PMPST()) {
                stateMessage = 'Currently in intermission mode';
            } else {
                stateMessage = 'Currently in transition mode (1:59-2:00 PM)';
            }
            showStatus(stateMessage);
            return true;
        }
        
        return false;
    }
    
    // Keyboard listeners - multiple approaches for better compatibility
    document.addEventListener('keydown', (e) => {
        if (handleKeyboardShortcut(e.key)) {
            e.preventDefault();
        }
    });
    
    // Add on-screen keyboard shortcut hints
    const keyboardHints = document.createElement('div');
    keyboardHints.className = 'keyboard-hints';
    keyboardHints.innerHTML = `
        <button class="hint-button" title="Show keyboard shortcuts">?</button>
        <div class="hints-content hidden">
            <h3>Keyboard Shortcuts</h3>
            <p><strong>Space</strong>: Play/Pause</p>
            <p><strong>↑/↓</strong>: Volume</p>
            <p><strong>i</strong>: Status info</p>
        </div>
    `;
    document.body.appendChild(keyboardHints);
    
    // Toggle hint display
    const hintButton = keyboardHints.querySelector('.hint-button');
    const hintsContent = keyboardHints.querySelector('.hints-content');
    
    hintButton.addEventListener('click', () => {
        hintsContent.classList.toggle('hidden');
        setTimeout(() => {
            hintsContent.classList.add('hidden');
        }, 5000);
    });
    
    // Stop button click event
    stopButton.addEventListener('click', () => {
        // Pause audio
        audioPlayer.pause();
        
        // Reset UI
        stopButton.classList.add('hidden');
        stopButton.classList.remove('pulse');
        playButton.classList.remove('hidden');
        playButton.classList.add('pulse');
        
        // Hide volume control if visible
        volumeControl.classList.remove('visible');
        
        showStatus('Paused', true);
        
        // Clear listener count update interval when paused
        clearInterval(listenerCountUpdateInterval);
        updateListenerCount(); // Update count to reflect we left
    });
    
    // Additional event listeners for audio
    audioPlayer.addEventListener('ended', () => {
        // This should only happen if loop is disabled for some reason
        stopButton.classList.add('hidden');
        playButton.classList.remove('hidden');
        showStatus('Ended');
    });
    
    // Enhanced error handling for audio loading
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.error('Audio error code:', audioPlayer.error ? audioPlayer.error.code : 'unknown');
        console.error('Audio error message:', audioPlayer.error ? audioPlayer.error.message : 'unknown');
        console.error('Current audio path:', audioPlayer.src);
        
        audioLoadAttempts++;
        if (audioLoadAttempts < MAX_LOAD_ATTEMPTS) {
            // Try an alternative path format as hosting environments can vary
            const currentPath = audioPlayer.src;
            let newPath;
            
            // If we're using a relative path, try with ./ prefix
            if (!currentPath.startsWith('./') && !currentPath.startsWith('/') && !currentPath.startsWith('http')) {
                newPath = './' + currentPath;
            } else if (currentPath.includes('secretlifestatic')) {
                // Try without folder structure if that's the issue
                newPath = 'secretlife_static.mp3';
            } else if (currentPath.includes('secretlifemedia')) {
                // Try without folder structure if that's the issue
                newPath = '1-SofaEditA.mp3';
            }
            
            if (newPath && newPath !== currentPath) {
                console.log('Retrying with alternative path:', newPath);
                audioPlayer.src = newPath;
                audioPlayer.load();
                return;
            }
        }
        
        // If we've exhausted retries or have no alternative paths
        showStatus('Error loading audio. Check console for details.');
        loadingAnimation.classList.add('hidden');
        playButton.classList.remove('hidden');
    });
    
    // Status indicator function with improved visual feedback
    function showStatus(message, persistent = false) {
        // Safely handle the case where statusIndicator might not be available yet
        if (!statusIndicator) {
            console.warn('Status indicator not available yet');
            console.log('Status message:', message);
            return;
        }
        
        // Clear any existing timeout
        if (statusTimeout) {
            clearTimeout(statusTimeout);
        }
        
        // Update status message
        statusIndicator.textContent = message;
        statusIndicator.classList.remove('hidden');
        statusIndicator.classList.add('visible');
        
        // Only auto-hide non-persistent messages
        if (!persistent) {
            statusTimeout = setTimeout(() => {
                statusIndicator.classList.remove('visible');
            }, 3000);
        }
    }
    
    // Modified event handler to avoid interfering with button clicks on mobile
    document.addEventListener('click', (e) => {
        // Only prevent default for elements that aren't buttons, inputs, or controls
        if (e.target.tagName !== 'INPUT' && 
            !e.target.classList.contains('control-button') && 
            !e.target.closest('.control-button') && 
            !e.target.closest('#volume-control')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Add specific touch event handler for mobile devices
    if ('ontouchstart' in window) {
        console.log('Touch device detected, adding touch handlers');
        
        // Add touch handlers to buttons for better mobile responsiveness
        playButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!playButton.classList.contains('hidden')) {
                playButton.click();
            }
        });
        
        stopButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!stopButton.classList.contains('hidden')) {
                stopButton.click();
            }
        });
    }
    
    // Initialize the correct audio source based on time window, but don't auto-play
    const inMainAudioWindow = isAfter2PMPST() && !isAfter5PMPST();
    if (!inMainAudioWindow) {
        console.log('Outside 2-5PM window, setting up static audio source');
        
        // Make sure we're using the correct audio source
        if (audioPlayer.src.indexOf(staticAudioPath) === -1) {
            audioPlayer.src = staticAudioPath;
            audioPlayer.load();
        }
        
        console.log('Static audio source is ready, waiting for user to press play button');
    } else {
        console.log('In 2-5PM window, setting up main audio source');
        
        // Make sure we're using the correct audio source for main audio
        if (audioPlayer.src.indexOf(mainAudioPath) === -1) {
            audioPlayer.src = mainAudioPath;
            audioPlayer.load();
        }
        
        console.log('Main audio source is ready, waiting for user to press play button');
    }
    
    // Only play audio when the play button is clicked (defined earlier in the code)
    // The play button click handler will manage all playback
    console.log('Audio sources configured, waiting for user to press play');
    
    // Make sure loop is enabled
    audioPlayer.loop = true;
});
