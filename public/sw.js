const CACHE_PREFIX = "openworkout-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = new URL("./", self.registration.scope).href;
const ASSET_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

function isCacheable(response) {
  return response && response.ok && response.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(new Request(APP_SHELL, { cache: "reload" }));

        if (isCacheable(response)) {
          await cache.put(APP_SHELL, response);
        }
      } catch {
        // A first install may happen while offline; the next visit can populate it.
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestURL = new URL(request.url);
  const isSameOrigin = requestURL.origin === self.location.origin;
  const isInsideScope = requestURL.href.startsWith(self.registration.scope);

  if (!isSameOrigin || !isInsideScope) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (isCacheable(response)) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL, response.clone());
          }

          return response;
        } catch {
          const cachedShell = await caches.match(APP_SHELL);
          return cachedShell || Response.error();
        }
      })(),
    );
    return;
  }

  if (!ASSET_DESTINATIONS.has(request.destination)) {
    return;
  }

  const cachePromise = caches.open(CACHE_NAME);
  const networkPromise = cachePromise.then(async (cache) => {
    try {
      const response = await fetch(request);

      if (isCacheable(response)) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch {
      return null;
    }
  });

  event.waitUntil(networkPromise.then(() => undefined));
  event.respondWith(
    cachePromise.then(async (cache) => {
      const cachedResponse = await cache.match(request);
      return cachedResponse || (await networkPromise) || Response.error();
    }),
  );
});
