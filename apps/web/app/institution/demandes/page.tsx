"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface DemandeCreditListe {
  id: string;
  numero: string;
  statut: string;
  nomDemandeur: string;
  montantDemande: number;
  dureeMoisDemandee: number;
  createdAt: string;
  shop: { id: string; name: string; slug: string } | null;
  decision: { statut: "ACCORDE" | "REFUSE"; loanId: string | null } | null;
}

const STATUTS_TERMINAUX_POSITIFS = ["ACCORDEE", "DECAISSEE", "EN_REMBOURSEMENT", "SOLDEE"];

function classeBadge(statut: string): string {
  if (statut === "REFUSEE") return styles.badgeRefuse;
  if (STATUTS_TERMINAUX_POSITIFS.includes(statut)) return styles.badgeAccorde;
  return styles.badgeNeutre;
}

/**
 * Candidatures de crédit numérotées reçues (16 nov. 2026, demande du
 * propriétaire, point 1) — distinct de la liste des boutiques
 * (/institution, ShopInstitutionAccess) : une DemandeCredit est une
 * candidature précise, numérotée, qui peut venir d'une boutique déjà
 * partenaire (`shop` renseigné) ou avoir été créée directement par
 * l'institution pour un prospect (`shop` null, voir
 * DemandeCreditService.creerLibre).
 */
function DemandesContenu() {
  const { t } = useLocale();
  const [demandes, setDemandes] = useState<DemandeCreditListe[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DemandeCreditListe[]>("/institution-portal/demandes")
      .then(setDemandes)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
  }, [t]);

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_demandesRecuesTitre")}</h1>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "var(--espace-4)" }}>
        {t("inst_demandesRecuesSousTitre")}
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {demandes === null && !erreur ? (
        <p>{t("commun_chargement")}</p>
      ) : demandes && demandes.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneDemandeRecue")}</p>
      ) : demandes ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("inst_colNumero")}</th>
              <th>{t("inst_colDate")}</th>
              <th>{t("inst_colDemandeur")}</th>
              <th>{t("inst_colOrigine")}</th>
              <th>{t("credit_labelMontant")}</th>
              <th>{t("inst_colStatut")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d.id}>
                <td style={{ fontFamily: "monospace" }}>{d.numero}</td>
                <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>{d.nomDemandeur}</td>
                <td>{d.shop ? d.shop.name : t("inst_origineLibre")}</td>
                <td className="chiffre">{d.montantDemande.toLocaleString("fr-FR")}</td>
                <td>
                  <span className={`${styles.badge} ${classeBadge(d.statut)}`}>
                    {t(`inst_demandeStatut_${d.statut}`)}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/institution/demandes/${d.numero}`}
                    className={styles.bouton}
                    style={{ textDecoration: "none", display: "inline-block" }}
                  >
                    {t("action_voir")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function DemandesPage() {
  return (
    <InstitutionShell>
      <DemandesContenu />
    </InstitutionShell>
  );
}
