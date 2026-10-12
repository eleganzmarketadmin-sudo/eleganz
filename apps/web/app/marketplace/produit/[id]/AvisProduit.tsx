"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth";
import { api, ApiError } from "../../../lib/api";
import styles from "./AvisProduit.module.css";

interface Avis {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  auteur: string;
}

interface ReponseAvis {
  moyenne: number;
  total: number;
  avis: Avis[];
}

function Etoiles({ note, onChange }: { note: number; onChange?: (n: number) => void }) {
  return (
    <span className={styles.etoiles}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={styles.etoileBouton}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} étoile(s)`}
          style={{ color: n <= note ? "var(--color-or)" : "var(--color-border)" }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/**
 * Avis d'un article précis, affichés sur sa fiche produit (prompt du 12 oct.
 * 2026). N'importe quel acheteur connecté peut laisser un avis rapide ici —
 * sans badge "achat vérifié" puisqu'aucune commande précise n'est
 * sélectionnée ; un avis vérifié se laisse plutôt depuis "Mes commandes",
 * rattaché à l'achat réel.
 */
export function AvisProduit({ shopId, productId }: { shopId: string; productId: string }) {
  const { user } = useAuth();
  const [donnees, setDonnees] = useState<ReponseAvis | null>(null);
  const [noteChoisie, setNoteChoisie] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  function recharger() {
    api
      .get<ReponseAvis>(`/marketplace/shops/${shopId}/reviews?productId=${productId}`, false)
      .then(setDonnees)
      .catch(() => setDonnees({ moyenne: 0, total: 0, avis: [] }));
  }

  useEffect(recharger, [shopId, productId]);

  async function envoyer() {
    if (!noteChoisie) {
      setErreur("Choisissez une note avant d'envoyer.");
      return;
    }
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.post(`/marketplace/shops/${shopId}/reviews`, {
        productId,
        rating: noteChoisie,
        comment: commentaire.trim() || undefined,
      });
      setNoteChoisie(0);
      setCommentaire("");
      setAfficherFormulaire(false);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "L'avis n'a pas pu être envoyé.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (!donnees) return null;

  return (
    <div className={styles.section}>
      <div className={styles.entete}>
        <h2 className={styles.titre}>Avis</h2>
        {donnees.total > 0 && (
          <span className={styles.moyenne}>
            <Etoiles note={Math.round(donnees.moyenne)} /> {donnees.moyenne}/5 ({donnees.total} avis)
          </span>
        )}
      </div>

      {donnees.total === 0 && <p className={styles.vide}>Aucun avis pour l&apos;instant.</p>}

      {donnees.avis.map((a) => (
        <div className={styles.avis} key={a.id}>
          <div className={styles.avisEntete}>
            <Etoiles note={a.rating} />
            <strong>{a.auteur}</strong>
            {a.verifiedPurchase && <span className={styles.badge}>Achat vérifié</span>}
          </div>
          {a.comment && <p className={styles.commentaire}>{a.comment}</p>}
        </div>
      ))}

      {user ? (
        afficherFormulaire ? (
          <div className={styles.formulaire}>
            <Etoiles note={noteChoisie} onChange={setNoteChoisie} />
            <textarea
              placeholder="Votre avis sur cet article (optionnel)"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
            />
            {erreur && <div className={styles.erreur}>{erreur}</div>}
            <div className={styles.actionsFormulaire}>
              <button className={styles.boutonEnvoyer} onClick={envoyer} disabled={envoiEnCours}>
                {envoiEnCours ? "Envoi…" : "Publier l'avis"}
              </button>
              <button className={styles.boutonAnnuler} onClick={() => setAfficherFormulaire(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.boutonOuvrir} onClick={() => setAfficherFormulaire(true)}>
            Laisser un avis
          </button>
        )
      ) : (
        <p className={styles.vide}>Connectez-vous pour laisser un avis.</p>
      )}
    </div>
  );
}
