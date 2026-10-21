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
        ],
      },
    ];
  },
};

export default nextConfig;
