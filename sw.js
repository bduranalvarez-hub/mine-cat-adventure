'use strict';

// Service worker: estrategia red-primero con respaldo en caché.
// Online siempre sirve la última versión; offline sirve la copia
// guardada. Sube CACHE_VERSION al publicar cambios importantes.
const CACHE_VERSION = 'mca-v3';

const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/modes.js',
  './js/audio.js',
  './js/music.js',
  './js/leaderboard.js',
  './js/share.js',
  './js/input.js',
  './js/sprites.js',
  './js/background.js',
  './js/track.js',
  './js/obstacles.js',
  './js/player.js',
  './js/game.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
