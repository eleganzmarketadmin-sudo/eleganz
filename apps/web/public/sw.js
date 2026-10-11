/**
 * Service worker de l'app shell ELEGANZ Gestion — phase 2 du mode hors-ligne
 * (docs/ARCHITECTURE_HORS_LIGNE.md). Écrit à la main plutôt que généré par
 * un plugin de build : ce bac à sable ne peut pas exécuter `next build`
 * (Google Fonts bloqué au moment du build, voir MAINTENANCE.md), donc on ne
 * peut pas précharger une liste de fichiers aux noms figés par le build.
 * Stratégie retenue à la place : mise en cache "à l'usage" (runtime
 * caching) — dès qu'une page ou un fichier statique a été chargé une
 * première fois en ligne, il reste disponible hors-ligne ensuite. Ça
 * couvre le vrai besoin (l'écran caisse déjà visité s'ouvre sans réseau)
 * sans dépendre des noms de fichiers générés par le build.
 *
 * Ce service worker ne touche jamais aux appels vers l'API (autre origine)
 * — la file hors-ligne de la caisse (offline-queue.ts/offline-sync.tsx)
 * gère déjà elle-même les échecs réseau vers l'API.
 */

const VERSION = "eleganz-shell-v1";
const CACHE_PAGES = `${VERSION}-pages`;
const CACHE_ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = "/hors-ligne.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS).then((cache) =>
      cache.addAll([OFFLINE_URL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom.startsWith("eleganz-shell-") && nom !== CACHE_PAGES && nom !== CACHE_ASSETS)
          .map((nom) => caches.delete(nom)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Seulement les requêtes GET de même origine — jamais l'API (autre
  // origine), jamais les mutations (POST/PATCH/DELETE), qui doivent
  // toujours passer par la file hors-ligne applicative, pas par le cache HTTP.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(reseauPuisCache(request, CACHE_PAGES, OFFLINE_URL));
    return;
  }

  if (request.url.includes("/_next/static/") || request.url.includes("/icons/")) {
    event.respondWith(cachePuisReseau(request, CACHE_ASSETS));
  }
});

async function reseauPuisCache(request, nomCache, urlSecours) {
  const cache = await caches.open(nomCache);
  try {
    const reponse = await fetch(request);
    cache.put(request, reponse.clone());
    return reponse;
  } catch {
    const enCache = await cache.match(request);
    return enCache ?? (await caches.match(urlSecours));
  }
}

async function cachePuisReseau(request, nomCache) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(request);
  if (enCache) return enCache;
  const reponse = await fetch(request);
  cache.put(request, reponse.clone());
  return reponse;
}
