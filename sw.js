const CACHE_NAME = 'gcd-plus-editor-v09';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/menu.css',
  './css/charter.css',
  './css/ImportChartMenu.css',
  './css/membresia.css',
  './css/StageEditor.css',
  './css/mobile.css',
  './js/membresia.js',
  './js/SisMiembros.js',
  './js/StageEditor.js',
  './js/variables.js',
  './js/audio.js',
  './js/charter.js',
  './js/ImportChart.js',
  './js/menu.js',
  './Icons/GiraTuCel.png',
  './Icons/Credits.png',
  './Icons/Projects.png',
  './Icons/Config.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// NETWORK-FIRST: intenta siempre la red (asi los fixes llegan de inmediato) y
// solo cae a la cache si no hay conexion (modo offline de la PWA). El cache-first
// anterior dejaba al navegador clavado con JS viejo: la cache statica nunca se
// revalidaba y los fixes no llegaban a los usuarios ya con el SW instalado.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      if (response.ok && event.request.url.startsWith(self.location.origin)) {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match('./'))
    )
  );
});
