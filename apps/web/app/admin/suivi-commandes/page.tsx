"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { StatusTag } from "../../components/StatusTag";
import styles from "./page.module.css";

interface CommandeEnCours {
  id: string;
  boutique: string;
  acheteur: string;
  statut: string;
  statutLabel: string;
  livreur: string | null;
  creeLe: string;
  depuisLe: string;
  heuresDansStatut: number;
  seuilHeures: number | null;
  enRetard: boolean;
  attentionImmediate: boolean;
}

interface ComportementBoutique {
  boutiqueId: string;
  boutique: string;
  totalCommandes: number;
  tauxAnnulationPct: number;
  tauxLitigePct: number;
  delaiMoyenAcceptationHeures: number | null;
}

interface ComportementLivreur {
  livreurId: string;
  nom: string;
  verifie: boolean;
  totalLivraisons: number;
  livrees: number;
  tauxLitigePct: number;
  delaiMoyenLivraisonHeures: number | null;
}

function formaterDuree(heures: number): string {
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 48) return `${heures.toFixed(1)} h`;
  return `${Math.round(heures / 24)} j`;
}

function SuiviCommandesContent() {
  const [commandes, setCommandes] = useState<CommandeEnCours[] | null>(null);
  const [boutiques, setBoutiques] = useState<ComportementBoutique[] | null>(null);
  const [livreurs, setLivreurs] = useState<ComportementLivreur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<CommandeEnCours[]>("/admin/supervision/commandes-en-cours"),
      api.get<ComportementBoutique[]>("/admin/supervision/boutiques"),
      api.get<ComportementLivreur[]>("/admin/supervision/livreurs"),
    ])
      .then(([c, b, l]) => {
        setCommandes(c);
        setBoutiques(b);
        setLivreurs(l);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Chargement impossible."))
      .finally(() => setChargement(false));
  }, []);

  const nombreEnRetard = commandes?.filter((c) => c.enRetard).length ?? 0;

  return (
    <div>
      <h1 className={styles.titre}>Suivi des commandes</h1>
      <p className={styles.sousTitre}>
        Toutes les commandes actives de la plateforme (caisse exclue, Marketplace uniquement), avec un
        repère de retard indicatif par étape, et le comportement des boutiques et des livreurs dans la
        durée.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement && <p>Chargement…</p>}

      {commandes && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>
            Commandes en cours ({commandes.length})
            {nombreEnRetard > 0 && (
              <span className={styles.compteurRetard}>{nombreEnRetard} en retard ou à traiter</span>
            )}
          </h2>
          {commandes.length === 0 ? (
            <p className={styles.vide}>Aucune commande active en ce moment.</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>Boutique</th>
                    <th>Acheteur</th>
                    <th>Statut</th>
                    <th>Livreur</th>
                    <th className={styles.colChiffre}>Temps dans l&apos;étape</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.boutique}</td>
                      <td>{c.acheteur}</td>
                      <td>
                        <StatusTag
                          label={c.statutLabel}
                          humeur={c.attentionImmediate ? "alerte" : c.enRetard ? "attente" : "neutre"}
                        />
                      </td>
                      <td>{c.livreur ?? "—"}</td>
                      <td className={styles.colChiffre}>
                        {formaterDuree(c.heuresDansStatut)}
                        {c.seuilHeures !== null && (
                          <span className={styles.seuil}> / seuil {formaterDuree(c.seuilHeures)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {boutiques && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>Comportement des boutiques</h2>
          {boutiques.length === 0 ? (
            <p className={styles.vide}>Aucune commande Marketplace enregistrée pour l&apos;instant.</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>Boutique</th>
                    <th className={styles.colChiffre}>Commandes</th>
                    <th className={styles.colChiffre}>Taux d&apos;annulation</th>
                    <th className={styles.colChiffre}>Taux de litige</th>
                    <th className={styles.colChiffre}>Délai moyen d&apos;acceptation</th>
                  </tr>
                </thead>
                <tbody>
                  {boutiques.map((b) => (
                    <tr key={b.boutiqueId}>
                      <td>{b.boutique}</td>
                      <td className={styles.colChiffre}>{b.totalCommandes}</td>
                      <td className={styles.colChiffre}>{b.tauxAnnulationPct}%</td>
                      <td className={styles.colChiffre}>{b.tauxLitigePct}%</td>
                      <td className={styles.colChiffre}>
                        {b.delaiMoyenAcceptationHeures !== null
                          ? formaterDuree(b.delaiMoyenAcceptationHeures)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.note}>
            Le délai d&apos;acceptation n&apos;est calculé que pour les commandes passées depuis la mise en
            place de ce suivi (12 octobre 2026) — « — » signifie pas encore de données.
          </p>
        </section>
      )}

      {livreurs && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>Comportement des livreurs</h2>
          {livreurs.length === 0 ? (
            <p className={styles.vide}>Aucune livraison assignée pour l&apos;instant.</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>Livreur</th>
                    <th>Vérifié</th>
                    <th className={styles.colChiffre}>Livraisons assignées</th>
                    <th className={styles.colChiffre}>Livrées</th>
                    <th className={styles.colChiffre}>Taux de litige</th>
                    <th className={styles.colChiffre}>Délai moyen de livraison</th>
                  </tr>
                </thead>
                <tbody>
                  {livreurs.map((l) => (
                    <tr key={l.livreurId}>
                      <td>{l.nom}</td>
                      <td>
                        <StatusTag label={l.verifie ? "Vérifié" : "Non vérifié"} humeur={l.verifie ? "paye" : "neutre"} />
                      </td>
                      <td className={styles.colChiffre}>{l.totalLivraisons}</td>
                      <td className={styles.colChiffre}>{l.livrees}</td>
                      <td className={styles.colChiffre}>{l.tauxLitigePct}%</td>
                      <td className={styles.colChiffre}>
                        {l.delaiMoyenLivraisonHeures !== null
                          ? formaterDuree(l.delaiMoyenLivraisonHeures)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function SuiviCommandesPage() {
  return (
    <AdminShell>
      <SuiviCommandesContent />
    </AdminShell>
  );
}
