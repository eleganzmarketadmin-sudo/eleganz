"use client";

import { useEffect, useState } from "react";
import { BUILD_VERSION } from "../lib/build-version";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./VersionWatcher.module.css";

const INTERVALLE_MS = 5 * 60 * 1000;

/**
 * Signale qu'un onglet resté ouvert tourne sur une version plus ancienne que
 * celle actuellement déployée (21 nov. 2026 — signalement récurrent : une
 * correction confirmée déployée "ne marche toujours pas" pour la boutique).
 * Voir le commentaire de ChunkErrorRecovery.tsx : ce filet-là ne couvre que
 * l'échec de chargement d'un morceau de code chargé PARESSEUSEMENT après
 * coup (erreur réseau explicite, 404). Un composant importé normalement dès
 * le premier chargement de la page (ex. ScannerCodeBarre dans
 * catalogue/page.tsx) reste simplement en mémoire tel quel dans un onglet
 * resté ouvert, sans jamais retenter un chargement réseau — donc sans
 * jamais déclencher ce filet, même des heures après un déploiement qui
 * corrige exactement le bug que la personne continue de revoir, en
 * silence, sans aucune erreur dans la console.
 *
 * Comparaison périodique entre BUILD_VERSION (figé dans le bundle JS chargé
 * par CET onglet au moment de son ouverture — voir scripts/inject-sw-
 * version.js) et /version.json (toujours lu sur le réseau, jamais mis en
 * cache par le service worker : voir le filtre de son écouteur "fetch" dans
 * public/sw.js, qui ne traite que /_next/static/ et /icons/). Un écart
 * signifie qu'un nouveau déploiement a eu lieu depuis l'ouverture de la
 * page — on le signale avec un bouton plutôt que de laisser deviner
 * pourquoi "la correction ne marche pas", et sans recharger tout seul (un
 * formulaire en cours de saisie — caisse, catalogue — ne doit jamais être
 * perdu sans que la personne l'ait explicitement demandé).
 */
export function VersionWatcher() {
  const { t } = useLocale();
  const [nouvelleVersionDisponible, setNouvelleVersionDisponible] = useState(false);

  useEffect(() => {
    if (BUILD_VERSION === "dev") return; // next dev : rien de fiable à comparer

    let annule = false;

    async function verifier() {
      if (annule || document.visibilityState !== "visible") return;
      try {
        const reponse = await fetch("/version.json", { cache: "no-store" });
        if (!reponse.ok) return;
        const donnees = (await reponse.json()) as { version?: string };
        if (!annule && donnees.version && donnees.version !== BUILD_VERSION) {
          setNouvelleVersionDisponible(true);
        }
      } catch {
        // Réseau indisponible (hors-ligne, par exemple) — ce n'est pas une
        // nouvelle version, juste une vérification impossible pour
        // l'instant ; le prochain intervalle réessaiera.
      }
    }

    verifier();
    const intervalle = window.setInterval(verifier, INTERVALLE_MS);
    document.addEventListener("visibilitychange", verifier);
    return () => {
      annule = true;
      window.clearInterval(intervalle);
      document.removeEventListener("visibilitychange", verifier);
    };
  }, []);

  if (!nouvelleVersionDisponible) return null;

  return (
    <div className={styles.bandeau} role="status">
      <span>{t("maj_nouvelleVersion")}</span>
      <button type="button" className={styles.bouton} onClick={() => window.location.reload()}>
        {t("maj_recharger")}
      </button>
    </div>
  );
}
