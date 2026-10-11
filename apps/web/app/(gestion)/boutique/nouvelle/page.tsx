"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "./page.module.css";

const MODES = [
  {
    valeur: "PRIVATE" as const,
    titre: "Privée",
    description: "Caisse, stock et comptes — jamais visible sur la Marketplace.",
  },
  {
    valeur: "HYBRID" as const,
    titre: "Hybride",
    description: "Gestion complète, avec la possibilité de publier une sélection sur la Marketplace.",
  },
];

export default function NouvelleBoutiquePage() {
  const { user, loading: authLoading } = useAuth();
  const { reload } = useShop();
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [mode, setMode] = useState<"PRIVATE" | "HYBRID">("PRIVATE");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/connexion");
  }, [authLoading, user, router]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await api.post("/shops", { name: nom, mode });
      reload();
      router.push("/caisse");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Création impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>Créer votre boutique</h1>
      <p className={styles.sousTitre}>
        Trois mois gratuits démarrent dès maintenant. Vous pourrez changer de mode plus tard.
      </p>

      <form onSubmit={creer}>
        {erreur && <div className={styles.erreur}>{erreur}</div>}

        <div className={styles.champ}>
          <label htmlFor="nom">Nom de la boutique</label>
          <input
            id="nom"
            type="text"
            placeholder="Ex. Chez Kadiata"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            minLength={2}
          />
        </div>

        <div className={styles.modes}>
          {MODES.map((m) => (
            <button
              key={m.valeur}
              type="button"
              className={`${styles.modeBouton} ${mode === m.valeur ? styles.modeBoutonActif : ""}`}
              onClick={() => setMode(m.valeur)}
            >
              <strong>{m.titre}</strong>
              <span>{m.description}</span>
            </button>
          ))}
        </div>

        <button className={styles.bouton} type="submit" disabled={enCours || nom.length < 2}>
          {enCours ? "Création…" : "Créer ma boutique"}
        </button>
      </form>
    </div>
  );
}
