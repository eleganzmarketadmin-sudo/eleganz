"use client";

import { useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import styles from "./page.module.css";

function DossierContenu() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function telecharger() {
    setEnCours(true);
    setErreur(null);
    try {
      await ouvrirDocumentPdf("/comptable/export/dossier-financement");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le dossier n'a pas pu être généré.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Dossier pour une demande de financement</h1>
      <p className={styles.sousTitre}>
        Un document prêt à joindre à une demande de crédit — historique sur 6 mois de vos activités,
        dettes et créances en cours.
      </p>

      <div className={styles.avertissement}>
        Ce dossier n&apos;est <strong>pas</strong> un état financier certifié ni une attestation
        comptable ou fiscale officielle. Il rassemble, à titre préparatoire, les données que vous avez
        vous-même déclarées dans Mon Comptable, pour appuyer votre démarche auprès d&apos;une institution
        de financement.
      </div>

      <div className={styles.contenuDossier}>
        <h2 className={styles.sectionTitre}>Ce que contient le dossier</h2>
        <ul className={styles.liste}>
          <li>La liste de vos activités déclarées et leur ancienneté</li>
          <li>Un historique mensuel sur 6 mois (ventes, dépenses, résultat estimé par devise)</li>
          <li>Vos dettes et emprunts en cours, avec solde restant</li>
          <li>Vos créances en cours (montants que l&apos;on vous doit)</li>
          <li>Un code de vérification et la date de génération</li>
        </ul>
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <button className={styles.bouton} onClick={telecharger} disabled={enCours}>
        {enCours ? "Génération…" : "Télécharger le dossier (PDF)"}
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
