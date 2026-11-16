"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface DriverProfile {
  zone: string | null;
  verified: boolean;
  billingStatus: string;
  freeTrialStartedAt: string | null;
  user: { fullName: string; email: string | null; phone: string | null };
}

const CLES_FACTURATION: Record<string, string> = {
  FREE_PERIOD: "abo_statutPeriodeGratuite",
  PAYMENT_DUE: "abo_statutPaiementAttendu",
  ACTIVE: "abo_statutAJour",
  SUSPENDED: "livr_statutSuspendu",
};

// Facturation ELEGANZ côté livreur (16 nov. 2026, chantier relances/
// recouvrement) — même principe que la section homonyme de
// apps/web/app/(gestion)/parametres/page.tsx côté boutique : liste des
// factures via GET /delivery/me/invoices (déjà exposée, jamais consommée
// côté front avant ce chantier), dépôt de preuve de paiement en 3 étapes
// (upload-url → PUT direct vers R2 → confirmation), historique avec
// pénalité figée une fois la facture payée.
interface FactureEleganz {
  id: string;
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  reminderStage: number;
  penaltyDays: number | null;
  penaltyAmount: string | null;
}

const CLES_PALIER_FACTURATION: Record<number, string> = {
  1: "admfact_palier1",
  2: "admfact_palier2",
  3: "admfact_palier3",
  4: "admfact_palier4",
  5: "admfact_palier5",
};

