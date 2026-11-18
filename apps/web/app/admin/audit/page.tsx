"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Journal d'audit interne (18 nov. 2026, chantier "gestion de risque
// autonome" Phase 4, volet "piste d'audit interne" retenu par le
// propriétaire) — consultation en lecture seule des AuditLog écrits par
// enregistrerAuditLog (apps/api/src/audit/audit-log.util.ts) depuis les
// actions administratives sensibles (validation d'analyse de crédit,
// décision de prêt, facture marquée payée, décision de réactivation,
// suspension/réactivation/refus d'institution, suspension/réactivation de
// compte, vérification livreur, changement de statut boutique). Réservé au
// menu AUDIT (ADMIN_SUPER et ADMIN_AUDITOR par défaut — voir AdminShell.tsx
// et menu-admin.util.ts) : ce journal trace des actions sensibles sur
// l'ensemble des domaines, contrairement aux écrans propres à chaque rôle.
interface LigneAudit {
  id: string;
  actorId: string | null;
  actor: { id: string; fullName: string; email: string | null } | null;
  shopId: string | null;
  shop: { id: string; name: string } | null;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function formaterDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  try {
    return JSON.stringify(details, null, 0);
  } catch {
    return "—";
  }
}

function AuditContent() {
  const { t } = useLocale();
  const [lignes, setLignes] = useState<LigneAudit[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [actionsDisponibles, setActionsDisponibles] = useState<string[]>([]);
  const [filtreAction, setFiltreAction] = useState("");
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<string[]>("/admin/audit-log/actions")
      .then(setActionsDisponibles)
      .catch(() => setActionsDisponibles([]));
  }, []);

  function charger(reinitialiser: boolean) {
    const enCoursChargement = reinitialiser ? setChargement : setChargementPlus;
    enCoursChargement(true);
    setErreur(null);
    const params = new URLSearchParams();
    if (filtreAction) params.set("action", filtreAction);
    if (!reinitialiser && curseur) params.set("cursor", curseur);
    api
      .get<{ lignes: LigneAudit[]; prochainCurseur: string | null }>(`/admin/audit-log?${params.toString()}`)
      .then((reponse) => {
        setLignes((actuel) => (reinitialiser ? reponse.lignes : [...actuel, ...reponse.lignes]));
        setCurseur(reponse.prochainCurseur);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("admaudit_erreurChargement")))
      .finally(() => enCoursChargement(false));
  }

  useEffect(() => {
    charger(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreAction]);

  return (
    <div>
      <h1 className={styles.titre}>{t("admaudit_titre")}</h1>
      <p className={styles.sousTitre}>{t("admaudit_sousTitre")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.filtres}>
        <label className={styles.filtreLabel}>
          {t("admaudit_filtreActionLabel")}
          <select value={filtreAction} onChange={(e) => setFiltreAction(e.target.value)}>
            <option value="">{t("admaudit_touteAction")}</option>
            {actionsDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : lignes.length === 0 ? (
        <p className={styles.messageVide}>{t("admaudit_aucuneEntree")}</p>
      ) : (
        <div className={styles.tableauScroll}>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("admaudit_colDate")}</th>
                <th>{t("admaudit_colActeur")}</th>
                <th>{t("admaudit_colAction")}</th>
                <th>{t("admaudit_colBoutique")}</th>
                <th>{t("admaudit_colDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.id}>
                  <td>{new Date(ligne.createdAt).toLocaleString()}</td>
                  <td>{ligne.actor ? (ligne.actor.fullName || ligne.actor.email || ligne.actor.id) : t("admaudit_acteurSysteme")}</td>
                  <td>
                    <code>{ligne.action}</code>
                  </td>
                  <td>{ligne.shop?.name ?? "—"}</td>
                  <td className={styles.colonneDetails}>{formaterDetails(ligne.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {curseur && (
        <button className={styles.boutonChargerPlus} onClick={() => charger(false)} disabled={chargementPlus}>
          {chargementPlus ? "…" : t("admaudit_chargerPlus")}
        </button>
      )}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <AdminShell>
      <AuditContent />
    </AdminShell>
  );
}
