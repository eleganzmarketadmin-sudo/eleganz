"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Livreur {
  id: string;
  zone: string | null;
  verified: boolean;
  billingStatus: string;
  freeTrialStartedAt: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  licenseNumber: string | null;
  idDocumentNumber: string | null;
  adminNote: string | null;
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
    isSuspended: boolean;
  };
  _count: { deliveries: number };
}

interface ComportementLivreur {
  livreurId: string;
  totalLivraisons: number;
  livrees: number;
  enCoursActuellement: number;
  livraisonsCeMois: number;
  tauxLitigePct: number;
  delaiMoyenLivraisonHeures: number | null;
}

const CLES_VEHICULE: Record<string, string> = {
  PIED: "gliv_vehiculeAPied",
  VELO: "gliv_vehiculeVelo",
  MOTO: "gliv_vehiculeMoto",
  VOITURE: "gliv_vehiculeVoiture",
};

const CLES_FACTURATION: Record<string, string> = {
  FREE_PERIOD: "abo_statutPeriodeGratuite",
  PAYMENT_DUE: "abo_statutPaiementAttendu",
  ACTIVE: "abo_statutAJour",
  SUSPENDED: "livr_statutSuspendu",
};

/**
 * Centre de gestion des partenaires livreurs (prompt §10 et §37, enrichi le
 * 13 oct. 2026) — dossier complet (identité, véhicule) à instruire avant de
 * valider la souscription, et suivi stats/SLA par livreur (point 3 du même
 * jour), fusionné depuis /admin/supervision/livreurs pour que la vérification
 * et le suivi se fassent au même endroit. Un livreur créé par
 * auto-inscription n'est jamais vérifié par défaut — assignDriver() refuse
 * toute affectation de mission à un livreur non vérifié.
 */
