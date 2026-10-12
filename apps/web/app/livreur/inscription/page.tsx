"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

const COMMUNES = [
  "Gombe",
  "Kalamu",
  "Kinshasa",
  "Kintambo",
  "Lemba",
  "Limete",
  "Matete",
  "Ndjili",
  "Ngaba",
  "Ngaliema",
  "Ngiri-Ngiri",
  "Barumbu",
  "Autre",
];

export default function InscriptionLivreurPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [zone, setZone] = useState(COMMUNES[0]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setEnCours(true);
    try {
      await register({ fullName, identifiant, motDePasse, role: "DRIVER" });
      await api.post("/delivery/drivers/register", { zone });
      router.push("/livreur/profil");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Inscription impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>Devenez livreur ELEGANZ</h1>
        <p>
          Recevez des missions de livraison pour les boutiques ELEGANZ de
          votre zone. Votre compte est examiné par l&apos;administration avant
          de recevoir vos premières missions.
        </p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>Créer mon compte livreur</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="fullName">Nom complet</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
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
            <label htmlFor="zone">Commune où vous livrez principalement</label>
            <select id="zone" value={zone} onChange={(e) => setZone(e.target.value)}>
              {COMMUNES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">Mot de passe (8 caractères minimum)</label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? "Création du compte…" : "Créer mon compte"}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            Déjà un compte ? <Link href="/livreur/connexion">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
