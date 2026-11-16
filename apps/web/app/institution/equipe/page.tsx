"use client";

import { Fragment, useEffect, useState } from "react";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface MembreEquipeInstitution {
  id: string;
  role: string;
  active: boolean;
  user: { id: string; fullName: string; email?: string | null; phone?: string | null };
  // Écrans de menu effectivement accordés (16 nov. 2026, demande du
  // propriétaire, point 2) — calculés côté API
  // (InstitutionStaffService.ecransInstitutionEffectifs), jamais recalculés
  // ici ; mêmes conventions que l'équipe Gestion (apps/web/app/(gestion)/equipe).
  menuItems: string[];
}

// Écrans de menu institution disponibles (mêmes clés que MenuInstitution
// côté API et qu'InstitutionShell.LIENS) — 16 nov. 2026. RECEPTION couvre à
// la fois la liste des boutiques partenaires (/institution) et les
// candidatures numérotées (/institution/demandes) ; ANALYSE/RENDEZ_VOUS/
// MESSAGERIE/RAPPORTS/PARAMETRES n'ont pas encore d'écran dédié (Phase 2/3
// du chantier crédit PME) mais restent assignables dès maintenant, comme
// côté API (TOUS_LES_ECRANS_INSTITUTION).
const ECRANS_MENU = [
  { valeur: "RECEPTION", cle: "instEq_ecranReception" },
  { valeur: "ANALYSE", cle: "instEq_ecranAnalyse" },
  { valeur: "DECISIONS", cle: "inst_nav_decisions" },
  { valeur: "RENDEZ_VOUS", cle: "instEq_ecranRendezVous" },
  { valeur: "PRETS", cle: "inst_nav_prets" },
  { valeur: "MESSAGERIE", cle: "instEq_ecranMessagerie" },
  { valeur: "RAPPORTS", cle: "instEq_ecranRapports" },
  { valeur: "EQUIPE", cle: "inst_nav_equipe" },
  { valeur: "PARAMETRES", cle: "instEq_ecranParametres" },
] as const;

const TOUS_LES_ECRANS = ECRANS_MENU.map((e) => e.valeur);

// Pré-remplissage côté écran, pour proposer des cases déjà cochées à
// l'invitation — reflet de InstitutionStaffService.menuInstitutionParDefaut ;
// la vraie valeur par défaut (si rien n'est envoyé) reste calculée côté API.
function ecransParDefaut(role: string): string[] {
  switch (role) {
    case "GESTIONNAIRE_COMPTE":
      return ["RECEPTION", "ANALYSE", "DECISIONS", "RENDEZ_VOUS", "PRETS", "MESSAGERIE", "RAPPORTS"];
    case "ANALYSTE_CREDIT":
      return ["RECEPTION", "ANALYSE", "RENDEZ_VOUS", "MESSAGERIE"];
    case "CHARGE_CLIENTELE":
      return ["RECEPTION", "RENDEZ_VOUS", "MESSAGERIE", "DECISIONS"];
    case "COMPTABLE":
      return ["PRETS", "RAPPORTS"];
    default:
      return [];
  }
}

// ADMINISTRATEUR n'est jamais proposé à l'invitation (InviteInstitutionStaffDto
// l'exclut explicitement — un seul ADMINISTRATEUR par institution, créé à
// l'inscription/la création, jamais ajouté ensuite) — voir CLES_ROLE
// ci-dessous pour son seul usage ici, l'affichage de la ligne déjà existante.
const ROLES = [
  { valeur: "GESTIONNAIRE_COMPTE", cle: "instEq_roleGestionnaireCompte" },
  { valeur: "ANALYSTE_CREDIT", cle: "instEq_roleAnalysteCredit" },
  { valeur: "CHARGE_CLIENTELE", cle: "instEq_roleChargeClientele" },
  { valeur: "COMPTABLE", cle: "instEq_roleComptable" },
] as const;

const CLES_ROLE: Record<string, string> = {
  ADMINISTRATEUR: "instEq_roleAdministrateur",
  GESTIONNAIRE_COMPTE: "instEq_roleGestionnaireCompte",
  ANALYSTE_CREDIT: "instEq_roleAnalysteCredit",
  CHARGE_CLIENTELE: "instEq_roleChargeClientele",
  COMPTABLE: "instEq_roleComptable",
};

/**
 * Équipe de l'institution (16 nov. 2026, demande du propriétaire, point 2 :
 * "l'institution doit pouvoir comme dans Gestion créer les users et définir
 * les rôles et périmètre de fonction") — mirroring
 * apps/web/app/(gestion)/equipe/page.tsx (ShopsService côté Gestion), sans
 * le module Experts (propre à Gestion, sans équivalent institution).
 * Réservée à ADMINISTRATEUR/GESTIONNAIRE_COMPTE côté API
 * (InstitutionMembershipGuard + @InstitutionRoles) : un rôle non autorisé
 * reçoit un 403 sur le chargement de la liste, affiché via `eq_reserveRole`
 * ci-dessous, sans qu'il soit nécessaire de dupliquer la garde ici.
 */
