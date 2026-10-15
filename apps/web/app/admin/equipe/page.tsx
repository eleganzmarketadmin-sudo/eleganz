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

  function recharger() {
    api
      .get<Admin[]>("/admin/team")
      .then(setAdmins)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function promouvoir(e: React.FormEvent) {
    e.preventDefault();
    setEnCours("formulaire");
    setErreur(null);
    try {
      await api.post("/admin/team/grant", { identifiant, role });
      setIdentifiant("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admequipe_promotionImpossible"));
    } finally {
      setEnCours(null);
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
        <select value={role} onChange={(e) => setRole(e.target.value)}>
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

      {admins.map((a) => (
        <div className={styles.admin} key={a.id}>
          <div>
            <span className={styles.nom}>{a.fullName}</span>
            <span className={styles.contact}> — {a.email ?? a.phone}</span>
          </div>
          <div className={styles.droite}>
            <span className={styles.role}>{libelleRole(a.role, t)}</span>
            {user?.id !== a.id && (
              <button
                className={styles.boutonRetirer}
                disabled={enCours === a.id}
                onClick={() => retirer(a.id)}
              >
                {t("admequipe_boutonRetirerAcces")}
              </button>
            )}
          </div>
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
