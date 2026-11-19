"use client";

import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useExchangeRate } from "../lib/exchange-rate";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./TauxDuJourBanner.module.css";

/**
 * Bannière "saisir le taux du jour" (19 nov. 2026, demande du propriétaire,
 * point 2) — "ajouter une sorte de bande passante pour toute équipe du
 * centre de pilotage ayant le taux de change en charge lui demandant de
 * saisir les taux du jour et qui reste visible et passante tant que le
 * taux n'a pas encore enregistré pour cette date."
 *
 * Portée validée avec le propriétaire (AskUserQuestion) : "Seulement ceux
 * qui peuvent modifier le taux" — pas toute l'équipe du Centre de pilotage,
 * seulement les admins ayant le menu TARIFS (seuls à voir/utiliser
 * PATCH /admin/platform-settings/exchange-rate). AdminShell calcule déjà
 * cette liste de menus autorisés (`ecransAutorises`) pour filtrer la barre
 * de navigation ; on la lui fait passer ici plutôt que de la recalculer.
 *
 * Reste affichée (pas de bouton pour la fermer) tant que la condition n'est
 * pas remplie : disparaît d'elle-même dès que le taux est enregistré pour
 * la date du jour — jamais sur simple clic de fermeture, qui ne ferait que
 * masquer temporairement un taux toujours pas à jour.
 *
 * "Aujourd'hui" est évalué dans le fuseau Afrique/Kinshasa (siège de
 * l'activité), jamais celui du navigateur de la personne connectée — un
 * membre de l'équipe connecté depuis un autre fuseau horaire ne doit pas
 * voir une date différente de celle de l'équipe sur place à Kinshasa.
 */
const FUSEAU_SIEGE = "Africa/Kinshasa";

function jourDansFuseau(d: Date): string {
  // Format "en-CA" = AAAA-MM-JJ : comparable directement en chaîne, sans
  // ambiguïté de format contrairement à "fr-FR" (JJ/MM/AAAA).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_SIEGE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function TauxDuJourBanner({ peutModifierTaux }: { peutModifierTaux: boolean }) {
  const { t } = useLocale();
  const { cdfPerUsd, updatedAt, chargement, recharger } = useExchangeRate();
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Ni autorisé, ni encore chargé (évite un flash "pas de taux" avant que
  // la vraie réponse du serveur n'arrive) : rien à afficher.
  if (!peutModifierTaux || chargement) return null;

  const tauxEnregistreAujourdhui = updatedAt != null && jourDansFuseau(new Date(updatedAt)) === jourDansFuseau(new Date());
  if (tauxEnregistreAujourdhui) return null;

  const valeur = Number(saisie.replace(",", "."));
  const saisieValide = saisie.trim() !== "" && Number.isFinite(valeur) && valeur > 0;

  async function enregistrer() {
    if (!saisieValide) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.patch("/admin/platform-settings/exchange-rate", { cdfPerUsd: valeur });
      setSaisie("");
      recharger(); // met à jour updatedAt pour toute la plateforme — la bannière se masque d'elle-même
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.bandeau} role="alert">
      <span className={styles.texte}>{t("admbandeau_taux_texte")}</span>
      <span className={styles.formulaire}>
        <span className={styles.prefixe}>1 USD =</span>
        <input
          className={styles.champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={cdfPerUsd != null ? String(cdfPerUsd) : "ex. 2900"}
          onKeyDown={(e) => {
            if (e.key === "Enter") enregistrer();
          }}
          inputMode="decimal"
          aria-label="1 USD en CDF"
        />
        <span className={styles.suffixe}>CDF</span>
        <button className={styles.bouton} disabled={enCours || !saisieValide} onClick={enregistrer}>
          {t("admbandeau_taux_enregistrer")}
        </button>
      </span>
      {erreur && <span className={styles.erreur}>{erreur}</span>}
    </div>
  );
}
