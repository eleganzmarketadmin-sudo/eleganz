"use client";

import { useEffect, useMemo, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Evenement {
  date: string;
  label: string;
  detail: string;
  type: "dette" | "creance" | "emprunt" | "loyer" | "versement";
  refId: string;
}

function cleJour(iso: string): string {
  return iso.slice(0, 10);
}

function construireGrilleMois(annee: number, mois: number): (Date | null)[] {
  // Grille lundi→dimanche (usage courant en RDC), avec des cases vides pour
  // caler le 1er du mois sur la bonne colonne.
  const premierJour = new Date(annee, mois, 1);
  const decalage = (premierJour.getDay() + 6) % 7; // 0 = lundi
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases: (Date | null)[] = Array(decalage).fill(null);
  for (let j = 1; j <= nbJours; j++) cases.push(new Date(annee, mois, j));
  return cases;
}

function AgendaContenu() {
  const { t } = useLocale();
  const LABELS_TYPE: Record<Evenement["type"], string> = {
    dette: t("agenda_dette"),
    creance: t("agenda_creance"),
    emprunt: t("agenda_emprunt"),
    loyer: t("agenda_loyer"),
    versement: t("agenda_versement"),
  };
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<"chronologique" | "calendrier">("chronologique");
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null);

  const maintenant = new Date();
  const [moisAffiche, setMoisAffiche] = useState(maintenant.getMonth());
  const [anneeAffichee, setAnneeAffichee] = useState(maintenant.getFullYear());

  useEffect(() => {
    api
      .get<Evenement[]>("/comptable/agenda")
      .then(setEvenements)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  const parJour = useMemo(() => {
    const m = new Map<string, Evenement[]>();
    for (const e of evenements) {
      const jour = cleJour(e.date);
      if (!m.has(jour)) m.set(jour, []);
      m.get(jour)!.push(e);
    }
    return m;
  }, [evenements]);

  const joursTries = useMemo(() => Array.from(parJour.keys()).sort(), [parJour]);
  const grille = useMemo(() => construireGrilleMois(anneeAffichee, moisAffiche), [anneeAffichee, moisAffiche]);

  if (chargement) return <p>{t("commun_chargement")}</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;

  const nomMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(anneeAffichee, moisAffiche, 1),
  );

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_agenda")}</h1>
      <p className={styles.sousTitre}>
        Vos échéances réelles — dettes, créances, emprunts, loyers attendus et versements des travailleurs.
      </p>

      <div className={styles.onglets}>
        <button
          className={`${styles.onglet} ${vue === "chronologique" ? styles.ongletActif : ""}`}
          onClick={() => setVue("chronologique")}
        >
          {t("agenda_vueChrono")}
        </button>
        <button
          className={`${styles.onglet} ${vue === "calendrier" ? styles.ongletActif : ""}`}
          onClick={() => setVue("calendrier")}
        >
          {t("agenda_vueCalendrier")}
        </button>
      </div>

      {vue === "chronologique" ? (
        joursTries.length === 0 ? (
          <p className={styles.messageVide}>{t("vide_aucuneEcheance")}</p>
        ) : (
          joursTries.map((jour) => (
            <div key={jour} className={styles.groupeJour}>
              <div className={styles.groupeJourTitre}>{formatDate(`${jour}T00:00:00`)}</div>
              {parJour.get(jour)!.map((e, i) => (
                <div className={`${styles.ligne} ${styles["type_" + e.type]}`} key={`${jour}-${i}`}>
                  <span>
                    <strong>{LABELS_TYPE[e.type]}</strong> — {e.label}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ))
        )
      ) : (
        <>
          <div className={styles.navigationMois}>
            <button
              className={styles.boutonSecondaire}
              onClick={() => {
                if (moisAffiche === 0) {
                  setMoisAffiche(11);
                  setAnneeAffichee((a) => a - 1);
                } else setMoisAffiche((m) => m - 1);
              }}
            >
              {t("agenda_moisPrecedent")}
            </button>
            <span className={styles.nomMois}>{nomMois}</span>
            <button
              className={styles.boutonSecondaire}
              onClick={() => {
                if (moisAffiche === 11) {
                  setMoisAffiche(0);
                  setAnneeAffichee((a) => a + 1);
                } else setMoisAffiche((m) => m + 1);
              }}
            >
              {t("agenda_moisSuivant")}
            </button>
          </div>

          <div className={styles.grilleCalendrier}>
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => (
              <div className={styles.enteteJourSemaine} key={j}>
                {j}
              </div>
            ))}
            {grille.map((date, i) => {
              if (!date) return <div className={styles.caseVide} key={i} />;
              const cle = date.toISOString().slice(0, 10);
              const nb = parJour.get(cle)?.length ?? 0;
              const estAujourdhui = cle === maintenant.toISOString().slice(0, 10);
              return (
                <button
                  key={cle}
                  className={`${styles.caseJour} ${nb > 0 ? styles.caseJourAvecEvenement : ""} ${
                    estAujourdhui ? styles.caseJourAujourdhui : ""
                  } ${jourSelectionne === cle ? styles.caseJourSelectionnee : ""}`}
                  onClick={() => setJourSelectionne(cle === jourSelectionne ? null : cle)}
                >
                  <span>{date.getDate()}</span>
                  {nb > 0 && <span className={styles.pastille}>{nb}</span>}
                </button>
              );
            })}
          </div>

          {jourSelectionne && (
            <div className={styles.groupeJour} style={{ marginTop: "20px" }}>
              <div className={styles.groupeJourTitre}>{formatDate(`${jourSelectionne}T00:00:00`)}</div>
              {(parJour.get(jourSelectionne) ?? []).length === 0 ? (
                <p className={styles.messageVide}>{t("agenda_rienCeJour")}</p>
              ) : (
                parJour.get(jourSelectionne)!.map((e, i) => (
                  <div className={`${styles.ligne} ${styles["type_" + e.type]}`} key={i}>
                    <span>
                      <strong>{LABELS_TYPE[e.type]}</strong> — {e.label}
                      {e.detail ? ` · ${e.detail}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ComptableAgendaPage() {
  return (
    <ComptableShell>
      <AgendaContenu />
    </ComptableShell>
  );
}
