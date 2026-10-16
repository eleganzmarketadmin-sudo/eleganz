"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface CandidatureExpert {
  id: string;
  headline: string;
  bio: string;
  domaines: string[];
  createdAt: string;
  user: { fullName: string; email?: string | null; phone?: string | null };
}

// File de modération des candidatures Experts (module Experts, 16 oct.
// 2026, point 2, décision verrouillée Q1 : validation admin avant annuaire
// public). Un rejet ou une suspension ne supprime jamais le profil, il
// change seulement son statut — l'expert peut toujours corriger et
// re-soumettre depuis /marketplace/experts/moi.
function AdminExpertsContent() {
  const { t } = useLocale();
  const [candidatures, setCandidatures] = useState<CandidatureExpert[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  function recharger() {
    api
      .get<CandidatureExpert[]>("/experts/admin/en-attente")
      .then(setCandidatures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function moderer(id: string, action: "approuver" | "rejeter") {
    setEnCours(id);
    setErreur(null);
    try {
      await api.patch(`/experts/admin/${id}/${action}`, { note: notes[id] || undefined });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admexperts_moderationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admexperts_titre")}</h1>
      {erreur && <p>{erreur}</p>}

      {candidatures.length === 0 ? (
        <p className={styles.messageVide}>{t("admexperts_aucuneCandidature")}</p>
      ) : (
        candidatures.map((c) => (
          <div className={styles.candidature} key={c.id}>
            <div className={styles.entete}>
              <span>
                {c.user.fullName} — {c.user.email ?? c.user.phone ?? "—"}
              </span>
              <span>{formatDate(c.createdAt)}</span>
            </div>
            <p className={styles.headline}>{c.headline}</p>
            <p className={styles.bio}>{c.bio}</p>
            <div className={styles.domaines}>
              {c.domaines.map((d) => (
                <span className={styles.domaine} key={d}>
                  {d}
                </span>
              ))}
            </div>
            <div className={styles.actions}>
              <input
                placeholder={t("admexperts_placeholderNote")}
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
              />
              <button
                className={styles.boutonApprouver}
                disabled={enCours === c.id}
                onClick={() => moderer(c.id, "approuver")}
              >
                {t("admexperts_approuver")}
              </button>
              <button
                className={styles.boutonRejeter}
                disabled={enCours === c.id}
                onClick={() => moderer(c.id, "rejeter")}
              >
                {t("admexperts_rejeter")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminExpertsPage() {
  return (
    <AdminShell>
      <AdminExpertsContent />
    </AdminShell>
  );
}
