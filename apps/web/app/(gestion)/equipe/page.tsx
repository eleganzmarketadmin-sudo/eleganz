"use client";

import { Fragment, useEffect, useState } from "react";
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
  // Écrans de menu effectivement accordés (16 oct. 2026, point 2 des
  // propositions du 16 oct. 2026) — calculés côté API
  // (ShopsService.ecransEffectifs), jamais recalculés ici.
  menuItems: string[];
}

// Écrans de menu Gestion disponibles (mêmes clés que MenuGestion côté API
// et que GestionShell.LIENS) — 16 oct. 2026, point 2 des propositions du 16
// oct. 2026 : "donner les options de choix des menus pour le profil créé ou
// équipier".
const ECRANS_MENU = [
  { valeur: "CAISSE", cle: "nav_caisse" },
  { valeur: "TABLEAU_DE_BORD", cle: "nav_tableauDeBord" },
  { valeur: "CATALOGUE", cle: "nav_catalogue" },
  { valeur: "COMMANDES", cle: "nav_commandes" },
  { valeur: "FACTURES", cle: "nav_mesFactures" },
  { valeur: "RELEVES", cle: "nav_releves" },
  { valeur: "LITIGES", cle: "nav_litiges" },
  { valeur: "FINANCE", cle: "nav_finance" },
  { valeur: "LIVREURS", cle: "nav_livreurs" },
  { valeur: "MESSAGERIE", cle: "nav_messagerie" },
  { valeur: "EQUIPE", cle: "nav_equipe" },
  { valeur: "PARAMETRES", cle: "nav_parametres" },
] as const;

const TOUS_LES_ECRANS = ECRANS_MENU.map((e) => e.valeur);

// Simple pré-remplissage côté écran, pour proposer des cases déjà cochées
// à l'invitation — la vraie valeur par défaut (si rien n'est envoyé) reste
// calculée côté API par ShopsService.menuGestionParDefaut ; ce tableau ne
// fait que refléter la même logique pour l'affichage.
function ecransParDefaut(role: string): string[] {
  switch (role) {
    case "MANAGER":
      return TOUS_LES_ECRANS;
    case "CASHIER":
      return ["CAISSE", "TABLEAU_DE_BORD"];
    case "STOCK_KEEPER":
      return ["CATALOGUE", "COMMANDES", "LIVREURS"];
    case "SALES_LEAD":
      return ["CAISSE", "TABLEAU_DE_BORD", "CATALOGUE", "COMMANDES", "LITIGES", "MESSAGERIE"];
    case "ACCOUNTANT":
      return ["FINANCE", "FACTURES", "RELEVES"];
    case "EXTERNAL_ACCOUNTANT":
      return ["FINANCE"];
    default:
      return [];
  }
}

// --- Module Experts (16 oct. 2026, point 2) ---------------------------
interface InviteExpert {
  id: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  scopes: string[];
  expiresAt: string;
}

interface EngagementExpert {
  id: string;
  status: "ACTIVE" | "REVOKED";
  scopes: string[];
  expertProfile: { id: string; headline: string; user: { fullName: string; email?: string | null; phone?: string | null } };
}

