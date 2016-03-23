/* Code borrowed from the offline first class */
'use strict';
//a
var staticCacheName = 'mtd-static-v5';
var allCaches = [
  staticCacheName
];
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        'bower_components/bootstrap/dist/css/bootstrap.css',
        'bower_components/jquery/dist/jquery.js',
        'bower_components/angular/angular.js',
        'bower_components/bootstrap/dist/js/bootstrap.js',
        'bower_components/angular-animate/angular-animate.js',
        'bower_components/angular-aria/angular-aria.js',
        'bower_components/angular-cookies/angular-cookies.js',
        'bower_components/angular-messages/angular-messages.js',
        'bower_components/angular-resource/angular-resource.js',
        'bower_components/angular-route/angular-route.js',
        'bower_components/angular-sanitize/angular-sanitize.js',
        'bower_components/angular-touch/angular-touch.js',
        'styles/main.css',
        'views/main.html',
        'scripts/1idb.js',
        'scripts/app.js',
        'scripts/controllers/main.js',
        'scripts/controllers/about.js',
        'google_transit/routes.txt',
        'google_transit/stops.txt',
        'sw.js'
      ]);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('mtd-') &&
                 !allCaches.includes(cacheName);
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request);
      })
    );
  }

});
