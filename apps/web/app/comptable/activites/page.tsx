"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Activite {
  id: string;
  name: string;
  category: string;
}

const CATEGORIES: { valeur: string; label: string }[] = [
  { valeur: "COMMERCE", label: "Commerce" },
  { valeur: "LOCATION", label: "Location (maisons, appartements…)" },
  { valeur: "VEHICULE", label: "Véhicule (taxi, transport…)" },
  { valeur: "SERVICE", label: "Prestation de services" },
  { valeur: "AUTRE", label: "Autre" },
];

const LABELS_CATEGORIE: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.label]));

function ActivitesContenu() {
  const { t } = useLocale();
  const [activites, setActivites] = useState<Activite[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("COMMERCE");
  const [enCours, setEnCours] = useState(false);

  function recharger() {
    api
      .get<Activite[]>("/comptable/activities")
      .then(setActivites)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post("/comptable/activities", { name: nom.trim(), category: categorie });
      setNom("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("activites_titre")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.liste}>
        {activites.length === 0 ? (
          <p className={styles.messageVide}>{t("vide_aucuneActivite")}</p>
        ) : (
          activites.map((a) => (
            <Link className={styles.activite} href={`/comptable/activites/${a.id}`} key={a.id}>
              <span className={styles.activiteNom}>{a.name}</span>
              <span className={styles.activiteCategorie}>{LABELS_CATEGORIE[a.category] ?? a.category}</span>
            </Link>
          ))
        )}
      </div>

      <form className={styles.formulaire} onSubmit={creer}>
        <label className={styles.champ}>
          <span>{t("activites_nom")}</span>
          <input
            placeholder="Ex. Petit commerce, Maison Lemba…"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </label>
        <label className={styles.champ}>
          <span>{t("activites_categorie")}</span>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours ? t("commun_chargement") : t("activites_nouvelle")}
        </button>
      </form>
    </div>
  );
}

export default function ComptableActivitesPage() {
  return (
    <ComptableShell>
      <ActivitesContenu />
    </ComptableShell>
  );
}
