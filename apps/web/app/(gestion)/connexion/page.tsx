"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import styles from "./page.module.css";

export default function ConnexionPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await login(identifiant, motDePasse);
      router.push("/caisse");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Connexion impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>ELEGANZ Gestion</h1>
        <p>
          La caisse, le stock et les comptes de votre boutique, du comptoir
          jusqu&apos;au tableau de bord du soir.
        </p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>Connexion</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="identifiant">Email ou numéro de téléphone</label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">Mot de passe</label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? "Connexion…" : "Se connecter"}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            Pas encore de compte ? <Link href="/inscription">Ouvrir ma boutique</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
