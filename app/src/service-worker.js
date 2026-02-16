/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

clientsClaim();

// This allows the updated SW to take control without waiting for old tabs to close.
self.skipWaiting();

const SCRIPT_CACHE_NAME = 'quran-tft-script-cache';
const STYLE_CACHE_NAME = 'quran-tft-style-cache';
const IMAGE_CACHE_NAME = 'quran-tft-image-cache';
const FONT_CACHE_NAME = 'quran-tft-font-cache';
const JSON_CACHE_NAME = 'quran-tft-json-cache';

// Precache all webpack-generated assets.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const extractScriptUrls = (html) => {
  const matches = html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi);
  return Array.from(matches, (match) => match[1]);
};

const toAbsoluteUrl = (url) => {
  try {
    return new URL(url, self.location.origin).href;
  } catch (_error) {
    return null;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Warm script cache during install to cover assets excluded by precache size limits.
        const indexUrl = new URL(process.env.PUBLIC_URL + '/index.html', self.location.origin).href;
        const indexResponse = await fetch(indexUrl, { cache: 'no-store' });
        if (!indexResponse.ok) {
          return;
        }

        const html = await indexResponse.text();
        const scriptUrls = extractScriptUrls(html)
          .map(toAbsoluteUrl)
          .filter((url) => url && url.startsWith(self.location.origin));

        if (scriptUrls.length === 0) {
          return;
        }

        const cache = await caches.open(SCRIPT_CACHE_NAME);
        await Promise.all(
          scriptUrls.map(async (scriptUrl) => {
            try {
              const response = await fetch(scriptUrl, { cache: 'no-store' });
              if (response.ok) {
                await cache.put(scriptUrl, response.clone());
              }
            } catch (error) {
              console.warn('Failed to warm script cache for:', scriptUrl, error);
            }
          })
        );
      } catch (error) {
        console.warn('Failed to warm shell scripts during install', error);
      }
    })()
  );
});

registerRoute(
  new NavigationRoute(createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html'), {
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
  })
);

// Runtime cache for JS chunks (important because very large bundles may be skipped by precache size limits).
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    (request.destination === 'script' || request.destination === 'worker'),
  new StaleWhileRevalidate({
    cacheName: SCRIPT_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: STYLE_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGE_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    request.destination === 'font',
  new CacheFirst({
    cacheName: FONT_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 12,
      }),
    ],
  })
);

// Runtime cache for same-origin JSON responses. Useful for web/PWA data usage.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    url.pathname.endsWith('.json'),
  new StaleWhileRevalidate({
    cacheName: JSON_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
      }),
    ],
  })
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
