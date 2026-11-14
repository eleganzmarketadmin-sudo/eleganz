"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InstitutionShell } from "./InstitutionShell";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface BoutiqueAcces {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/**
 * Accueil du portail institutions (14 nov. 2026) — liste des boutiques qui
 * ont explicitement partagé leur dossier crédit avec cette institution (voir
 * ShopInstitutionAccess). Jamais de recherche/parcours de boutiques non
 * invitées ici : décision verrouillée du 14 nov. 2026, "seulement celles qui
 * l'invitent explicitement".
 */
function AccueilInstitutionContenu() {
  const { t } = useLocale();
  const [boutiques, setBoutiques] = useState<BoutiqueAcces[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BoutiqueAcces[]>("/institution-portal/shops")
      .then(setBoutiques)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
  }, []);

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_accueilTitre")}</h1>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "var(--espace-4)" }}>
        {t("inst_accueilSousTitre")}
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {boutiques === null && !erreur ? (
        <p>{t("commun_chargement")}</p>
      ) : boutiques && boutiques.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_aucuneBoutique")}</p>
      ) : boutiques ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("inst_colBoutique")}</th>
              <th>{t("inst_colPartageDepuis")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {boutiques.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{new Date(b.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>
                  <Link href={`/institution/boutiques/${b.id}`} className={styles.bouton} style={{ textDecoration: "none", display: "inline-block" }}>
                    {t("inst_voirDossier")}
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

export default function AccueilInstitutionPage() {
  return (
    <InstitutionShell>
      <AccueilInstitutionContenu />
    </InstitutionShell>
  );
}
