"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./ScannerCodeBarre.module.css";

/**
 * Scan de code-barres par caméra (21 nov. 2026, retour client : « on doit
 * donner la possibilité de scanner le code en plus de la saisie manuelle…
 * imaginez également les erreurs de saisie surtout pour des longues
 * saisies »). Contrairement à la caisse (où une douchette USB/Bluetooth
 * dédiée se comporte comme un clavier — voir caisse/page.tsx), la saisie
 * du code-barres au catalogue se fait souvent depuis un téléphone sans
 * scanner externe branché : ce composant lit directement le flux de la
 * caméra avec ZXing (décodage par traitement d'image, fonctionne sur tous
 * les navigateurs ayant une caméra — contrairement à l'API native
 * BarcodeDetector, absente de Safari/iOS). Overlay modal réutilisable,
 * partagé par la création de variante ET l'édition d'un code-barres
 * existant.
 */
export function ScannerCodeBarre({
  onDetecte,
  onFermer,
}: {
  onDetecte: (code: string) => void;
  onFermer: () => void;
}) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlesRef = useRef<IScannerControls | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Tant que ni une erreur ni une première image vidéo ne sont arrivées, on
  // affiche un état "en attente" explicite (21 nov. 2026, retour client :
  // "l'écran reste figé") — un cadre vidéo noir et silencieux, sans aucun
  // texte, était indiscernable d'un gel : on ne sait plus si quelque chose se
  // passe ou si c'est bloqué. La cause réelle de ce signalement était un
  // en-tête Permissions-Policy qui bloquait la caméra (corrigé dans
  // next.config.mjs), mais un `getUserMedia()` refusé par un navigateur, une
  // autre application accaparant déjà la caméra, etc. peuvent produire le
  // même silence : ce composant ne doit plus jamais rester muet.
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    const video = videoRef.current;

    const delaiMaxMs = 10_000;
    const minuteur = window.setTimeout(() => {
      if (!annule && !pret) setErreur(t("cat_scanCameraImpossible"));
    }, delaiMaxMs);

    try {
      const lecteur = new BrowserMultiFormatReader();

      lecteur
        .decodeFromConstraints(
          // Caméra arrière de préférence (meilleure distance de mise au
          // point pour un code-barres qu'une caméra frontale) — "ideal"
          // plutôt que "exact" : un appareil à caméra unique (ordinateur
          // portable) reste utilisable, juste sans préférence appliquée.
          { video: { facingMode: { ideal: "environment" } } },
          video ?? undefined,
          (resultat, _err, controles) => {
            if (annule) return;
            controlesRef.current = controles;
            if (!pret) setPret(true);
            if (resultat) {
              controles.stop();
              onDetecte(resultat.getText());
            }
            // `_err` est émis à CHAQUE image où rien n'est détecté
            // (NotFoundException) — c'est l'état normal entre deux images,
            // pas une erreur à afficher.
          },
        )
        .catch(() => {
          // Permission caméra refusée, aucune caméra disponible, contexte
          // non sécurisé (http non local), etc. — la saisie manuelle reste
          // disponible dans le champ juste à côté, ce n'est jamais bloquant.
          if (!annule) setErreur(t("cat_scanCameraImpossible"));
        });
    } catch {
      // Échec synchrone (ex. bibliothèque indisponible) — même traitement.
      if (!annule) setErreur(t("cat_scanCameraImpossible"));
    }

    return () => {
      annule = true;
      window.clearTimeout(minuteur);
      controlesRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.fond} onClick={onFermer}>
      <div className={styles.boite} onClick={(e) => e.stopPropagation()}>
        <div className={styles.entete}>
          <span>{t("cat_scanTitre")}</span>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label={t("action_fermer")}>
            ✕
          </button>
        </div>
        {erreur ? (
          <p className={styles.erreur}>{erreur}</p>
        ) : (
          <>
            <div className={styles.cadreVideo}>
              {/* muted + playsInline requis pour que la lecture démarre sans
                  geste utilisateur supplémentaire sur mobile (Safari/iOS en
                  particulier). */}
              <video ref={videoRef} className={styles.video} muted playsInline />
              <div className={styles.guide} aria-hidden="true" />
              {!pret && (
                <div className={styles.enAttente}>
                  <span>{t("cat_scanEnAttenteCamera")}</span>
                </div>
              )}
            </div>
            <p className={styles.aide}>{t("cat_scanAide")}</p>
          </>
        )}
      </div>
    </div>
  );
}
