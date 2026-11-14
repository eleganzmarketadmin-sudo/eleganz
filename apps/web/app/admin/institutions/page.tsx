"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

const TYPES_INSTITUTION = ["MICROFINANCE", "BANQUE", "COOPERATIVE", "AUTRE"] as const;
type TypeInstitution = (typeof TYPES_INSTITUTION)[number];

type StatutInstitution = "ACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED";

interface Institution {
  id: string;
  name: string;
  type: TypeInstitution;
  contactEmail: string | null;
  contactPhone: string | null;
  status: StatutInstitution;
  createdAt: string;
  user: { id: string; fullName: string; email: string | null; phone: string | null; isSuspended: boolean };
}

const BADGE_CLASSES: Record<StatutInstitution, string> = {
  ACTIVE: "badgeActive",
  SUSPENDED: "badgeSuspended",
  PENDING: "badgePending",
  REJECTED: "badgeRejected",
};

const BADGE_LABELS: Record<StatutInstitution, string> = {
  ACTIVE: "admInst_statutActive",
  SUSPENDED: "admInst_statutSuspended",
  PENDING: "admInst_statutPending",
  REJECTED: "admInst_statutRejected",
};

/**
 * Gestion des institutions partenaires (microfinances, banques,
 * coopératives) par le Centre de pilotage. Deux voies de création
 * coexistent depuis le revirement du 14 nov. 2026 (voir le commentaire sur
 * Institution dans schema.prisma) : la création manuelle ci-dessous par un
 * admin (promotion d'un compte ELEGANZ existant, statut ACTIVE d'emblée —
 * décision d'origine, toujours valable pour ce chemin précis), et
 * l'auto-inscription libre par l'institution elle-même
 * (institution/inscription/page.tsx), qui crée toujours un profil PENDING
 * en attente de la décision ci-dessous (Approuver/Refuser). Réservé à
 * ADMIN_SUPER côté API (AdminInstitutionsController) — voir le commentaire
 * sur `estSuperAdmin` ci-dessous, la vraie barrière reste côté serveur.
 */
