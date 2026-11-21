// 21 oct. 2026 (audit sécurité/IT) : ce fichier n'existait pas du tout —
// aucun en-tête de sécurité HTTP n'était envoyé pour les pages HTML
// servies par Next.js (le `helmet()` ajouté côté API ne protège QUE
// l'API, jamais ces pages). `headers()` s'applique à toute route de
// l'application (voir la doc Next.js), donc couvre Gestion, le
// marketplace et l'admin sans distinction.
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Cette plateforme n'a jamais besoin d'être affichée dans une
          // <iframe> d'un autre site — bloque le clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le navigateur de « deviner » le type d'un fichier
          // servi (ex. un upload traité comme script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 21 nov. 2026 (retour client : "quand on clique sur l'appareil
          // photo l'écran reste figé") — `camera=()` interdisait l'accès à
          // la caméra à TOUTE origine, y compris la nôtre : avec cet
          // en-tête, `getUserMedia()` ne déclenche même pas l'invite
          // d'autorisation du navigateur, et la promesse reste indéfiniment
          // en attente — vu par la boutique comme un écran figé, sans
          // erreur, sans rien à cliquer. Le scan de code-barres par caméra
          // (catalogue/page.tsx, ScannerCodeBarre) a besoin de la caméra en
          // self (notre propre origine uniquement, jamais un tiers/iframe).
          // Micro et géolocalisation restent bloqués : rien dans
          // l'application ne les utilise.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          // 2 nov. 2026 (audit sécurité) : manquait ici — déjà envoyé par
          // l'API via helmet() (main.ts), mais jamais par ces pages HTML
          // elles-mêmes (domaine www.eleganzmarket.com, service distinct).
          // Sans ce header, un visiteur dont le navigateur tente une
          // première requête en http:// (lien tapé sans "https://", vieux
          // favori) est exposé à une redirection interceptable avant
          // d'atteindre la bascule HTTPS côté hébergeur. Pas de `preload`
          // (engagement plus difficile à défaire) tant que ce n'est pas une
          // décision délibérée.
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
        ],
      },
      // 14 nov. 2026 (signalement récurrent "connexion en boucle, il faut
      // vider les cookies") — le correctif précédent (voir
      // scripts/inject-sw-version.js) change le CONTENU de sw.js à chaque
      // déploiement pour que le service worker purge lui-même les anciens
      // caches, mais ne dit rien sur la mise en cache HTTP de sw.js
      // lui-même : sans en-tête explicite, un navigateur (ou un
      // intermédiaire entre lui et Railway) peut continuer de servir une
      // ancienne copie de sw.js pendant un moment après le déploiement,
      // retardant d'autant la prise d'effet du correctif — exactement le
      // genre de délai qui fait dire "le problème persiste après la mise à
      // jour". `no-cache` (= revalider systématiquement, pas "ne jamais
      // mettre en cache") force chaque visite à vérifier auprès du serveur
      // si une nouvelle version existe avant de réutiliser quoi que ce soit.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
