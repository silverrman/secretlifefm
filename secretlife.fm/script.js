// Status indicator timeout variable declared globally to prevent hoisting issues
let statusTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // Core elements
    const playButton = document.getElementById('play-button');
    const loadingAnimation = document.getElementById('loading-animation');
    const stopButton = document.getElementById('stop-button');
    const audioPlayer = document.getElementById('audio-player');
    const volumeControl = document.getElementById('volume-control');
    const volumeSlider = document.getElementById('volume-slider');
    const statusIndicator = document.getElementById('status-indicator');
    
    // Load saved volume preference if available
    if (localStorage.getItem('secretlife_volume')) {
        const savedVolume = parseFloat(localStorage.getItem('secretlife_volume'));
        audioPlayer.volume = savedVolume;
        volumeSlider.value = savedVolume;
    }
    
    // Media file paths - adding error handling for hosting environments
    const staticAudioPath = 'secretlifestatic/secretlife_static.mp3';
    const mainAudioPath = 'secretlifemedia/1-SofaEditA.mp3';
    let currentAudioPath = staticAudioPath;
    
    // Audio loading error counter for retry logic
    let audioLoadAttempts = 0;
    const MAX_LOAD_ATTEMPTS = 3;
    
    // Add error logging for debugging
    console.log('secretlife.fm - Script initialized');
    console.log('Current time (local):', new Date().toString());
    
    // Function to check if current time is after 2 PM PST
    function isAfter2PMPST() {
        const now = new Date();
        // Convert current time to PST (UTC-7 for PDT, UTC-8 for PST)
        // Using -7 for PDT (daylight saving)
        const pstHour = (now.getUTCHours() - 7 + 24) % 24;
        const pstMinute = now.getUTCMinutes();
        return pstHour >= 14 && pstHour < 17; // Between 2 PM and 5 PM
    }
    
    // Function to check if current time is before 1:59 PM PST
    function isBefore159PMPST() {
        const now = new Date();
        const pstHour = (now.getUTCHours() - 7 + 24) % 24;
        const pstMinute = now.getUTCMinutes();
        
        return pstHour < 13 || (pstHour === 13 && pstMinute <= 59);
    }
    
    // Function to check if current time is after 5 PM PST (for daily reset)
    function isAfter5PMPST() {
        const now = new Date();
        const pstHour = (now.getUTCHours() - 7 + 24) % 24;
        
        return pstHour >= 17; // 5 PM = 17:00
    }
    
    // Function to update UI and audio based on time
    function updateUI() {
        const wasPlaying = !audioPlayer.paused;
        const currentTime = audioPlayer.currentTime;
        const isAfter2PM = isAfter2PMPST();
        const isBefore159PM = isBefore159PMPST();
        const isAfter5PM = isAfter5PMPST();
        
        // Check for 5 PM reset first
        if (isAfter5PM) {
            // Reset to initial state for the next day
            document.body.classList.remove('with-background');
            currentAudioPath = staticAudioPath;
            
            // If audio is playing, stop it
            if (!audioPlayer.paused) {
                audioPlayer.pause();
                stopButton.classList.remove('pulse');
                stopButton.classList.add('hidden');
                playButton.classList.remove('hidden');
                showStatus('Daily reset: Ready for tomorrow');
            }
            
            // Make sure the audio source is set to static for the next day
            audioPlayer.src = staticAudioPath;
            return; // Exit early after handling reset
        }
        
        // Regular time-based logic for 2 PM
        if (isAfter2PM) {
            // Add background with transition
            if (!document.body.classList.contains('with-background')) {
                document.body.classList.add('with-background');
                showStatus('Now in 2 PM mode');
            }
            
            // Switch to main audio at 2 PM if needed with crossfade
            if (currentAudioPath !== mainAudioPath) {
                currentAudioPath = mainAudioPath;
                
                // Use crossfade for smoother transition
                crossFade(mainAudioPath, 1500, 1500)
                    .then(() => {
                        if (!audioPlayer.paused) {
                            showStatus('Switched to main audio');
                            stopButton.classList.add('pulse');
                        }
                    })
                    .catch(error => {
                        console.error('Error during crossfade:', error);
                    });
            }
        } else if (!isAfter5PM) { // Only handle the non-2PM state if we're not after 5 PM
            // Remove background with transition
            if (document.body.classList.contains('with-background')) {
                document.body.classList.remove('with-background');
                showStatus('Back to standard mode');
            }
            
            // Switch to static audio with crossfade if needed
            if (currentAudioPath !== staticAudioPath) {
                currentAudioPath = staticAudioPath;
                
                // Use crossfade for smoother transition
                crossFade(staticAudioPath, 1500, 1500)
                    .then(() => {
                        if (!audioPlayer.paused) {
                            showStatus('Switched to static audio');
                            stopButton.classList.add('pulse');
                        }
                    })
                    .catch(error => {
                        console.error('Error during crossfade:', error);
                    });
            }
        }
        
        // Auto stop audio at 1:59 PM PST but only if it's in the transition period
        // This ensures we don't interfere with playback at 2 PM
        if (!isBefore159PM && !isAfter2PM && !audioPlayer.paused) {
            audioPlayer.pause();
            stopButton.classList.add('hidden');
            playButton.classList.remove('hidden');
            showStatus('Transitioning to 2 PM state');
        }
    }
    
    // Check time and update UI on page load
    updateUI();
    
    // Check time every 10 seconds
    // This less frequent checking helps prevent playback interruptions
    let timeCheckInterval = setInterval(updateUI, 10000);
    
    // Handle play button click
    playButton.addEventListener('click', () => {
        // Check if we're in the reset period (after 5PM)
        if (isAfter5PMPST()) {
            showStatus('The experience is reset until tomorrow');
            return;
        }
        
        // Show loading animation
        playButton.classList.add('hidden');
        loadingAnimation.classList.remove('hidden');
        
        // Reset error counter on new play attempt
        audioLoadAttempts = 0;
        
        // Determine which audio to play based on current time
        if (isAfter2PMPST()) {
            currentAudioPath = mainAudioPath;
            console.log('Starting main audio playback:', currentAudioPath);
        } else {
            currentAudioPath = staticAudioPath;
            console.log('Starting static audio playback:', currentAudioPath);
        }
        
        // Ensure we have a proper URL - some hosting environments need full paths
        // Try to build an absolute path by checking the window location
        const baseUrl = window.location.href.replace(/\/[^/]*$/, '/');
        const absolutePath = new URL(currentAudioPath, baseUrl).href;
        
        console.log('Base URL:', baseUrl);
        console.log('Absolute path:', absolutePath);
        
        // Try different path strategies if we're on a hosting service
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // On hosting service - try with absolute path
            audioPlayer.src = absolutePath;
        } else {
            // Local development - use relative path
            audioPlayer.src = currentAudioPath;
        }
        
        // Set to loop continuously
        audioPlayer.loop = true;
        
        // Add more debugging
        console.log('Audio src set to:', audioPlayer.src);
        
        // Load and play the audio
        try {
            audioPlayer.load();
            console.log('Audio load initiated');
        } catch (err) {
            console.error('Error during audio load:', err);
            showStatus('Error loading audio');
        }
        
        audioPlayer.addEventListener('canplaythrough', () => {
            // Hide loading animation, show stop button
            loadingAnimation.classList.add('hidden');
            stopButton.classList.remove('hidden');
            
            // Only play if it's not between 1:59 PM and 2 PM PST
            if (isBefore159PMPST() || isAfter2PMPST()) {
                audioPlayer.play()
                    .then(() => {
                        // Add pulse effect to indicate playing
                        stopButton.classList.add('pulse');
                        
                        // Show status message based on time
                        if (isAfter2PMPST()) {
                            showStatus('Now playing main audio');
                        } else {
                            showStatus('Now playing static audio');
                        }
                        
                        // After 2PM, disable the regular time check to prevent playback interruptions
                        if (isAfter2PMPST()) {
                            // Clear the existing interval
                            clearInterval(timeCheckInterval);
                            // Set a less frequent check (once per minute) for the after-2PM state
                            timeCheckInterval = setInterval(() => {
                                // Only update background, don't touch audio
                                document.body.classList.add('with-background');
                            }, 60000);
                        }
                    })
                    .catch(error => {
                        console.error('Audio playback failed:', error);
                        showStatus('Playback failed. Please try again.');
                        stopButton.classList.add('hidden');
                        playButton.classList.remove('hidden');
                    });
            } else {
                showStatus('Playback not available between 1:59 PM and 2:00 PM PST');
                // Reset UI
                stopButton.classList.add('hidden');
                playButton.classList.remove('hidden');
            }
        }, { once: true });
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
    
    // Audio Crossfade Function
    function crossFade(newSource, fadeOutDuration = 1000, fadeInDuration = 1000) {
        return new Promise((resolve) => {
            // Remember current volume and playback state
            const currentVolume = audioPlayer.volume;
            const wasPlaying = !audioPlayer.paused;
            let oldAudio = null;
            
            // If currently playing, create a clone to fade out
            if (wasPlaying) {
                // Create a temporary audio element with current source
                oldAudio = new Audio(audioPlayer.src);
                oldAudio.volume = currentVolume;
                oldAudio.currentTime = audioPlayer.currentTime;
                oldAudio.play();
                
                // Fade out the old audio
                const fadeOutInterval = setInterval(() => {
                    if (oldAudio.volume > 0.05) {
                        oldAudio.volume -= 0.05;
                    } else {
                        clearInterval(fadeOutInterval);
                        oldAudio.pause();
                        oldAudio = null;
                    }
                }, fadeOutDuration / 20);
            }
            
            // Set new source and prepare to play
            audioPlayer.src = newSource;
            audioPlayer.volume = 0;
            audioPlayer.load();
            
            // When new audio can play, start fading it in
            audioPlayer.addEventListener('canplaythrough', () => {
                if (wasPlaying) {
                    audioPlayer.play();
                    
                    // Fade in the new audio
                    let newVolume = 0;
                    const fadeInInterval = setInterval(() => {
                        if (newVolume < currentVolume) {
                            newVolume += 0.05;
                            if (newVolume > currentVolume) newVolume = currentVolume;
                            audioPlayer.volume = newVolume;
                        } else {
                            clearInterval(fadeInInterval);
                            resolve();
                        }
                    }, fadeInDuration / 20);
                } else {
                    // If not playing, just set volume back to normal
                    audioPlayer.volume = currentVolume;
                    resolve();
                }
            }, { once: true });
        });
    }
    
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
                stateMessage = 'Currently in reset mode until tomorrow';
            } else if (isAfter2PMPST()) {
                stateMessage = 'Currently in 2 PM mode with main audio';
            } else if (isBefore159PMPST()) {
                stateMessage = 'Currently in static audio mode';
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
    
    // Handle stop button click
    stopButton.addEventListener('click', () => {
        // Pause audio
        audioPlayer.pause();
        
        // Remove pulse effect
        stopButton.classList.remove('pulse');
        
        // Reset UI
        stopButton.classList.add('hidden');
        playButton.classList.remove('hidden');
        
        // Hide volume control if visible
        volumeControl.classList.remove('visible');
        
        showStatus('Playback stopped');
    });
    
    // Additional event listeners for audio
    audioPlayer.addEventListener('ended', () => {
        // This should only happen if loop is disabled for some reason
        stopButton.classList.add('hidden');
        playButton.classList.remove('hidden');
        showStatus('Playback ended');
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
    
    // Status indicator function
    function showStatus(message) {
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
        
        // Auto-hide after 3 seconds
        statusTimeout = setTimeout(() => {
            statusIndicator.classList.remove('visible');
        }, 3000);
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
});