function LivreursContent() {
  const { t } = useLocale();
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [stats, setStats] = useState<Record<string, ComportementLivreur>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function recharger() {
    Promise.all([
      api.get<Livreur[]>("/delivery/drivers"),
      api.get<ComportementLivreur[]>("/admin/supervision/livreurs"),
    ])
      .then(([listeLivreurs, listeStats]) => {
        setLivreurs(listeLivreurs);
        setStats(Object.fromEntries(listeStats.map((s) => [s.livreurId, s])));
        setNotes(Object.fromEntries(listeLivreurs.map((l) => [l.id, l.adminNote ?? ""])));
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function basculerVerification(driverId: string, verified: boolean) {
    setEnCours(driverId);
    setErreur(null);
    try {
      await api.post(`/delivery/drivers/${driverId}/verify`, { verified });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admlivr_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function enregistrerNote(driverId: string) {
    setEnCours(driverId);
    setErreur(null);
    try {
      await api.post(`/delivery/drivers/${driverId}/note`, { adminNote: notes[driverId] ?? "" });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admlivr_enregistrementNoteImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("gliv_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_livreurs")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {livreurs.length === 0 ? (
        <p className={styles.messageVide}>{t("gliv_aucunLivreur")}</p>
      ) : (
        livreurs.map((l) => {
          const s = stats[l.id];
          return (
            <div className={styles.boutique} key={l.id}>
              <div className={styles.entete}>
                <div>
                  <span className={styles.nom}>{l.user.fullName}</span>
                  <span className={`${styles.statut} ${!l.verified ? styles.statutSuspendu : ""}`}>
                    {l.verified ? t("admlivr_verifie") : t("admlivr_nonVerifie")}
                  </span>
                  <span className={`${styles.statut} ${l.billingStatus === "SUSPENDED" ? styles.statutSuspendu : ""}`}>
                    {CLES_FACTURATION[l.billingStatus] ? t(CLES_FACTURATION[l.billingStatus]) : l.billingStatus}
                  </span>
                </div>
                <span className={styles.date}>
                  {t("admlivr_inscritLe")} {formatDate(l.user.createdAt)}
                </span>
              </div>
              <div className={styles.corps}>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("cpt_compte")}</span>
                  <span>{l.user.email ?? l.user.phone}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelTelephoneLivraison")}</span>
                  <span>{l.phone ?? t("admlivr_nonRenseigne")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelWhatsapp")}</span>
                  <span>{l.whatsapp ?? t("admlivr_nonRenseigne")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("param_labelAdresse")}</span>
                  <span>{l.address ?? t("admlivr_nonRenseignee")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("livr_zone")}</span>
                  <span>{l.zone ?? t("livr_zoneNonPrecisee")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("gliv_labelVehicule")}</span>
                  <span>{l.vehicleType ? (CLES_VEHICULE[l.vehicleType] ? t(CLES_VEHICULE[l.vehicleType]) : l.vehicleType) : t("admlivr_nonRenseigne")}</span>
                </div>
                {l.vehiclePlate && (
                  <div className={styles.champInfo}>
                    <span className={styles.champLabel}>{t("admlivr_labelPlaque")}</span>
                    <span>{l.vehiclePlate}</span>
                  </div>
                )}
                {l.licenseNumber && (
                  <div className={styles.champInfo}>
                    <span className={styles.champLabel}>{t("admlivr_labelPermisConduire")}</span>
                    <span>{l.licenseNumber}</span>
                  </div>
                )}
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelPieceIdentite")}</span>
                  <span>{l.idDocumentNumber ?? t("admlivr_nonRenseignee")}</span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelLivraisons")}</span>
                  <span>
                    {t("admlivr_livraisonsTotal").replace("{{total}}", String(l._count.deliveries))}
                    {s
                      ? t("admlivr_livraisonsDetail")
                          .replace("{{livrees}}", String(s.livrees))
                          .replace("{{taux}}", String(s.tauxLitigePct))
                      : ""}
                  </span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelEnCoursActuellement")}</span>
                  <span>
                    {s
                      ? t("admlivr_missionEnRoute").replace("{{n}}", String(s.enCoursActuellement))
                      : t("cpt_aucuneDonnee")}
                  </span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelCeMoisCi")}</span>
                  <span>
                    {s
                      ? t("admlivr_livraisonsAffectees").replace("{{n}}", String(s.livraisonsCeMois))
                      : t("cpt_aucuneDonnee")}
                  </span>
                </div>
                <div className={styles.champInfo}>
                  <span className={styles.champLabel}>{t("admlivr_labelDelaiMoyen")}</span>
                  <span>
                    {s?.delaiMoyenLivraisonHeures != null
                      ? t("admlivr_delaiHeures").replace("{{n}}", String(s.delaiMoyenLivraisonHeures))
                      : t("admlivr_pasEncoreMesurable")}
                  </span>
                </div>
              </div>
              <div className={styles.corps} style={{ paddingTop: 0 }}>
                <div className={styles.champInfo} style={{ gridColumn: "1 / -1" }}>
                  <span className={styles.champLabel}>{t("admlivr_labelNoteInstruction")}</span>
                  <textarea
                    value={notes[l.id] ?? ""}
                    onChange={(e) => setNotes((v) => ({ ...v, [l.id]: e.target.value }))}
                    rows={2}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
                    placeholder={t("admlivr_placeholderNote")}
                  />
                  <button
                    className={styles.boutonReactiver}
                    style={{ marginTop: "8px", width: "fit-content" }}
                    disabled={enCours === l.id}
                    onClick={() => enregistrerNote(l.id)}
                  >
                    {t("admlivr_enregistrerNote")}
                  </button>
                </div>
              </div>
              <div className={styles.actions}>
                {l.verified ? (
                  <button
                    className={styles.boutonSuspendre}
                    disabled={enCours === l.id}
                    onClick={() => basculerVerification(l.id, false)}
                  >
                    {t("admlivr_retirerVerification")}
                  </button>
                ) : (
                  <button
                    className={styles.boutonReactiver}
                    disabled={enCours === l.id}
                    onClick={() => basculerVerification(l.id, true)}
                  >
                    {t("admlivr_verifierCeLivreur")}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function AdminLivreursPage() {
  return (
    <AdminShell>
      <LivreursContent />
    </AdminShell>
  );
}
