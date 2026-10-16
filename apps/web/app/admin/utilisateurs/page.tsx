"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
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

// Demandes "solliciter l'admin de la plateforme" (16 oct. 2026, point 1) —
// voie de secours pour un mot de passe oublié tant qu'aucun fournisseur
// d'envoi de code par email/WhatsApp n'est branché (voir
// PasswordResetService). `user` est nul si l'identifiant tapé ne
// correspond à aucun compte ELEGANZ.
interface DemandeReinitialisation {
  id: string;
  identifiant: string;
  message: string | null;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  createdAt: string;
  user: { id: string; fullName: string; email: string | null; phone: string | null; role: string } | null;
}

const CLES_ROLE: Record<string, string> = {
  BUYER: "gcmd_acheteurFallback",
  SHOP_OWNER: "admutil_roleProprietaireBoutique",
  SHOP_STAFF: "admutil_roleStaffBoutique",
  DRIVER: "livr_titre",
  ADMIN_SUPER: "admutil_roleAdminSuper",
  ADMIN_SALES: "admutil_roleAdminVentes",
  ADMIN_FINANCE: "admutil_roleAdminFinance",
  ADMIN_OPS: "admutil_roleAdminOperations",
  ADMIN_LOGISTICS: "admutil_roleAdminLogistique",
  ADMIN_MARKETING: "admutil_roleAdminMarketing",
  ADMIN_SUPPORT: "admutil_roleAdminSupport",
  ADMIN_AUDITOR: "admutil_roleAdminAudit",
};

