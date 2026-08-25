const CACHE_NAME = 'toolbook-shell-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './records.html',
  './tool.html',
  './support.js',
  './toolbook-card.js',
  './toolbook.js',
  './fonts.css',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/babel.min.js',
  './fonts/EBGaramond-Regular.subset.woff2',
  './fonts/NotoSerifTC-Medium.subset.woff2',
  './fonts/NotoSerifTC-Regular.subset.woff2',
  './fonts/NotoSerifTC-SemiBold.subset.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key.indexOf('toolbook-') === 0 && key !== CACHE_NAME
            ? caches.delete(key)
            : Promise.resolve(false);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(request)
          .then(function (cached) {
            return cached || caches.match(new Request(url.pathname)) || caches.match('./index.html');
          });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (!response || !response.ok) return response;
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        return response;
      });
    })
  );
});
