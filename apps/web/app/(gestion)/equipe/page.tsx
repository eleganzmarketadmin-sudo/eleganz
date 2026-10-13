"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface MembreEquipe {
  id: string;
  role: string;
  active: boolean;
  user: { id: string; fullName: string; email?: string | null; phone?: string | null };
}

const ROLES = [
  { valeur: "MANAGER", label: "Gérant" },
  { valeur: "CASHIER", label: "Caissier" },
  { valeur: "STOCK_KEEPER", label: "Magasinier" },
  { valeur: "SALES_LEAD", label: "Responsable commercial" },
  { valeur: "ACCOUNTANT", label: "Comptable" },
  // Accès restreint à Finance & Comptabilité en lecture seule — voir
  // docs/ARCHITECTURE_FINANCE.md §8sexies. Jamais d'accès à la Caisse, au
  // Catalogue, aux Commandes, à l'Équipe ou aux Paramètres.
  { valeur: "EXTERNAL_ACCOUNTANT", label: "Comptable externe (lecture seule)" },
] as const;

const LABELS_ROLE: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gérant",
  CASHIER: "Caissier",
  STOCK_KEEPER: "Magasinier",
  SALES_LEAD: "Responsable commercial",
  ACCOUNTANT: "Comptable",
  EXTERNAL_ACCOUNTANT: "Comptable externe (lecture seule)",
};

function EquipeContent() {
  const { currentShop } = useShop();
  const [membres, setMembres] = useState<MembreEquipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [identifiant, setIdentifiant] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["valeur"]>("CASHIER");
  const [invitationEnCours, setInvitationEnCours] = useState(false);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<MembreEquipe[]>(`/shops/${currentShop.id}/staff`)
      .then(setMembres)
      .catch((err) =>
        setErreur(
          err instanceof ApiError && err.statusCode === 403
            ? "Cette page est réservée au propriétaire ou au gérant de la boutique."
            : err instanceof Error
              ? err.message
              : "Erreur.",
        ),
      )
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop || !identifiant) return;
    setInvitationEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/staff`, { identifier: identifiant, role });
      setIdentifiant("");
      setConfirmation("Collaborateur ajouté à l'équipe.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Invitation impossible.");
    } finally {
      setInvitationEnCours(false);
    }
  }

  async function retirer(staffId: string) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/staff/${staffId}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Équipe</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.formulaire} onSubmit={inviter}>
        <div className={styles.champ}>
          <label htmlFor="identifiant">Email ou téléphone du collaborateur</label>
          <input
            id="identifiant"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="deja-inscrit@exemple.com"
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="role">Rôle</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLES.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={invitationEnCours || !identifiant}>
          {invitationEnCours ? "Ajout…" : "Ajouter à l'équipe"}
        </button>
      </form>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "24px" }}>
        Le collaborateur doit déjà avoir créé son propre compte ELEGANZ avant de pouvoir être
        ajouté — il peut s&apos;inscrire depuis la page de connexion.
      </p>

      {chargement ? (
        <p>Chargement de l&apos;équipe…</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contact</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => (
              <tr key={m.id}>
                <td>{m.user.fullName}</td>
                <td>{m.user.email ?? m.user.phone ?? "—"}</td>
                <td>{LABELS_ROLE[m.role] ?? m.role}</td>
                <td>{m.active ? "Actif" : "Désactivé"}</td>
                <td>
                  {m.role !== "OWNER" && m.active && (
                    <button className={styles.retirer} onClick={() => retirer(m.id)}>
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EquipePage() {
  return (
    <ProtectedGestionPage>
      <EquipeContent />
    </ProtectedGestionPage>
  );
}