function EquipeInstitutionContenu() {
  const { t } = useLocale();
  const [membres, setMembres] = useState<MembreEquipeInstitution[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [identifiant, setIdentifiant] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["valeur"]>("GESTIONNAIRE_COMPTE");
  const [menuItemsChoisis, setMenuItemsChoisis] = useState<string[]>(ecransParDefaut("GESTIONNAIRE_COMPTE"));
  const [invitationEnCours, setInvitationEnCours] = useState(false);

  const [editionId, setEditionId] = useState<string | null>(null);
  const [roleEdite, setRoleEdite] = useState<string>("GESTIONNAIRE_COMPTE");
  const [menuItemsEdites, setMenuItemsEdites] = useState<string[]>([]);
  const [modificationEnCours, setModificationEnCours] = useState(false);

  function basculerMenuItem(valeur: string, liste: string[], definir: (v: string[]) => void) {
    definir(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]);
  }

  function ouvrirEdition(m: MembreEquipeInstitution) {
    setEditionId(m.id);
    setRoleEdite(m.role);
    setMenuItemsEdites(m.menuItems);
    setErreur(null);
  }

  async function enregistrerEdition() {
    if (!editionId) return;
    setModificationEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/institution-portal/staff/${editionId}`, { role: roleEdite, menuItems: menuItemsEdites });
      setEditionId(null);
      setConfirmation(t("eq_modificationEnregistree"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("eq_modificationImpossible"));
    } finally {
      setModificationEnCours(false);
    }
  }

  function recharger() {
    setChargement(true);
    api
      .get<MembreEquipeInstitution[]>("/institution-portal/staff")
      .then(setMembres)
      .catch((err) =>
        setErreur(
          err instanceof ApiError && err.statusCode === 403
            ? t("instEq_reserveRole")
            : err instanceof Error
              ? err.message
              : t("inst_erreurChargement"),
        ),
      )
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    if (!identifiant) return;
    setInvitationEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post("/institution-portal/staff", { identifier: identifiant, role, menuItems: menuItemsChoisis });
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
    setErreur(null);
    try {
      await api.delete(`/institution-portal/staff/${staffId}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("eq_suppressionImpossible"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_nav_equipe")}</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.carte} onSubmit={inviter}>
        <div className={styles.formulaire} style={{ marginBottom: "var(--espace-3)" }}>
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("eq_labelContact")}</label>
            <input id="identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="deja-inscrit@exemple.com" />
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
        </div>
        <div className={styles.champ} style={{ marginBottom: "var(--espace-3)" }}>
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
      <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", margin: "var(--espace-3) 0 var(--espace-5)" }}>
        {t("eq_noteInscriptionPrealable")}
      </p>

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("eq_colNom")}</th>
              <th>{t("eq_colContact")}</th>
              <th>{t("eq_labelRole")}</th>
              <th>{t("eq_labelEcransMenu")}</th>
              <th>{t("inst_colStatut")}</th>
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
                    {m.menuItems.length === TOUS_LES_ECRANS.length
                      ? t("eq_ecransTous")
                      : m.menuItems.map((e) => t(ECRANS_MENU.find((x) => x.valeur === e)?.cle ?? e)).join(", ") || "—"}
                  </td>
                  <td>{m.active ? t("eq_statutActif") : t("eq_statutDesactive")}</td>
                  <td style={{ display: "flex", gap: "8px" }}>
                    {m.role !== "ADMINISTRATEUR" && m.active && (
                      <button className={styles.boutonSecondaire} type="button" onClick={() => ouvrirEdition(m)}>
                        {t("action_modifier")}
                      </button>
                    )}
                    {m.role !== "ADMINISTRATEUR" && m.active && (
                      <button
                        onClick={() => retirer(m.id)}
                        style={{ background: "var(--color-flamme)", color: "#fff", border: "none", padding: "4px 10px", cursor: "pointer", fontSize: "0.8125rem" }}
                      >
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
                        <button className={styles.bouton} type="button" disabled={modificationEnCours} onClick={enregistrerEdition}>
                          {modificationEnCours ? t("eq_modificationEnCours") : t("action_enregistrer")}
                        </button>
                        <button
                          className={styles.boutonSecondaire}
                          type="button"
                          onClick={() => setEditionId(null)}
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
    </div>
  );
}

export default function EquipeInstitutionPage() {
  return (
    <InstitutionShell>
      <EquipeInstitutionContenu />
    </InstitutionShell>
  );
}