function InstitutionsAdminContenu() {
  const { t } = useLocale();
  const { user } = useAuth();
  const estSuperAdmin = user?.role === "ADMIN_SUPER";

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [identifiant, setIdentifiant] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<TypeInstitution>("MICROFINANCE");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Édition d'une institution déjà créée (14 nov. 2026, demande : "gérer
  // (ajouter etc.)" — l'API PATCH /admin/institutions/:id existait déjà
  // (AdminInstitutionsService.update) mais sans UI pour l'appeler ; ajouté
  // ici plutôt qu'un nouvel écran, par cohérence avec le formulaire de
  // création déjà présent sur cette page. L'identifiant (compte ELEGANZ
  // rattaché) n'est jamais modifiable : changer de compte reviendrait à
  // révoquer puis recréer l'institution, pas à la "modifier".
  const [institutionEnEdition, setInstitutionEnEdition] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<TypeInstitution>("MICROFINANCE");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editEnCours, setEditEnCours] = useState(false);

  // Décision admin sur une auto-inscription (14 nov. 2026) — "Approuver"
  // réutilise littéralement l'endpoint /reactivate (même opération : statut
  // ACTIVE, rejectionNote effacée), seul le libellé du bouton change selon
  // le statut de départ ; "Refuser" est son propre endpoint dédié
  // (/reject), avec un motif facultatif affiché ensuite à l'institution sur
  // son propre portail (jamais réaffiché ici à l'admin).
  const [institutionEnRefus, setInstitutionEnRefus] = useState<string | null>(null);
  const [noteRefus, setNoteRefus] = useState("");
  const [refusEnCours, setRefusEnCours] = useState(false);

  function recharger() {
    setChargement(true);
    api
      .get<Institution[]>("/admin/institutions")
      .then(setInstitutions)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!identifiant || !name) return;
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post("/admin/institutions", {
        identifiant,
        name,
        type,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
      });
      setConfirmation(t("admInst_creationReussie"));
      setIdentifiant("");
      setName("");
      setContactEmail("");
      setContactPhone("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique"));
    } finally {
      setEnCours(false);
    }
  }

  function ouvrirEdition(institution: Institution) {
    setInstitutionEnEdition(institution.id);
    setEditName(institution.name);
    setEditType(institution.type);
    setEditContactEmail(institution.contactEmail ?? "");
    setEditContactPhone(institution.contactPhone ?? "");
    setErreur(null);
    setConfirmation(null);
  }

  async function enregistrerEdition(e: React.FormEvent) {
    e.preventDefault();
    if (!institutionEnEdition || !editName) return;
    setEditEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch(`/admin/institutions/${institutionEnEdition}`, {
        name: editName,
        type: editType,
        contactEmail: editContactEmail || "",
        contactPhone: editContactPhone || "",
      });
      setConfirmation(t("admInst_modificationReussie"));
      setInstitutionEnEdition(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique"));
    } finally {
      setEditEnCours(false);
    }
  }

  async function basculerStatut(institution: Institution) {
    setErreur(null);
    setConfirmation(null);
    try {
      const action = institution.status === "ACTIVE" ? "suspend" : "reactivate";
      await api.post(`/admin/institutions/${institution.id}/${action}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique"));
    }
  }

  async function approuver(institution: Institution) {
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/admin/institutions/${institution.id}/reactivate`);
      setConfirmation(t("admInst_approbationReussie"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique"));
    }
  }

  function ouvrirRefus(institution: Institution) {
    setInstitutionEnRefus(institution.id);
    setNoteRefus("");
    setErreur(null);
    setConfirmation(null);
  }

  async function confirmerRefus(e: React.FormEvent) {
    e.preventDefault();
    if (!institutionEnRefus) return;
    setRefusEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/admin/institutions/${institutionEnRefus}/reject`, { note: noteRefus || undefined });
      setConfirmation(t("admInst_refusReussi"));
      setInstitutionEnRefus(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admInst_erreurGenerique"));
    } finally {
      setRefusEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admInst_titre")}</h1>
      <p className={styles.sousTitre}>{t("admInst_sousTitre")}</p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      {estSuperAdmin && (
        <form onSubmit={creer} className={styles.formulaire}>
          <div className={styles.champ}>
            <label>{t("admInst_labelIdentifiant")}</label>
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder={t("admInst_placeholderIdentifiant")} required />
          </div>
          <div className={styles.champ}>
            <label>{t("admInst_labelNom")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={styles.champ}>
            <label>{t("admInst_labelType")}</label>
            <select value={type} onChange={(e) => setType(e.target.value as TypeInstitution)}>
              {TYPES_INSTITUTION.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`inst_type_${tp}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.champ}>
            <label>{t("admInst_labelContactEmail")}</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className={styles.champ}>
            <label>{t("admInst_labelContactTelephone")}</label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours || !identifiant || !name}>
            {enCours ? t("dossier_genererEnCours") : t("admInst_creer")}
          </button>
        </form>
      )}

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : institutions.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)" }}>{t("admInst_aucuneInstitution")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("admInst_colNom")}</th>
              <th>{t("admInst_colType")}</th>
              <th>{t("admInst_colCompte")}</th>
              <th>{t("admInst_colStatut")}</th>
              {estSuperAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {institutions.map((inst) =>
              institutionEnRefus === inst.id ? (
                <tr key={inst.id}>
                  <td colSpan={estSuperAdmin ? 5 : 4}>
                    <form onSubmit={confirmerRefus} className={styles.formulaire} style={{ padding: "var(--espace-2) 0" }}>
                      <div className={styles.champ}>
                        <label>{t("admInst_labelNoteRefus")}</label>
                        <input value={noteRefus} onChange={(e) => setNoteRefus(e.target.value)} />
                      </div>
                      <button
                        className={styles.bouton}
                        type="submit"
                        disabled={refusEnCours}
                        style={{ background: "var(--color-flamme)" }}
                      >
                        {refusEnCours ? t("dossier_genererEnCours") : t("admInst_confirmerRefus")}
                      </button>
                      <button
                        type="button"
                        className={styles.boutonSecondaire}
                        onClick={() => setInstitutionEnRefus(null)}
                        disabled={refusEnCours}
                      >
                        {t("action_annuler")}
                      </button>
                    </form>
                  </td>
                </tr>
              ) : institutionEnEdition === inst.id ? (
                <tr key={inst.id}>
                  <td colSpan={estSuperAdmin ? 5 : 4}>
                    <form onSubmit={enregistrerEdition} className={styles.formulaire} style={{ padding: "var(--espace-2) 0" }}>
                      <div className={styles.champ}>
                        <label>{t("admInst_labelNom")}</label>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                      </div>
                      <div className={styles.champ}>
                        <label>{t("admInst_labelType")}</label>
                        <select value={editType} onChange={(e) => setEditType(e.target.value as TypeInstitution)}>
                          {TYPES_INSTITUTION.map((tp) => (
                            <option key={tp} value={tp}>
                              {t(`inst_type_${tp}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.champ}>
                        <label>{t("admInst_labelContactEmail")}</label>
                        <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
                      </div>
                      <div className={styles.champ}>
                        <label>{t("admInst_labelContactTelephone")}</label>
                        <input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
                      </div>
                      <button className={styles.bouton} type="submit" disabled={editEnCours || !editName}>
                        {editEnCours ? t("dossier_genererEnCours") : t("action_enregistrer")}
                      </button>
                      <button
                        type="button"
                        className={styles.boutonSecondaire}
                        onClick={() => setInstitutionEnEdition(null)}
                        disabled={editEnCours}
                      >
                        {t("action_annuler")}
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={inst.id}>
                  <td>{inst.name}</td>
                  <td>{t(`inst_type_${inst.type}`)}</td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--color-texte-muted)" }}>
                    {inst.user.fullName}
                    <br />
                    {inst.user.email ?? inst.user.phone}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[BADGE_CLASSES[inst.status]]}`}>
                      {t(BADGE_LABELS[inst.status])}
                    </span>
                  </td>
                  {estSuperAdmin && (
                    <td style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap" }}>
                      <button className={styles.boutonPetit} onClick={() => ouvrirEdition(inst)}>
                        {t("action_modifier")}
                      </button>
                      {inst.status === "PENDING" && (
                        <>
                          <button
                            className={styles.boutonPetit}
                            style={{ background: "var(--color-vert-paiement, #198754)" }}
                            onClick={() => approuver(inst)}
                          >
                            {t("admInst_approuver")}
                          </button>
                          <button
                            className={styles.boutonPetit}
                            style={{ background: "var(--color-flamme)" }}
                            onClick={() => ouvrirRefus(inst)}
                          >
                            {t("admInst_refuser")}
                          </button>
                        </>
                      )}
                      {inst.status === "REJECTED" && (
                        <button
                          className={styles.boutonPetit}
                          style={{ background: "var(--color-vert-paiement, #198754)" }}
                          onClick={() => approuver(inst)}
                        >
                          {t("admInst_approuver")}
                        </button>
                      )}
                      {(inst.status === "ACTIVE" || inst.status === "SUSPENDED") && (
                        <button
                          className={styles.boutonPetit}
                          style={{ background: inst.status === "ACTIVE" ? "var(--color-flamme)" : "var(--color-vert-paiement, #198754)" }}
                          onClick={() => basculerStatut(inst)}
                        >
                          {t(inst.status === "ACTIVE" ? "admInst_suspendre" : "admInst_reactiver")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function InstitutionsAdminPage() {
  return (
    <AdminShell>
      <InstitutionsAdminContenu />
    </AdminShell>
  );
}
