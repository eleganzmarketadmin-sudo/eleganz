"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface UtilisateurListe {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  isSuspended: boolean;
  createdAt: string;
}

interface UtilisateurDetail extends UtilisateurListe {
  ownedShops: { id: string; name: string; status: string }[];
  shopMemberships: { role: string; shop: { id: string; name: string } }[];
  _count: { orders: number; reviews: number };
}

const LABELS_ROLE: Record<string, string> = {
  BUYER: "Acheteur",
  SHOP_OWNER: "Propriétaire de boutique",
  SHOP_STAFF: "Staff de boutique",
  DRIVER: "Livreur",
  ADMIN_SUPER: "Super administrateur",
  ADMIN_SALES: "Admin — Ventes",
  ADMIN_FINANCE: "Admin — Finance",
  ADMIN_OPS: "Admin — Opérations",
  ADMIN_LOGISTICS: "Admin — Logistique",
  ADMIN_MARKETING: "Admin — Marketing",
  ADMIN_SUPPORT: "Admin — Support",
  ADMIN_AUDITOR: "Admin — Audit",
};

function UtilisateursContent() {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<UtilisateurListe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [selectionne, setSelectionne] = useState<UtilisateurDetail | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [motDePasseGenere, setMotDePasseGenere] = useState<string | null>(null);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");

  function rechercher() {
    setChargement(true);
    setErreur(null);
    api
      .get<UtilisateurListe[]>(`/admin/users${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`)
      .then(setResultats)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(rechercher, []);

  async function ouvrir(userId: string) {
    setChargementDetail(true);
    setMotDePasseGenere(null);
    setNouveauMotDePasse("");
    setErreur(null);
    try {
      const detail = await api.get<UtilisateurDetail>(`/admin/users/${userId}`);
      setSelectionne(detail);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger ce compte.");
    } finally {
      setChargementDetail(false);
    }
  }

  async function reinitialiserMotDePasse() {
    if (!selectionne) return;
    setEnCours("reset");
    setErreur(null);
    setMotDePasseGenere(null);
    try {
      const resultat = await api.post<{ motDePasseTemporaire?: string }>(
        `/admin/users/${selectionne.id}/reset-password`,
        nouveauMotDePasse ? { newPassword: nouveauMotDePasse } : {},
      );
      setMotDePasseGenere(
        resultat.motDePasseTemporaire ?? "Mot de passe mis à jour avec la valeur fournie.",
      );
      setNouveauMotDePasse("");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Réinitialisation impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function basculerSuspension() {
    if (!selectionne) return;
    setEnCours("suspension");
    setErreur(null);
    try {
      const action = selectionne.isSuspended ? "reactivate" : "suspend";
      const utilisateur = await api.post<UtilisateurDetail>(`/admin/users/${selectionne.id}/${action}`);
      setSelectionne({ ...selectionne, isSuspended: utilisateur.isSuspended });
      rechercher();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Utilisateurs</h1>
      <p className={styles.sousTitre}>
        Retrouvez un compte (acheteur, vendeur ou staff) pour réinitialiser son mot de passe,
        consulter sa situation ou bloquer sa connexion en cas de souci.
      </p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <form
        className={styles.formRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          rechercher();
        }}
      >
        <input
          placeholder="Nom, email ou téléphone…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <button type="submit" className={styles.boutonRechercher}>
          Rechercher
        </button>
      </form>

      <div className={styles.disposition}>
        <div className={styles.liste}>
          {chargement ? (
            <p>Chargement…</p>
          ) : resultats.length === 0 ? (
            <p className={styles.messageVide}>Aucun compte ne correspond.</p>
          ) : (
            resultats.map((u) => (
              <button
                key={u.id}
                className={`${styles.ligneUtilisateur} ${selectionne?.id === u.id ? styles.ligneUtilisateurActive : ""}`}
                onClick={() => ouvrir(u.id)}
              >
                <span className={styles.nom}>{u.fullName}</span>
                <span className={styles.contact}>{u.email ?? u.phone ?? "—"}</span>
                <span className={styles.role}>{LABELS_ROLE[u.role] ?? u.role}</span>
                {u.isSuspended && <span className={styles.badgeSuspendu}>Suspendu</span>}
              </button>
            ))
          )}
        </div>

        <div className={styles.panneauDetail}>
          {chargementDetail ? (
            <p>Chargement du compte…</p>
          ) : !selectionne ? (
            <p className={styles.messageVide}>Sélectionnez un compte dans la liste.</p>
          ) : (
            <>
              <h2 className={styles.nomDetail}>{selectionne.fullName}</h2>
              <p className={styles.contactDetail}>
                {selectionne.email ?? "—"} · {selectionne.phone ?? "—"}
              </p>
              <p className={styles.roleDetail}>
                {LABELS_ROLE[selectionne.role] ?? selectionne.role}
                {selectionne.isSuspended && <span className={styles.badgeSuspendu}> — Suspendu</span>}
              </p>

              {selectionne.ownedShops.length > 0 && (
                <div className={styles.blocInfo}>
                  <strong>Boutiques possédées</strong>
                  <ul>
                    {selectionne.ownedShops.map((s) => (
                      <li key={s.id}>
                        {s.name} ({s.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectionne.shopMemberships.length > 0 && (
                <div className={styles.blocInfo}>
                  <strong>Membre de l&apos;équipe de</strong>
                  <ul>
                    {selectionne.shopMemberships.map((m, i) => (
                      <li key={i}>
                        {m.shop.name} — {m.role}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.blocInfo}>
                <strong>Activité</strong>
                <p>
                  {selectionne._count.orders} commande(s) Marketplace · {selectionne._count.reviews}{" "}
                  avis déposé(s)
                </p>
              </div>

              <div className={styles.section}>
                <strong>Réinitialiser le mot de passe</strong>
                <p className={styles.note}>
                  Laissez vide pour générer un mot de passe temporaire à communiquer vous-même à la
                  personne, ou saisissez-en un précis.
                </p>
                <div className={styles.ligneAction}>
                  <input
                    type="text"
                    placeholder="Nouveau mot de passe (optionnel)"
                    value={nouveauMotDePasse}
                    onChange={(e) => setNouveauMotDePasse(e.target.value)}
                  />
                  <button
                    className={styles.boutonAction}
                    onClick={reinitialiserMotDePasse}
                    disabled={enCours === "reset"}
                  >
                    {enCours === "reset" ? "…" : "Réinitialiser"}
                  </button>
                </div>
                {motDePasseGenere && (
                  <p className={styles.motDePasseResultat}>
                    Nouveau mot de passe : <code>{motDePasseGenere}</code> — communiquez-le à la
                    personne maintenant, il ne sera plus affiché ensuite.
                  </p>
                )}
              </div>

              <div className={styles.section}>
                <strong>Accès au compte</strong>
                <p className={styles.note}>
                  {selectionne.isSuspended
                    ? "La connexion de ce compte est actuellement bloquée."
                    : "Bloque la connexion sans supprimer aucune donnée — utile en cas de litige ou d'abus signalé."}
                </p>
                <button
                  className={selectionne.isSuspended ? styles.boutonReactiver : styles.boutonSuspendre}
                  onClick={basculerSuspension}
                  disabled={enCours === "suspension"}
                >
                  {enCours === "suspension"
                    ? "…"
                    : selectionne.isSuspended
                      ? "Réactiver le compte"
                      : "Suspendre le compte"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUtilisateursPage() {
  return (
    <AdminShell>
      <UtilisateursContent />
    </AdminShell>
  );
}
