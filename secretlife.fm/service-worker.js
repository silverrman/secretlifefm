// Service Worker for secretlife.fm
const CACHE_NAME = 'secretlife-fm-cache-v2';
const AUDIO_CACHE_NAME = 'secretlife-fm-audio-cache-v1';

// Core assets to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/favicon.ico',
  '/background.jpg'
];

// Audio files that will use a different caching strategy
const AUDIO_FILES = [
  '/secretlifestatic/secretlife_static.mp3',
  '/secretlifemedia/SofaEditB.mp3'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Cache core assets
      caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)),
      
      // Pre-cache audio files
      caches.open(AUDIO_CACHE_NAME).then(cache => cache.addAll(AUDIO_FILES))
    ])
  );
});

// Helper function to determine if a request is for an audio file
function isAudioRequest(request) {
  const url = new URL(request.url);
  return AUDIO_FILES.some(audioPath => url.pathname.endsWith(audioPath)) ||
         url.pathname.endsWith('.mp3') || 
         request.headers.get('content-type')?.includes('audio');
}

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // For audio files, use network-first strategy - DON'T try to cache them
  // This avoids issues with partial responses (HTTP 206) that can't be cached
  if (isAudioRequest(request)) {
    event.respondWith(
      fetch(request)
        .catch(error => {
          console.error('Fetch failed for audio:', error);
          return new Response('Audio file not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }
  
  // For regular assets, use cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, AUDIO_CACHE_NAME];
  
  // Claim clients immediately to ensure service worker is always in control
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Ensure the service worker takes control right away
      self.clients.claim()
    ])
  );
});
