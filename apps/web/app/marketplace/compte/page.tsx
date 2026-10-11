"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, ApiError } from "../../lib/auth";
import styles from "./page.module.css";

export default function ComptePage() {
  return (
    <Suspense fallback={null}>
      <ComptePageContenu />
    </Suspense>
  );
}

function ComptePageContenu() {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [onglet, setOnglet] = useState<"connexion" | "inscription">("connexion");
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function destination(): string {
    return searchParams.get("retour") ?? "/marketplace";
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      if (onglet === "connexion") {
        await login(identifiant, motDePasse);
      } else {
        if (motDePasse.length < 8) {
          setErreur("Le mot de passe doit contenir au moins 8 caractères.");
          setEnCours(false);
          return;
        }
        await register({ fullName, identifiant, motDePasse, role: "BUYER" });
      }
      router.push(destination());
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Opération impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.onglets}>
        <button
          className={`${styles.onglet} ${onglet === "connexion" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("connexion")}
        >
          Se connecter
        </button>
        <button
          className={`${styles.onglet} ${onglet === "inscription" ? styles.ongletActif : ""}`}
          onClick={() => setOnglet("inscription")}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={soumettre}>
        {erreur && <div className={styles.erreur}>{erreur}</div>}

        {onglet === "inscription" && (
          <div className={styles.champ}>
            <label htmlFor="fullName">Nom complet</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        )}
        <div className={styles.champ}>
          <label htmlFor="identifiant">Email ou numéro de téléphone</label>
          <input
            id="identifiant"
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
            minLength={onglet === "inscription" ? 8 : undefined}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours
            ? "Un instant…"
            : onglet === "connexion"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
