// Valeur de secours pour le développement local (`next dev`) — remplacée
// automatiquement avant chaque build de PRODUCTION par
// scripts/inject-sw-version.js (même mécanisme, et au même moment, que la
// VERSION injectée dans public/sw.js). Sert de référence au composant
// VersionWatcher pour détecter qu'un onglet resté ouvert tourne sur une
// version plus ancienne que celle actuellement déployée (voir le
// commentaire de VersionWatcher.tsx).
//
// 21 nov. 2026 (bug de build découvert après coup) — l'annotation ": string"
// ci-dessous n'est pas facultative. Sans elle, TypeScript infère pour cette
// const son type littéral exact ("dev"). scripts/inject-sw-version.js
// réécrit ensuite ce fichier sur le disque avec une AUTRE valeur littérale
// avant que `next build` ne lance sa vérification de types — à ce moment,
// TypeScript voit une const dont le type est littéralement, par exemple,
// "eleganz-shell-1700000000000", et la comparaison "BUILD_VERSION === "dev""
// dans VersionWatcher.tsx devient selon lui impossible ("types have no
// overlap") : échec de build sur Railway, alors qu'un `tsc --noEmit` lancé
// en local (où ce fichier garde sa valeur "dev" committée) ne voit jamais
// l'erreur. L'annotation force le type large `string`, qui reste valide
// quelle que soit la valeur injectée.
export const BUILD_VERSION: string = "dev";
