"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface MembreEquipe {
  id: string;
  role: string;
  active: boolean;
  user: { id: string; fullName: string; email?: string | null; phone?: string | null };
}

const ROLES = [
  { valeur: "MANAGER", cle: "eq_roleGerant" },
  { valeur: "CASHIER", cle: "eq_roleCaissier" },
  { valeur: "STOCK_KEEPER", cle: "eq_roleMagasinier" },
  { valeur: "SALES_LEAD", cle: "eq_roleResponsableCommercial" },
  { valeur: "ACCOUNTANT", cle: "eq_roleComptable" },
  // Accès restreint à Finance & Comptabilité en lecture seule — voir
  // docs/ARCHITECTURE_FINANCE.md §8sexies. Jamais d'accès à la Caisse, au
  // Catalogue, aux Commandes, à l'Équipe ou aux Paramètres.
  { valeur: "EXTERNAL_ACCOUNTANT", cle: "eq_roleComptableExterne" },
] as const;

const CLES_ROLE: Record<string, string> = {
  OWNER: "eq_roleProprietaire",
  MANAGER: "eq_roleGerant",
  CASHIER: "eq_roleCaissier",
  STOCK_KEEPER: "eq_roleMagasinier",
  SALES_LEAD: "eq_roleResponsableCommercial",
  ACCOUNTANT: "eq_roleComptable",
  EXTERNAL_ACCOUNTANT: "eq_roleComptableExterne",
};

function EquipeContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
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
            ? t("eq_reserveRole")
            : err instanceof Error
              ? err.message
              : t("cmd_erreurGenerique"),
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
      setConfirmation(t("eq_collaborateurAjoute"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("eq_invitationImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("eq_suppressionImpossible"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_equipe")}</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.formulaire} onSubmit={inviter}>
        <div className={styles.champ}>
          <label htmlFor="identifiant">{t("eq_labelContact")}</label>
          <input
            id="identifiant"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="deja-inscrit@exemple.com"
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="role">{t("eq_labelRole")}</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLES.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {t(r.cle)}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={invitationEnCours || !identifiant}>
          {invitationEnCours ? t("eq_ajoutEnCours") : t("eq_ajouterEquipe")}
        </button>
      </form>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "24px" }}>{t("eq_noteInscriptionPrealable")}</p>

      {chargement ? (
        <p>{t("eq_chargementEquipe")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("eq_colNom")}</th>
              <th>{t("eq_colContact")}</th>
              <th>{t("eq_colRole")}</th>
              <th>{t("eq_colStatut")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => (
              <tr key={m.id}>
                <td>{m.user.fullName}</td>
                <td>{m.user.email ?? m.user.phone ?? "—"}</td>
                <td>{CLES_ROLE[m.role] ? t(CLES_ROLE[m.role]) : m.role}</td>
                <td>{m.active ? t("eq_statutActif") : t("eq_statutDesactive")}</td>
                <td>
                  {m.role !== "OWNER" && m.active && (
                    <button className={styles.retirer} onClick={() => retirer(m.id)}>
                      {t("eq_retirer")}
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
