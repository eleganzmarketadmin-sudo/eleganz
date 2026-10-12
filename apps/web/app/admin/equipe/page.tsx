"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import styles from "./page.module.css";

interface Admin {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
}

const RÔLES = [
  { value: "ADMIN_SUPER", label: "Super administrateur" },
  { value: "ADMIN_SALES", label: "Ventes" },
  { value: "ADMIN_FINANCE", label: "Finance" },
  { value: "ADMIN_OPS", label: "Opérations" },
  { value: "ADMIN_LOGISTICS", label: "Logistique" },
  { value: "ADMIN_MARKETING", label: "Marketing" },
  { value: "ADMIN_SUPPORT", label: "Support" },
  { value: "ADMIN_AUDITOR", label: "Audit" },
];

function libelleRole(role: string): string {
  return RÔLES.find((r) => r.value === role)?.label ?? role;
}

function EquipeContent() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [identifiant, setIdentifiant] = useState("");
  const [role, setRole] = useState(RÔLES[1].value);

  function recharger() {
    api
      .get<Admin[]>("/admin/team")
      .then(setAdmins)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
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
      setErreur(err instanceof ApiError ? err.message : "Promotion impossible.");
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
      setErreur(err instanceof ApiError ? err.message : "Retrait impossible.");
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement de l&apos;équipe…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Équipe admin</h1>
      <p className={styles.sousTitre}>
        Donnez accès au centre de pilotage à d&apos;autres personnes de votre équipe, sans jamais toucher au code.
      </p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <form className={styles.formulaire} onSubmit={promouvoir}>
        <input
          placeholder="Email ou numéro déjà inscrit sur ELEGANZ"
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {RÔLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button className={styles.boutonAjouter} type="submit" disabled={enCours === "formulaire"}>
          Donner l&apos;accès
        </button>
      </form>

      {admins.map((a) => (
        <div className={styles.admin} key={a.id}>
          <div>
            <span className={styles.nom}>{a.fullName}</span>
            <span className={styles.contact}> — {a.email ?? a.phone}</span>
          </div>
          <div className={styles.droite}>
            <span className={styles.role}>{libelleRole(a.role)}</span>
            {user?.id !== a.id && (
              <button
                className={styles.boutonRetirer}
                disabled={enCours === a.id}
                onClick={() => retirer(a.id)}
              >
                Retirer l&apos;accès
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
