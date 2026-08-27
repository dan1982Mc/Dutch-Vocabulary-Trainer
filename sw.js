const CACHE_NAME = 'dutch-vocabulary-v2.3.0';
const APP_SHELL = [
  './', './index.html', './manifest.json',
  './css/style.css',
  './js/version.js', './js/db.js', './js/storage.js', './js/similarity.js',
  './js/mastery.js', './js/scheduler.js', './js/packs.js',
  './js/exercises.js', './js/selection.js', './js/import.js',
  './js/dashboard.js', './js/practice.js', './js/ui.js',
  './js/packs-ui.js', './js/backup.js', './js/backup-ui.js',
  './js/app-bootstrap.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match('./index.html'))));
});
