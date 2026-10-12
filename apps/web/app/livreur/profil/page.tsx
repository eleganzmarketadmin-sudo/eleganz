"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface DriverProfile {
  zone: string | null;
  verified: boolean;
  user: { fullName: string; email: string | null; phone: string | null };
}

function ProfilContent() {
  const [profil, setProfil] = useState<DriverProfile | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DriverProfile>("/delivery/me")
      .then(setProfil)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p>Chargement…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Mon profil livreur</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {profil && (
        <div className={styles.fiche}>
          <div className={styles.champ}>
            <span className={styles.champLabel}>Nom</span>
            <span>{profil.user.fullName}</span>
          </div>
          <div className={styles.champ}>
            <span className={styles.champLabel}>Contact</span>
            <span>{profil.user.email ?? profil.user.phone}</span>
          </div>
          <div className={styles.champ}>
            <span className={styles.champLabel}>Zone</span>
            <span>{profil.zone ?? "Non précisée"}</span>
          </div>
          <div className={styles.champ}>
            <span className={styles.champLabel}>Vérification</span>
            <span className={profil.verified ? styles.statutVerifie : styles.statutNonVerifie}>
              {profil.verified
                ? "Vérifié — vous pouvez recevoir des missions"
                : "En attente de vérification par l'administration"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilLivreurPage() {
  return (
    <LivreurShell>
      <ProfilContent />
    </LivreurShell>
  );
}
