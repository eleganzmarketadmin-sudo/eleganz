#!/usr/bin/env node
/**
 * Injecte un identifiant de version unique dans public/sw.js avant chaque
 * build de production (13-14 nov. 2026, signalement récurrent : "la page de
 * connexion ne charge pas après avoir mis les accès ... je suis obligé de
 * supprimer les cookies à chaque fois que le problème se pose"). Jusqu'ici
 * VERSION dans sw.js était une chaîne fixe ("eleganz-shell-v1") qui ne
 * changeait JAMAIS d'un déploiement à l'autre.
 *
 * Le service worker (mode hors-ligne) met les pages et les fichiers
 * JS/CSS en cache sous un nom dérivé de VERSION. Comme ce nom ne changeait
 * pas, le nettoyage fait dans l'écouteur "activate" de sw.js (qui ne
 * supprime que les caches dont le nom NE correspond PAS à la version
 * courante) ne supprimait jamais rien d'un déploiement à l'autre : les
 * anciens fichiers restaient indéfiniment dans le même cache que les
 * nouveaux. Sur un simple aléa réseau pendant la navigation (voir
 * reseauPuisCache dans sw.js, qui ne sert le cache qu'en secours d'un
 * échec réseau), le navigateur pouvait alors retomber sur une ancienne
 * page HTML entièrement mise en cache, référençant d'anciens fichiers JS
 * eux-mêmes encore en cache (jamais purgés) — un instantané figé et
 * autosuffisant d'un déploiement précédent, avec d'éventuels bugs déjà
 * corrigés depuis la mise en cache. Vider les cookies/le stockage du site
 * est ce qui "réparait" la situation jusqu'ici : ça vide ce cache figé —
 * mais seulement jusqu'au prochain aléa réseau, qui peut remettre en
 * cache un nouvel instantané figé.
 *
 * En donnant à VERSION un identifiant différent à chaque build, l'écouteur
 * "activate" supprime maintenant bien les caches de l'ancien déploiement
 * dès que le nouveau service worker prend le contrôle : un instantané figé
 * ne peut plus survivre au déploiement suivant.
 *
 * Lancé uniquement par le script "build" (production) — "next dev" n'y
 * touche pas. Modifie public/sw.js sur place : sans conséquence en
 * environnement de build Railway (conteneur jetable), et sans gravité en
 * local (fichier suivi par git, mais seul le suffixe de version change).
 */
const fs = require("fs");
const path = require("path");

const cheminSw = path.join(__dirname, "..", "public", "sw.js");
const contenu = fs.readFileSync(cheminSw, "utf8");

const version = `eleganz-shell-${Date.now()}`;
const misAJour = contenu.replace(/^const VERSION = ".*";$/m, `const VERSION = "${version}";`);

if (misAJour === contenu) {
  throw new Error(
    `inject-sw-version: la ligne "const VERSION = ...;" est introuvable dans ${cheminSw} — ` +
      "le service worker continuerait de servir un cache figé d'un déploiement à l'autre.",
  );
}

fs.writeFileSync(cheminSw, misAJour);
console.log(`[inject-sw-version] sw.js versionné pour ce build : ${version}`);
