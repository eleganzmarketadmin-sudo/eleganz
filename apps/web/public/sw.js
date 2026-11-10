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
 *
 * Mise en cache des images produits (3 nov. 2026, demande du propriétaire :
 * accélérer les visites répétées et réduire la consommation de données sur
 * une connexion faible, sans rien changer au stockage central). Ces images
 * viennent de Cloudflare R2, une origine différente du site — exclue par
 * défaut ci-dessus — donc traitée séparément plus bas, avant le filtre
 * "même origine". Chaque image reçoit un nom de fichier unique (UUID) à
 * l'envoi et n'est jamais réécrite au même nom (voir storage.service.ts) :
 * une fois vue, elle ne change plus jamais, donc "cache d'abord, sans
 * jamais revalider au réseau" est sûr indéfiniment. Cache séparé de celui
 * de l'app shell (préfixe différent) pour ne pas être vidé quand VERSION
 * change ci-dessous.
 */

const VERSION = "eleganz-shell-v1";
const CACHE_PAGES = `${VERSION}-pages`;
const CACHE_ASSETS = `${VERSION}-assets`;
const CACHE_IMAGES = "eleganz-images-v1";
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

  if (request.method !== "GET") {
    return;
  }

  // Images (produits, profils experts, etc.) : voir le commentaire d'en-tête.
  // Vérifié avant le filtre "même origine" ci-dessous puisque ces images
  // viennent presque toujours d'une autre origine (Cloudflare R2).
  if (request.destination === "image") {
    event.respondWith(cachePuisReseau(request, CACHE_IMAGES));
    return;
  }

  // Le reste : seulement les requêtes de même origine — jamais l'API
  // (autre origine), jamais les mutations (POST/PATCH/DELETE), qui doivent
  // toujours passer par la file hors-ligne applicative, pas par le cache HTTP.
  if (new URL(request.url).origin !== self.location.origin) {
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

/**
 * Notifications push (10 nov. 2026, demande : alerter la personne sur son
 * téléphone/ordinateur à l'arrivée d'un message ou d'une commande, avec
 * redirection au clic) — reçues ici même si l'app n'est pas ouverte, c'est
 * tout l'intérêt par rapport au sondage déjà fait par NotificationBell
 * (qui ne tourne que si un onglet est ouvert). La charge envoyée par
 * NotificationsService (voir apps/api/src/notifications) est un simple
 * JSON { title, body, link }.
 */
self.addEventListener("push", (event) => {
  let charge = {};
  try {
    charge = event.data ? event.data.json() : {};
  } catch {
    // Charge non-JSON (ne devrait pas arriver, NotificationsService envoie
    // toujours du JSON) — on affiche quand même une notification générique
    // plutôt que de ne rien afficher du tout.
  }
  const titre = charge.title || "ELEGANZ";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: charge.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { link: charge.link || "/" },
    }),
  );
});

/**
 * Clic sur la notification : si un onglet ELEGANZ est déjà ouvert, on le
 * ramène au premier plan et on le fait naviguer vers le lien plutôt que
 * d'ouvrir un doublon — sinon on ouvre un nouvel onglet directement sur ce
 * lien (demande explicite : "possibilité d'être redirigé sur la
 * plateforme").
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const lien = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const fenetre of liste) {
        const url = new URL(fenetre.url);
        if (url.origin === self.location.origin) {
          if ("navigate" in fenetre) fenetre.navigate(lien);
          return fenetre.focus();
        }
      }
      return clients.openWindow(lien);
    }),
  );
});
