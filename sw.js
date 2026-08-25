'use strict';

// Service worker: estrategia red-primero con respaldo en caché.
// Online siempre sirve la última versión; offline sirve la copia
// guardada. Sube CACHE_VERSION al publicar cambios importantes.
const CACHE_VERSION = 'mca-v50';

const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './delete-account.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/config.js',
  './js/modes.js',
  './js/audio.js',
  './js/music.js',
  './js/remote.js',
  './js/moderation.js',
  './js/leaderboard.js',
  './js/share.js',
  './js/input.js',
  './js/coins.js',
  './js/skins.js',
  './js/ads.js',
  './js/account.js',
  './js/sprites.js',
  './js/background.js',
  './js/track.js',
  './js/obstacles.js',
  './js/player.js',
  './js/game.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/char-sphynx.png',
  './img/char-enemy.png',
  './img/skin-bebe.png',
  './img/skin-esqueleto.png',
  './img/skin-robot.png',
  './img/skin-gatoreal.png',
  './img/skin-dragon.png',
  './img/skin-mago.png',
  './img/skin-pirata.png',
  './img/skin-doctor.png',
  './img/skin-siames.png',
  './img/skin-naranja.png',
  './img/login-bg.jpg',
  './img/ores.png',
  './img/menu-bg.jpg',
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
  // El manifiesto de version se consulta SIEMPRE contra la red: si se
  // sirviera desde cache, el aviso de actualizacion nunca aparaceria.
  if (url.pathname.endsWith('/version.json')) return;

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
