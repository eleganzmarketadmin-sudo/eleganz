"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Admin {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  // Écrans du Centre de pilotage effectivement accordés (16 oct. 2026 —
  // "possibilité de choisir par des coches les menus auxquels
  // l'utilisateur aura accès") — calculés côté API, jamais recalculés ici.
  menuItems: string[];
}

const CLES_RÔLES = [
  { value: "ADMIN_SUPER", labelKey: "admequipe_roleAdminSuper" },
  { value: "ADMIN_SALES", labelKey: "admequipe_roleAdminSales" },
  { value: "ADMIN_FINANCE", labelKey: "admequipe_roleAdminFinance" },
  { value: "ADMIN_OPS", labelKey: "admequipe_roleAdminOps" },
  { value: "ADMIN_LOGISTICS", labelKey: "admequipe_roleAdminLogistics" },
  { value: "ADMIN_MARKETING", labelKey: "admequipe_roleAdminMarketing" },
  { value: "ADMIN_SUPPORT", labelKey: "admequipe_roleAdminSupport" },
  { value: "ADMIN_AUDITOR", labelKey: "admequipe_roleAdminAuditor" },
];

// Écrans du Centre de pilotage disponibles (mêmes clés que MenuAdmin côté
// API et que AdminShell.LIENS) — 16 oct. 2026 : "donner la main aux users
// super administrateur l'accès au menu équipe et la possibilité de choisir
// par des coches les menus auxquel l'utilisateur aura accès".
const ECRANS_MENU_ADMIN = [
  { valeur: "PILOTAGE", cle: "nav_tableauDeBord" },
  { valeur: "BOUTIQUES", cle: "nav_boutiques" },
  { valeur: "LIVREURS", cle: "nav_livreurs" },
  { valeur: "COMPTABLE", cle: "titre_accueil" },
  { valeur: "FINANCE", cle: "nav_finance" },
  { valeur: "SUIVI_COMMANDES", cle: "nav_suiviCommandes" },
  { valeur: "UTILISATEURS", cle: "nav_utilisateurs" },
  { valeur: "TARIFS", cle: "nav_tarifs" },
  { valeur: "FACTURES", cle: "nav_factures" },
  { valeur: "RELEVES", cle: "nav_releves" },
  { valeur: "LITIGES", cle: "nav_litiges" },
  { valeur: "EXPERTS", cle: "nav_experts" },
  { valeur: "MESSAGERIE", cle: "nav_messagerie" },
  { valeur: "EQUIPE_ADMIN", cle: "nav_equipeAdmin" },
  { valeur: "PARAMETRES_PLATEFORME", cle: "nav_parametresPlateforme" },
] as const;

function libelleRole(role: string, t: (key: string) => string): string {
  const cle = CLES_RÔLES.find((r) => r.value === role)?.labelKey;
  return cle ? t(cle) : role;
}

