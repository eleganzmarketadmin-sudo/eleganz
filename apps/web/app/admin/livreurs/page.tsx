"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface Livreur {
  id: string;
  zone: string | null;
  verified: boolean;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  licenseNumber: string | null;
  idDocumentNumber: string | null;
  adminNote: string | null;
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
    isSuspended: boolean;
  };
  _count: { deliveries: number };
}

interface ComportementLivreur {
  livreurId: string;
  totalLivraisons: number;
  livrees: number;
  tauxLitigePct: number;
  delaiMoyenLivraisonHeures: number | null;
}

const LABELS_VEHICULE: Record<string, string> = {
  PIED: "À pied",
  VELO: "Vélo",
  MOTO: "Moto",
  VOITURE: "Voiture",
};

/**
 * Centre de gestion des partenaires livreurs (prompt §10 et §37, enrichi le
 * 13 oct. 2026) — dossier complet (identité, véhicule) à instruire avant de
 * valider la souscription, et suivi stats/SLA par livreur (point 3 du même
 * jour), fusionné depuis /admin/supervision/livreurs pour que la vérification
 * et le suivi se fassent au même endroit. Un livreur créé par
 * auto-inscription n'est jamais vérifié par défaut — assignDriver() refuse
 * toute affectation de mission à un livreur non vérifié.
 */
function LivreursContent() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [stats, setStats] = useState<Record<string, ComportementLivreur>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function recharger() {
    Promise.all([
      api.get<Livreur[]>("/delivery/drivers"),
      api.get<ComportementLivreur[]>("/admin/supervision/livreurs"),
    ])
      .then(([listeLivreurs, listeStats]) => {
        setLivreurs(listeLivreurs);
        setStats(Object.fromEntries(listeStats.map((s) => [s.livreurId, s])));
        setNotes(Object.fromEntries(listeLivreurs.map((l) => [l.id, l.adminNote ?? ""])));
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function basculerVerification(driverId: string, verified: boolean) {
    setEnCours(driverId);
    setErreur(null);
    try {
      await api.post(`/delivery/drivers/${driverId}/verify`, { verified });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function enregistrerNote(driverId: string) {
    setEnCours(driverId);
    setErreur(null);
    try {
      await api.post(`/delivery/drivers/${driverId}/note`, { adminNote: notes[driverId] ?? "" });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement de la note impossible.");
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement des livreurs…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Livreurs</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {livreurs.length === 0 ? (
        <p className={styles.messageVide}>Aucun livreur inscrit pour l&apos;instant.</p>
      ) : (
        livreurs.map((l) => {
          const s = stats[l.id];
          return (
            <div className={styles.boutique} key={l.id}>
              <div className={styles.entete}>
                <div>
                  <span className={styles.nom}>{l.user.fullName}</span>
                  <span className={`${styles.statut} ${!l.verified ? styles.statutSuspendu : ""}`}>
                    {l.verified ? "Vérifié" : "Non vérifié"}
                  </span>
                </div>
                <span className={styles.date}>Inscrit le {formatDate(l.user.createdAt)}</span>
              </div>
              <div className={styles.corps}>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Compte</span>
                  <span>{l.user.email ?? l.user.phone}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Téléphone livraison</span>
                  <span>{l.phone ?? "Non renseigné"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>WhatsApp</span>
                  <span>{l.whatsapp ?? "Non renseigné"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Adresse</span>
                  <span>{l.address ?? "Non renseignée"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Zone</span>
                  <span>{l.zone ?? "Non précisée"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Véhicule</span>
                  <span>{l.vehicleType ? LABELS_VEHICULE[l.vehicleType] ?? l.vehicleType : "Non renseigné"}</span>
                </div>
                {l.vehiclePlate && (
                  <div className={styles.champInfo}>
                    <span className={styles.champLabel}>Plaque</span>
                    <span>{l.vehiclePlate}</span>
                  </div>
                )}
                {l.licenseNumber && (
                  <div className={styles.champInfo}>
                    <span className={styles.champLabel}>Permis de conduire</span>
                    <span>{l.licenseNumber}</span>
                  </div>
                )}
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Pièce d&apos;identité</span>
                  <span>{l.idDocumentNumber ?? "Non renseignée"}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Livraisons</span>
                  <span>{l._count.deliveries} au total{s ? ` · ${s.livrees} livrées · ${s.tauxLitigePct}% de litige` : ""}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>Délai moyen de livraison</span>
                  <span>
                    {s?.delaiMoyenLivraisonHeures != null
                      ? `${s.delaiMoyenLivraisonHeures} h (enlèvement → livraison déclarée)`
                      : "Pas encore mesurable"}
                  </span>
                </div>
              </div>
              <div className={styles.corps} style={{ paddingTop: 0 }}>
                <div className={styles.champInfo} style={{ gridColumn: "1 / -1" }}>
                  <span className={styles.champLabel}>Note d&apos;instruction (interne, jamais visible du livreur)</span>
                  <textarea
                    value={notes[l.id] ?? ""}
                    onChange={(e) => setNotes((v) => ({ ...v, [l.id]: e.target.value }))}
                    rows={2}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
                    placeholder="Ex. pièce d'identité illisible, à redemander"
                  />
                  <button
                    className={styles.boutonReactiver}
                    style={{ marginTop: "8px", width: "fit-content" }}
                    disabled={enCours === l.id}
                    onClick={() => enregistrerNote(l.id)}
                  >
                    Enregistrer la note
                  </button>
                </div>
              </div>
              <div className={styles.actions}>
                {l.verified ? (
                  <button
                    className={styles.boutonSuspendre}
                    disabled={enCours === l.id}
                    onClick={() => basculerVerification(l.id, false)}
                  >
                    Retirer la vérification
                  </button>
                ) : (
                  <button
                    className={styles.boutonReactiver}
                    disabled={enCours === l.id}
                    onClick={() => basculerVerification(l.id, true)}
                  >
                    Vérifier ce livreur
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function AdminLivreursPage() {
  return (
    <AdminShell>
      <LivreursContent />
    </AdminShell>
  );
}
