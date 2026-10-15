"use client";

import { useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

function DossierContenu() {
  const { t } = useLocale();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function telecharger() {
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrirDocumentPdf("/comptable/export/dossier-financement");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("cpt_dossierNonGenere"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("titre_dossierFinancement")}</h1>
      <p className={styles.sousTitre}>
        {t("dossier_sousTitre")}
      </p>

      <div className={styles.avertissement}>
        {t("dossier_avertissementPre")} <strong>{t("dossier_avertissementPas")}</strong> {t("dossier_avertissementPost")}
      </div>

      <div className={styles.contenuDossier}>
        <h2 className={styles.sectionTitre}>{t("dossier_contenuTitre")}</h2>
        <ul className={styles.liste}>
          <li>{t("dossier_listeActivites")}</li>
          <li>{t("dossier_historiqueMensuel")}</li>
          <li>{t("dossier_dettesEmprunts")}</li>
          <li>{t("dossier_creancesEnCours")}</li>
          <li>{t("dossier_codeVerification")}</li>
        </ul>
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <button className={styles.bouton} onClick={telecharger} disabled={enCours}>
        {enCours ? t("dossier_genererEnCours") : t("dossier_telechargerPdf")}
      </button>
    </div>
  );
}

export default function DossierFinancementPage() {
  return (
    <ComptableShell>
      <DossierContenu />
    </ComptableShell>
  );
}
