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
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
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
    ];
  },
};

export default nextConfig;
