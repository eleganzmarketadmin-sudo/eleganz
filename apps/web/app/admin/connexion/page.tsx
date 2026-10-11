"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import styles from "./page.module.css";

export default function AdminConnexionPage() {
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
      router.push("/admin/pilotage");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Connexion impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>Centre de pilotage</h1>
        <p>Vue d&apos;ensemble ELEGANZ — boutiques, commandes, revenus, litiges.</p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>Connexion administration</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="identifiant">Email</label>
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
        </form>
      </div>
    </div>
  );
}