function FacturationElegansSection({ billingStatus }: { billingStatus: string }) {
  const { t } = useLocale();
  const [factures, setFactures] = useState<FactureEleganz[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [preuveOuverte, setPreuveOuverte] = useState<string | null>(null);
  const [noteParFacture, setNoteParFacture] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function recharger() {
    api
      .get<FactureEleganz[]>("/delivery/me/invoices")
      .then(setFactures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("abonnement_erreurChargement")));
  }

  useEffect(recharger, []);

  async function deposerPreuve(factureId: string, fichier: File) {
    setEnCours(factureId);
    setErreur(null);
    setConfirmation(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/delivery/me/invoices/${factureId}/proof-of-payment/upload-url`,
        { contentType: fichier.type },
      );
      const reponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!reponse.ok) throw new Error(t("factElg_erreurEnvoiStockage"));
      await api.post(`/delivery/me/invoices/${factureId}/proof-of-payment`, {
        fileUrl: publicUrl,
        note: noteParFacture[factureId] || undefined,
      });
      setConfirmation(t("factElg_preuveDeposee"));
      setPreuveOuverte(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("factElg_erreurEnvoiPreuve"));
    } finally {
      setEnCours(null);
    }
  }

  if (factures === null && !erreur) return <p>{t("abonnement_chargement")}</p>;

  const enAttente = (factures ?? []).filter((f) => f.status === "PENDING");
  const historique = (factures ?? []).filter((f) => f.status !== "PENDING").slice(0, 10);

  return (
    <div style={{ marginTop: "var(--espace-5)" }}>
      <h2 style={{ marginBottom: "16px" }}>{t("factElg_titre")}</h2>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {confirmation && <p className={styles.statutVerifie}>{confirmation}</p>}
      {billingStatus === "SUSPENDED" && <p className={styles.erreur}>{t("factElg_noteSuspendueLivreur")}</p>}

      {enAttente.length === 0 ? (
        <p>{t("factElg_aucuneFactureEnAttente")}</p>
      ) : (
        enAttente.map((f) => (
          <div key={f.id} className={styles.champ} style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--espace-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--espace-3)", flexWrap: "wrap" }}>
              <span>
                {f.amount} $ — {t("crd_colEcheance")} : {new Date(f.dueAt).toLocaleDateString()}
              </span>
              {f.reminderStage > 0 && CLES_PALIER_FACTURATION[f.reminderStage] && (
                <span className={styles.statutNonVerifie}>{t(CLES_PALIER_FACTURATION[f.reminderStage])}</span>
              )}
            </div>
            {preuveOuverte === f.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--espace-2)" }}>
                <input
                  type="text"
                  placeholder={t("factElg_notePlaceholder")}
                  value={noteParFacture[f.id] ?? ""}
                  onChange={(e) => setNoteParFacture((n) => ({ ...n, [f.id]: e.target.value }))}
                />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    if (fichier) deposerPreuve(f.id, fichier);
                  }}
                  disabled={enCours === f.id}
                />
              </div>
            ) : (
              <button className={styles.boutonSecondaire} onClick={() => setPreuveOuverte(f.id)}>
                {t("factElg_deposerPreuve")}
              </button>
            )}
          </div>
        ))
      )}

      <h3 style={{ marginTop: "var(--espace-4)", marginBottom: "var(--espace-2)" }}>{t("factElg_historique")}</h3>
      {historique.length === 0 ? (
        <p>{t("factElg_aucunHistorique")}</p>
      ) : (
        historique.map((f) => (
          <div key={f.id} className={styles.champ}>
            <span>
              {f.amount} $ — {f.paidAt ? new Date(f.paidAt).toLocaleDateString() : ""}
            </span>
            <span>
              {t("admfact_statutPayee")}
              {f.penaltyAmount && Number(f.penaltyAmount) > 0 ? ` — ${t("admfact_penalite")} : ${f.penaltyAmount} $` : ""}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function ProfilContent() {
  const { t } = useLocale();
  const [profil, setProfil] = useState<DriverProfile | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Édition du téléphone/email personnel (demande du 16 oct. 2026, point 2)
  // — distincte des informations de livraison ci-dessous, qui restent gérées
  // par /delivery/me.
  const [editionCompte, setEditionCompte] = useState(false);
  const [emailEdite, setEmailEdite] = useState("");
  const [telephoneEdite, setTelephoneEdite] = useState("");
  const [enregistrementCompte, setEnregistrementCompte] = useState(false);
  const [erreurCompte, setErreurCompte] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DriverProfile>("/delivery/me")
      .then(setProfil)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  function ouvrirEditionCompte() {
    setEmailEdite(profil?.user.email ?? "");
    setTelephoneEdite(profil?.user.phone ?? "");
    setErreurCompte(null);
    setEditionCompte(true);
  }

  async function enregistrerCompte(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrementCompte(true);
    setErreurCompte(null);
    try {
      const miseAJour = await api.patch<{ fullName: string; email: string | null; phone: string | null }>(
        "/auth/me",
        {
          email: emailEdite.trim() || undefined,
          phone: telephoneEdite.trim() || undefined,
        },
      );
      setProfil((p) => (p ? { ...p, user: { ...p.user, email: miseAJour.email, phone: miseAJour.phone } } : p));
      setEditionCompte(false);
    } catch (err) {
      setErreurCompte(err instanceof ApiError ? err.message : t("profil_erreurEnregistrement"));
    } finally {
      setEnregistrementCompte(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("livr_monProfilLivreur")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {profil && (
        <div className={styles.fiche}>
          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("activites_nom")}</span>
            <span>{profil.user.fullName}</span>
          </div>

          {editionCompte ? (
            <form onSubmit={enregistrerCompte}>
              <label className={styles.champFormulaire}>
                <span className={styles.champLabel}>{t("profil_email")}</span>
                <input type="email" value={emailEdite} onChange={(e) => setEmailEdite(e.target.value)} />
              </label>
              <label className={styles.champFormulaire}>
                <span className={styles.champLabel}>{t("profil_telephone")}</span>
                <input value={telephoneEdite} onChange={(e) => setTelephoneEdite(e.target.value)} placeholder={t("profil_placeholderTelephone")} />
              </label>
              {erreurCompte && <p className={styles.erreur}>{erreurCompte}</p>}
              <div style={{ display: "flex", gap: "var(--espace-2)", marginTop: "var(--espace-3)" }}>
                <button className={styles.bouton} type="submit" disabled={enregistrementCompte}>
                  {enregistrementCompte ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
                </button>
                <button className={styles.boutonSecondaire} type="button" onClick={() => setEditionCompte(false)}>
                  {t("action_annuler")}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.champ}>
                <span className={styles.champLabel}>{t("profil_email")}</span>
                <span>{profil.user.email ?? t("profil_nonRenseigne")}</span>
              </div>
              <div className={styles.champ}>
                <span className={styles.champLabel}>{t("profil_telephone")}</span>
                <span>{profil.user.phone ?? t("profil_nonRenseigne")}</span>
              </div>
              <div style={{ marginTop: "var(--espace-2)" }}>
                <button className={styles.boutonSecondaire} onClick={ouvrirEditionCompte}>
                  {t("profil_modifier")}
                </button>
              </div>
            </>
          )}

          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("livr_zone")}</span>
            <span>{profil.zone ?? t("livr_zoneNonPrecisee")}</span>
          </div>
          <div className={styles.champ}>
            <span className={styles.champLabel}>{t("livr_verification")}</span>
            <span className={profil.verified ? styles.statutVerifie : styles.statutNonVerifie}>
              {profil.verified
                ? t("livr_verifiePeutRecevoirMissions")
                : t("livr_enAttenteVerification")}
            </span>
          </div>
          {profil.verified && (
            <div className={styles.champ}>
              <span className={styles.champLabel}>{t("abo_statut")}</span>
              <span className={profil.billingStatus === "SUSPENDED" ? styles.statutNonVerifie : styles.statutVerifie}>
                {CLES_FACTURATION[profil.billingStatus] ? t(CLES_FACTURATION[profil.billingStatus]) : profil.billingStatus}
              </span>
            </div>
          )}
        </div>
      )}
      {profil?.verified && <FacturationElegansSection billingStatus={profil.billingStatus} />}
    </div>
  );
}

export default function ProfilLivreurPage() {
  return (
    <LivreurShell>
      <ProfilContent />
    </LivreurShell>
  );
}