const SCOPES_EXPERT = [
  { valeur: "FINANCE", cle: "experts_scopeFinance" },
  { valeur: "COMMANDES", cle: "experts_scopeCommandes" },
  { valeur: "CATALOGUE", cle: "experts_scopeCatalogue" },
] as const;

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
  const [menuItemsChoisis, setMenuItemsChoisis] = useState<string[]>(ecransParDefaut("CASHIER"));
  const [invitationEnCours, setInvitationEnCours] = useState(false);

  // Édition d'un profil déjà actif (16 oct. 2026, point 2 des propositions
  // du 16 oct. 2026) — n'existait pas avant (seules l'invitation et la
  // suppression). `editionId` = le membre actuellement ouvert en édition.
  const [editionId, setEditionId] = useState<string | null>(null);
  const [roleEdite, setRoleEdite] = useState<string>("CASHIER");
  const [menuItemsEdites, setMenuItemsEdites] = useState<string[]>([]);
  const [modificationEnCours, setModificationEnCours] = useState(false);

  function basculerMenuItem(valeur: string, liste: string[], definir: (v: string[]) => void) {
    definir(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]);
  }

  function ouvrirEdition(m: MembreEquipe) {
    setEditionId(m.id);
    setRoleEdite(m.role);
    setMenuItemsEdites(m.menuItems);
    setErreur(null);
  }

  async function enregistrerEdition() {
    if (!currentShop || !editionId) return;
    setModificationEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/staff/${editionId}`, {
        role: roleEdite,
        menuItems: menuItemsEdites,
      });
      setEditionId(null);
      setConfirmation(t("eq_modificationEnregistree"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("eq_modificationImpossible"));
    } finally {
      setModificationEnCours(false);
    }
  }

  const [invitesExpert, setInvitesExpert] = useState<InviteExpert[]>([]);
  const [engagementsExpert, setEngagementsExpert] = useState<EngagementExpert[]>([]);
  const [scopesChoisis, setScopesChoisis] = useState<string[]>(["FINANCE"]);
  const [creationInviteEnCours, setCreationInviteEnCours] = useState(false);
  const [lienInviteGenere, setLienInviteGenere] = useState<string | null>(null);
  const [erreurExperts, setErreurExperts] = useState<string | null>(null);

  const peutGererExperts = currentShop?.myRole === "OWNER" || currentShop?.myRole === "MANAGER";

  function rechargerExperts() {
    if (!currentShop) return;
    api
      .get<EngagementExpert[]>(`/shops/${currentShop.id}/experts`)
      .then(setEngagementsExpert)
      .catch(() => setEngagementsExpert([]));
    if (peutGererExperts) {
      api
        .get<InviteExpert[]>(`/shops/${currentShop.id}/experts/invitations`)
        .then(setInvitesExpert)
        .catch(() => setInvitesExpert([]));
    }
  }

  useEffect(rechargerExperts, [currentShop, peutGererExperts]);

  async function creerInviteExpert() {
    if (!currentShop || scopesChoisis.length === 0) return;
    setCreationInviteEnCours(true);
    setErreurExperts(null);
    setLienInviteGenere(null);
    try {
      const invite = await api.post<InviteExpert>(`/shops/${currentShop.id}/experts/invitations`, { scopes: scopesChoisis });
      setLienInviteGenere(`${window.location.origin}/marketplace/experts/invitations/${invite.token}`);
      rechargerExperts();
    } catch (err) {
      setErreurExperts(err instanceof ApiError ? err.message : t("eq_invitationImpossible"));
    } finally {
      setCreationInviteEnCours(false);
    }
  }

  async function revoquerInviteExpert(inviteId: string) {
    if (!currentShop) return;
    try {
      await api.delete(`/shops/${currentShop.id}/experts/invitations/${inviteId}`);
      rechargerExperts();
    } catch (err) {
      setErreurExperts(err instanceof ApiError ? err.message : t("eq_suppressionImpossible"));
    }
  }

  async function revoquerEngagementExpert(engagementId: string) {
    if (!currentShop) return;
    try {
      await api.delete(`/shops/${currentShop.id}/experts/${engagementId}`);
      rechargerExperts();
    } catch (err) {
      setErreurExperts(err instanceof ApiError ? err.message : t("eq_suppressionImpossible"));
    }
  }

  function basculerScope(valeur: string) {
    setScopesChoisis((actuel) => (actuel.includes(valeur) ? actuel.filter((s) => s !== valeur) : [...actuel, valeur]));
  }

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
      await api.post(`/shops/${currentShop.id}/staff`, { identifier: identifiant, role, menuItems: menuItemsChoisis });
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
          <select
            id="role"
            value={role}
            onChange={(e) => {
              const nouveauRole = e.target.value as typeof role;
              setRole(nouveauRole);
              setMenuItemsChoisis(ecransParDefaut(nouveauRole));
            }}
          >
            {ROLES.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {t(r.cle)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label>{t("eq_labelEcransMenu")}</label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {ECRANS_MENU.map((ecran) => (
              <label key={ecran.valeur} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={menuItemsChoisis.includes(ecran.valeur)}
                  onChange={() => basculerMenuItem(ecran.valeur, menuItemsChoisis, setMenuItemsChoisis)}
                />
                {t(ecran.cle)}
              </label>
            ))}
          </div>
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
              <th>{t("eq_colEcrans")}</th>
              <th>{t("eq_colStatut")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => (
              <Fragment key={m.id}>
                <tr>
                  <td>{m.user.fullName}</td>
                  <td>{m.user.email ?? m.user.phone ?? "—"}</td>
                  <td>{CLES_ROLE[m.role] ? t(CLES_ROLE[m.role]) : m.role}</td>
                  <td>
                    {m.menuItems.length === ECRANS_MENU.length
                      ? t("eq_ecransTous")
                      : m.menuItems.map((e) => t(ECRANS_MENU.find((x) => x.valeur === e)?.cle ?? e)).join(", ") || "—"}
                  </td>
                  <td>{m.active ? t("eq_statutActif") : t("eq_statutDesactive")}</td>
                  <td style={{ display: "flex", gap: "8px" }}>
                    {m.role !== "OWNER" && m.active && (
                      <button className={styles.bouton} type="button" onClick={() => ouvrirEdition(m)}>
                        {t("eq_modifier")}
                      </button>
                    )}
                    {m.role !== "OWNER" && m.active && (
                      <button className={styles.retirer} onClick={() => retirer(m.id)}>
                        {t("eq_retirer")}
                      </button>
                    )}
                  </td>
                </tr>
                {editionId === m.id && (
                  <tr>
                    <td colSpan={6}>
                      <div className={styles.champ}>
                        <label>{t("eq_labelRole")}</label>
                        <select value={roleEdite} onChange={(e) => setRoleEdite(e.target.value)}>
                          {ROLES.map((r) => (
                            <option key={r.valeur} value={r.valeur}>
                              {t(r.cle)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.champ}>
                        <label>{t("eq_labelEcransMenu")}</label>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          {ECRANS_MENU.map((ecran) => (
                            <label key={ecran.valeur} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <input
                                type="checkbox"
                                checked={menuItemsEdites.includes(ecran.valeur)}
                                onChange={() => basculerMenuItem(ecran.valeur, menuItemsEdites, setMenuItemsEdites)}
                              />
                              {t(ecran.cle)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "var(--espace-3)" }}>
                        <button
                          className={styles.bouton}
                          type="button"
                          disabled={modificationEnCours}
                          onClick={enregistrerEdition}
                        >
                          {modificationEnCours ? t("eq_modificationEnCours") : t("action_enregistrer")}
                        </button>
                        <button
                          className={styles.bouton}
                          type="button"
                          onClick={() => setEditionId(null)}
                          style={{ background: "var(--color-texte-muted)" }}
                        >
                          {t("action_annuler")}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Module Experts (16 oct. 2026, point 2) — lien d'invitation avec */}
      {/* périmètres choisis au cas par cas, et liste des accès en cours. */}
      <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid var(--color-border)" }}>
        <h2 style={{ marginBottom: "8px" }}>{t("experts_titreEquipe")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
          {t("experts_sousTitreEquipe")}
        </p>

        {erreurExperts && <div className={styles.erreur}>{erreurExperts}</div>}

        {peutGererExperts && (
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontWeight: 600, marginBottom: "8px" }}>{t("experts_choisirPerimetres")}</p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
              {SCOPES_EXPERT.map((s) => (
                <label key={s.valeur} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={scopesChoisis.includes(s.valeur)}
                    onChange={() => basculerScope(s.valeur)}
                  />
                  {t(s.cle)}
                </label>
              ))}
            </div>
            <button
              className={styles.bouton}
              onClick={creerInviteExpert}
              disabled={creationInviteEnCours || scopesChoisis.length === 0}
            >
              {creationInviteEnCours ? t("experts_generationEnCours") : t("experts_genererLien")}
            </button>
            {lienInviteGenere && (
              <p style={{ marginTop: "12px", wordBreak: "break-all" }}>
                <code>{lienInviteGenere}</code>
              </p>
            )}

            {invitesExpert.filter((i) => i.status === "PENDING").length > 0 && (
              <table className={styles.tableau} style={{ marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th>{t("experts_colPerimetres")}</th>
                    <th>{t("experts_colExpiration")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitesExpert
                    .filter((i) => i.status === "PENDING")
                    .map((i) => (
                      <tr key={i.id}>
                        <td>{i.scopes.join(", ")}</td>
                        <td>{new Date(i.expiresAt).toLocaleDateString()}</td>
                        <td>
                          <button className={styles.retirer} onClick={() => revoquerInviteExpert(i.id)}>
                            {t("eq_retirer")}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p style={{ fontWeight: 600, marginBottom: "8px" }}>{t("experts_accesEnCours")}</p>
        {engagementsExpert.filter((e) => e.status === "ACTIVE").length === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("experts_aucunAcces")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("eq_colNom")}</th>
                <th>{t("eq_colContact")}</th>
                <th>{t("experts_colPerimetres")}</th>
                {peutGererExperts && <th></th>}
              </tr>
            </thead>
            <tbody>
              {engagementsExpert
                .filter((e) => e.status === "ACTIVE")
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.expertProfile.user.fullName}</td>
                    <td>{e.expertProfile.user.email ?? e.expertProfile.user.phone ?? "—"}</td>
                    <td>{e.scopes.join(", ")}</td>
                    {peutGererExperts && (
                      <td>
                        <button className={styles.retirer} onClick={() => revoquerEngagementExpert(e.id)}>
                          {t("eq_retirer")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
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