function EquipeContent() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [identifiant, setIdentifiant] = useState("");
  const [role, setRole] = useState(CLES_RÔLES[1].value);

  // Écrans par défaut de chaque rôle (GET /admin/team/defauts-menu), pour
  // pré-remplir les cases à cocher — la vraie valeur par défaut si rien
  // n'est envoyé reste calculée côté API (menuAdminParDefaut).
  const [defautsParRole, setDefautsParRole] = useState<Record<string, string[]>>({});
  const [menuItemsChoisis, setMenuItemsChoisis] = useState<string[]>([]);

  // Édition d'un admin déjà promu (16 oct. 2026) — n'existait pas avant
  // (seules la promotion et la révocation étaient possibles).
  const [editionId, setEditionId] = useState<string | null>(null);
  const [roleEdite, setRoleEdite] = useState<string>("ADMIN_SALES");
  const [menuItemsEdites, setMenuItemsEdites] = useState<string[]>([]);
  const [modificationEnCours, setModificationEnCours] = useState(false);

  function basculerMenuItem(valeur: string, liste: string[], definir: (v: string[]) => void) {
    definir(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]);
  }

  function recharger() {
    api
      .get<Admin[]>("/admin/team")
      .then(setAdmins)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  useEffect(() => {
    api
      .get<Record<string, string[]>>("/admin/team/defauts-menu")
      .then((defauts) => {
        setDefautsParRole(defauts);
        setMenuItemsChoisis(defauts[role] ?? []);
      })
      .catch(() => {
        // Non bloquant : sans ces valeurs par défaut, les cases partent
        // simplement toutes décochées plutôt que pré-remplies.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function promouvoir(e: React.FormEvent) {
    e.preventDefault();
    setEnCours("formulaire");
    setErreur(null);
    try {
      await api.post("/admin/team/grant", { identifiant, role, menuItems: menuItemsChoisis });
      setIdentifiant("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admequipe_promotionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  function ouvrirEdition(a: Admin) {
    setEditionId(a.id);
    setRoleEdite(a.role);
    setMenuItemsEdites(a.menuItems);
    setErreur(null);
  }

  async function enregistrerEdition() {
    if (!editionId) return;
    setModificationEnCours(true);
    setErreur(null);
    try {
      await api.patch(`/admin/team/${editionId}`, { role: roleEdite, menuItems: menuItemsEdites });
      setEditionId(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admequipe_modificationImpossible"));
    } finally {
      setModificationEnCours(false);
    }
  }

  async function retirer(userId: string) {
    setEnCours(userId);
    setErreur(null);
    try {
      await api.post(`/admin/team/${userId}/revoke`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gcmd_retraitImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("admequipe_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_equipeAdmin")}</h1>
      <p className={styles.sousTitre}>{t("admequipe_sousTitre")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <form className={styles.formulaire} onSubmit={promouvoir}>
        <input
          placeholder={t("admequipe_placeholderIdentifiant")}
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          required
        />
        <select
          value={role}
          onChange={(e) => {
            const nouveauRole = e.target.value;
            setRole(nouveauRole);
            setMenuItemsChoisis(defautsParRole[nouveauRole] ?? []);
          }}
        >
          {CLES_RÔLES.map((r) => (
            <option key={r.value} value={r.value}>
              {t(r.labelKey)}
            </option>
          ))}
        </select>
        <button className={styles.boutonAjouter} type="submit" disabled={enCours === "formulaire"}>
          {t("admequipe_boutonDonnerAcces")}
        </button>
      </form>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "8px 0 20px" }}>
        {ECRANS_MENU_ADMIN.map((ecran) => (
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

      {admins.map((a) => (
        <div key={a.id}>
          <div className={styles.admin}>
            <div>
              <span className={styles.nom}>{a.fullName}</span>
              <span className={styles.contact}> — {a.email ?? a.phone}</span>
            </div>
            <div className={styles.droite}>
              <span className={styles.role}>{libelleRole(a.role, t)}</span>
              <span style={{ fontSize: "0.85em", color: "var(--color-texte-muted)" }}>
                {a.menuItems.length === ECRANS_MENU_ADMIN.length
                  ? t("admequipe_ecransTous")
                  : a.menuItems.map((e) => t(ECRANS_MENU_ADMIN.find((x) => x.valeur === e)?.cle ?? e)).join(", ") || "—"}
              </span>
              {user?.id !== a.id && (
                <button className={styles.boutonAjouter} type="button" onClick={() => ouvrirEdition(a)}>
                  {t("admequipe_modifier")}
                </button>
              )}
              {user?.id !== a.id && (
                <button className={styles.boutonRetirer} disabled={enCours === a.id} onClick={() => retirer(a.id)}>
                  {t("admequipe_boutonRetirerAcces")}
                </button>
              )}
            </div>
          </div>
          {editionId === a.id && (
            <div className={styles.formulaire} style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <select value={roleEdite} onChange={(e) => setRoleEdite(e.target.value)}>
                {CLES_RÔLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "8px 0" }}>
                {ECRANS_MENU_ADMIN.map((ecran) => (
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
              <div style={{ display: "flex", gap: "12px" }}>
                <button className={styles.boutonAjouter} type="button" disabled={modificationEnCours} onClick={enregistrerEdition}>
                  {modificationEnCours ? t("admequipe_modificationEnCours") : t("action_enregistrer")}
                </button>
                <button className={styles.boutonRetirer} type="button" onClick={() => setEditionId(null)}>
                  {t("action_annuler")}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminEquipePage() {
  return (
    <AdminShell>
      <EquipeContent />
    </AdminShell>
  );
}
