const CACHE_NAME = 'notesfrais-test-shell-v28';

const SHELL_FILES = [
  '/test',
  '/test.html',
  '/app.html',
  '/manifest-test.webmanifest',
  '/icon.svg',
  '/notesfrais-patches.js',
  '/notesfrais-submit-summary.js',
  '/notesfrais-pwa.js',
  '/notesfrais-storage-secure.js',
  '/notesfrais-channel-storage.js',
  '/notesfrais-ocr-boost.js',
  '/notesfrais-offline.js',
  '/notesfrais-offline-fixed.js',
  '/notesfrais-channel-isolation.js',
  '/notesfrais-sync-status.js',
  '/notesfrais-flow.js',
  '/notesfrais-meal-context.js',
  '/notesfrais-current-month.js',
  '/notesfrais-test-payment-card.js',
  '/notesfrais-test-annual-stats.js',
  '/notesfrais-test-annual-stats-fix.js',
  '/notesfrais-test-history-annual.js',
  '/notesfrais-test-search-dedupe.js',
  '/notesfrais-access.js',
  '/notesfrais-test-finance-settings.js',
  '/notesfrais-test-finance-dashboard.js',
  '/notesfrais-test-finance-expenses.js',
  '/notesfrais-test-finance-receipts-zip.js',
  '/notesfrais-test-submission-badge.js',
  '/notesfrais-delight.js',
  '/notesfrais-mobile-cleanup.js',
  '/notesfrais-test-sticky-nav.js',
  '/notesfrais-test-modal-fix.js',
  '/notesfrais-test-period-inside-tabs.js',
  '/notesfrais-test-user-expenses.js',
  '/notesfrais-test-compress.js'
];

const EXTERNAL_FILES = [
  'https://cdn.jsdelivr.net/npm/react@17.0.2/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@17.0.2/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.10/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(SHELL_FILES).catch(() => undefined);
      await Promise.all(EXTERNAL_FILES.map(url => fetch(new Request(url, { mode: 'no-cors' })).then(response => cache.put(url, response)).catch(() => undefined)));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('notesfrais-test-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function fallbackFor(url) {
  if (url.origin !== self.location.origin) return caches.match(url.href);
  if (url.pathname.startsWith('/test')) return caches.match('/test.html');
  if (url.pathname.endsWith('.js')) return caches.match(url.pathname);
  return caches.match('/test.html');
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const shouldHandle =
    url.origin === self.location.origin ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!shouldHandle) return;

  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => undefined);
      return response;
    }).catch(() => caches.match(request).then(cached => cached || fallbackFor(url)))
  );
});
