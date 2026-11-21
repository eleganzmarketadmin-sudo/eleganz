// Valeur de secours pour le développement local (`next dev`) — remplacée
// automatiquement avant chaque build de PRODUCTION par
// scripts/inject-sw-version.js (même mécanisme, et au même moment, que la
// VERSION injectée dans public/sw.js). Sert de référence au composant
// VersionWatcher pour détecter qu'un onglet resté ouvert tourne sur une
// version plus ancienne que celle actuellement déployée (voir le
// commentaire de VersionWatcher.tsx).
export const BUILD_VERSION = "dev";