function UtilisateursContent() {
  const { t } = useLocale();
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<UtilisateurListe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [selectionne, setSelectionne] = useState<UtilisateurDetail | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [motDePasseGenere, setMotDePasseGenere] = useState<string | null>(null);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");

  // Demandes "solliciter l'admin" (16 oct. 2026, point 1).
  const [demandes, setDemandes] = useState<DemandeReinitialisation[]>([]);
  const [demandeEnCours, setDemandeEnCours] = useState<string | null>(null);
  const [motsDePasseGeneresParDemande, setMotsDePasseGeneresParDemande] = useState<Record<string, string>>({});

  function rechargerDemandes() {
    api
      .get<DemandeReinitialisation[]>("/admin/password-reset-requests?status=PENDING")
      .then(setDemandes)
      .catch(() => setDemandes([]));
  }

  useEffect(rechargerDemandes, []);

  async function resoudreDemande(demande: DemandeReinitialisation) {
    setDemandeEnCours(demande.id);
    setErreur(null);
    try {
      const resultat = await api.post<{ motDePasseTemporaire?: string }>(
        `/admin/password-reset-requests/${demande.id}/resoudre`,
      );
      if (resultat.motDePasseTemporaire) {
        setMotsDePasseGeneresParDemande((actuel) => ({ ...actuel, [demande.id]: resultat.motDePasseTemporaire! }));
      }
      rechargerDemandes();
      rechercher();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_reinitialisationImpossible"));
    } finally {
      setDemandeEnCours(null);
    }
  }

  async function rejeterDemande(demandeId: string) {
    setDemandeEnCours(demandeId);
    setErreur(null);
    try {
      await api.post(`/admin/password-reset-requests/${demandeId}/rejeter`);
      rechargerDemandes();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setDemandeEnCours(null);
    }
  }

  function rechercher() {
    setChargement(true);
    setErreur(null);
    api
      .get<UtilisateurListe[]>(`/admin/users${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`)
      .then(setResultats)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
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
      setErreur(err instanceof ApiError ? err.message : t("admutil_impossibleChargerCompte"));
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
        resultat.motDePasseTemporaire ?? t("admutil_motDePasseMisAJour"),
      );
      setNouveauMotDePasse("");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_reinitialisationImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admutil_titre")}</h1>
      <p className={styles.sousTitre}>{t("admutil_sousTitre")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {demandes.length > 0 && (
        <div className={styles.section} style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
          <strong>{t("admutil_demandesReinitTitre")}</strong>
          <p className={styles.note}>{t("admutil_demandesReinitNote")}</p>
          {demandes.map((d) => (
            <div key={d.id} style={{ border: "1px solid var(--color-border)", padding: "12px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <strong>{d.user?.fullName ?? d.identifiant}</strong>
                  <span className={styles.note} style={{ margin: 0, display: "block" }}>
                    {d.identifiant} · {new Date(d.createdAt).toLocaleString()}
                  </span>
                  {d.message && <p style={{ margin: "4px 0 0" }}>{d.message}</p>}
                  {!d.user && <p className={styles.note} style={{ margin: "4px 0 0" }}>{t("admutil_demandeSansCompte")}</p>}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <button
                    className={styles.boutonAction}
                    disabled={!d.user || demandeEnCours === d.id}
                    onClick={() => resoudreDemande(d)}
                  >
                    {demandeEnCours === d.id ? "…" : t("admutil_reinitialiser")}
                  </button>
                  <button
                    className={styles.boutonSuspendre}
                    disabled={demandeEnCours === d.id}
                    onClick={() => rejeterDemande(d.id)}
                  >
                    {t("admutil_rejeterDemande")}
                  </button>
                </div>
              </div>
              {motsDePasseGeneresParDemande[d.id] && (
                <p className={styles.motDePasseResultat}>
                  {t("admutil_nouveauMotDePasseLabel")} <code>{motsDePasseGeneresParDemande[d.id]}</code>{" "}
                  {t("admutil_noteCommuniquerMotDePasse")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        className={styles.formRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          rechercher();
        }}
      >
        <input
          placeholder={t("admutil_placeholderRecherche")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <button type="submit" className={styles.boutonRechercher}>
          {t("admutil_rechercher")}
        </button>
      </form>

      <div className={styles.disposition}>
        <div className={styles.liste}>
          {chargement ? (
            <p>{t("commun_chargement")}</p>
          ) : resultats.length === 0 ? (
            <p className={styles.messageVide}>{t("admutil_aucunCompte")}</p>
          ) : (
            resultats.map((u) => (
              <button
                key={u.id}
                className={`${styles.ligneUtilisateur} ${selectionne?.id === u.id ? styles.ligneUtilisateurActive : ""}`}
                onClick={() => ouvrir(u.id)}
              >
                <span className={styles.nom}>{u.fullName}</span>
                <span className={styles.contact}>{u.email ?? u.phone ?? "—"}</span>
                <span className={styles.role}>{t(CLES_ROLE[u.role]) ?? u.role}</span>
                {u.isSuspended && <span className={styles.badgeSuspendu}>{t("admutil_suspendu")}</span>}
              </button>
            ))
          )}
        </div>

        <div className={styles.panneauDetail}>
          {chargementDetail ? (
            <p>{t("admutil_chargementCompte")}</p>
          ) : !selectionne ? (
            <p className={styles.messageVide}>{t("admutil_selectionnerCompte")}</p>
          ) : (
            <>
              <h2 className={styles.nomDetail}>{selectionne.fullName}</h2>
              <p className={styles.contactDetail}>
                {selectionne.email ?? "—"} · {selectionne.phone ?? "—"}
              </p>
              <p className={styles.roleDetail}>
                {CLES_ROLE[selectionne.role] ? t(CLES_ROLE[selectionne.role]) : selectionne.role}
                {selectionne.isSuspended && (
                  <span className={styles.badgeSuspendu}> — {t("admutil_suspendu")}</span>
                )}
              </p>

              {selectionne.ownedShops.length > 0 && (
                <div className={styles.blocInfo}>
                  <strong>{t("admutil_boutiquesPossedees")}</strong>
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
                  <strong>{t("admutil_membreEquipeDe")}</strong>
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
                <strong>{t("admutil_activite")}</strong>
                <p>
                  {selectionne._count.orders} {t("admutil_commandesMarketplace")} ·{" "}
                  {selectionne._count.reviews} {t("admutil_avisDeposes")}
                </p>
              </div>

              <div className={styles.section}>
                <strong>{t("admutil_reinitialiserMotDePasse")}</strong>
                <p className={styles.note}>{t("admutil_noteReinitialisation")}</p>
                <div className={styles.ligneAction}>
                  <input
                    type="text"
                    placeholder={t("admutil_placeholderNouveauMotDePasse")}
                    value={nouveauMotDePasse}
                    onChange={(e) => setNouveauMotDePasse(e.target.value)}
                  />
                  <button
                    className={styles.boutonAction}
                    onClick={reinitialiserMotDePasse}
                    disabled={enCours === "reset"}
                  >
                    {enCours === "reset" ? "…" : t("admutil_reinitialiser")}
                  </button>
                </div>
                {motDePasseGenere && (
                  <p className={styles.motDePasseResultat}>
                    {t("admutil_nouveauMotDePasseLabel")} <code>{motDePasseGenere}</code>{" "}
                    {t("admutil_noteCommuniquerMotDePasse")}
                  </p>
                )}
              </div>

              <div className={styles.section}>
                <strong>{t("admutil_accesCompte")}</strong>
                <p className={styles.note}>
                  {selectionne.isSuspended
                    ? t("admutil_connexionBloquee")
                    : t("admutil_descriptionSuspension")}
                </p>
                <button
                  className={selectionne.isSuspended ? styles.boutonReactiver : styles.boutonSuspendre}
                  onClick={basculerSuspension}
                  disabled={enCours === "suspension"}
                >
                  {enCours === "suspension"
                    ? "…"
                    : selectionne.isSuspended
                      ? t("admutil_reactiverCompte")
                      : t("admutil_suspendreCompte")}
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
